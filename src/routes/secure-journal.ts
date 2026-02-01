/**
 * Secure Journal Routes
 * 
 * API endpoints for the encrypted journaling system.
 * Clawtlas acts as a blind relay - storing encrypted blobs it cannot read.
 */

import { Hono } from 'hono';
import { ulid } from 'ulid';
import { db } from '../db.js';
import {
  SecureEntry,
  verifySecureEntry,
  hashContent,
  hexToBytes,
} from '../crypto/index.js';

// ============================================================================
// Database Setup
// ============================================================================

// Ensure secure entries table exists
db.exec(`
  -- Secure journal entries (encrypted storage)
  CREATE TABLE IF NOT EXISTS secure_entries (
    entry_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    
    -- Encrypted data (opaque to server)
    encrypted_payload TEXT NOT NULL,
    
    -- Verifiable without decryption
    content_hash TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL,
    signature TEXT NOT NULL,
    
    -- Selective disclosure
    disclosed_attributes TEXT,
    
    -- Metadata
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    received_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (agent_id) REFERENCES agents(id)
  );

  CREATE INDEX IF NOT EXISTS idx_secure_agent ON secure_entries(agent_id);
  CREATE INDEX IF NOT EXISTS idx_secure_hash ON secure_entries(content_hash);
  CREATE INDEX IF NOT EXISTS idx_secure_entry_hash ON secure_entries(entry_hash);
  CREATE INDEX IF NOT EXISTS idx_secure_created ON secure_entries(created_at);

  -- Agent public keys for verification
  CREATE TABLE IF NOT EXISTS agent_public_keys (
    agent_id TEXT NOT NULL,
    key_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    algorithm TEXT NOT NULL DEFAULT 'ed25519',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at TEXT,
    PRIMARY KEY (agent_id, key_id),
    FOREIGN KEY (agent_id) REFERENCES agents(id)
  );

  -- Hash chain state per agent
  CREATE TABLE IF NOT EXISTS agent_chain_state (
    agent_id TEXT PRIMARY KEY,
    latest_entry_hash TEXT NOT NULL,
    entry_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (agent_id) REFERENCES agents(id)
  );

  -- Encrypted ACL grants (for routing)
  CREATE TABLE IF NOT EXISTS acl_grants (
    entry_id TEXT NOT NULL,
    grantee_hash TEXT NOT NULL,
    encrypted_grant TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (entry_id, grantee_hash),
    FOREIGN KEY (entry_id) REFERENCES secure_entries(entry_id)
  );
`);

// Prepared statements
const getAgentByToken = db.prepare(`SELECT * FROM agents WHERE token = ?`);
const getAgentPublicKey = db.prepare(`
  SELECT public_key FROM agent_public_keys 
  WHERE agent_id = ? AND revoked_at IS NULL 
  ORDER BY created_at DESC LIMIT 1
`);
const insertSecureEntry = db.prepare(`
  INSERT INTO secure_entries (
    entry_id, agent_id, encrypted_payload, content_hash, prev_hash, 
    entry_hash, signature, disclosed_attributes, version, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const getSecureEntry = db.prepare(`SELECT * FROM secure_entries WHERE entry_id = ?`);
const getSecureEntriesByAgent = db.prepare(`
  SELECT * FROM secure_entries 
  WHERE agent_id = ? 
  ORDER BY created_at DESC 
  LIMIT ? OFFSET ?
`);
const getChainState = db.prepare(`SELECT * FROM agent_chain_state WHERE agent_id = ?`);
const upsertChainState = db.prepare(`
  INSERT INTO agent_chain_state (agent_id, latest_entry_hash, entry_count, updated_at)
  VALUES (?, ?, 1, datetime('now'))
  ON CONFLICT(agent_id) DO UPDATE SET 
    latest_entry_hash = excluded.latest_entry_hash,
    entry_count = entry_count + 1,
    updated_at = datetime('now')
`);
const insertPublicKey = db.prepare(`
  INSERT INTO agent_public_keys (agent_id, key_id, public_key, algorithm)
  VALUES (?, ?, ?, ?)
`);
const insertAclGrant = db.prepare(`
  INSERT INTO acl_grants (entry_id, grantee_hash, encrypted_grant)
  VALUES (?, ?, ?)
`);
const getAclGrant = db.prepare(`
  SELECT encrypted_grant FROM acl_grants 
  WHERE entry_id = ? AND grantee_hash = ?
`);

// ============================================================================
// Types
// ============================================================================

interface Agent {
  id: string;
  name: string;
  token: string;
  created_at: string;
  metadata?: string;
}

type Variables = {
  agent: Agent;
};

// ============================================================================
// Middleware
// ============================================================================

async function requireAuth(c: any, next: any) {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = auth.slice(7);
  const agent = getAgentByToken.get(token) as Agent | undefined;
  
  if (!agent) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  c.set('agent', agent);
  await next();
}

// ============================================================================
// Routes
// ============================================================================

export const secureJournalRoutes = new Hono<{ Variables: Variables }>();

/**
 * Register public key for an agent
 * Required before submitting signed entries
 */
secureJournalRoutes.post('/keys', requireAuth, async (c) => {
  try {
    const agent = c.get('agent');
    const body = await c.req.json();
    
    const { publicKey, algorithm = 'ed25519' } = body;
    
    if (!publicKey || typeof publicKey !== 'string') {
      return c.json({ error: 'publicKey is required (hex-encoded)' }, 400);
    }
    
    // Validate it looks like a hex-encoded key
    if (!/^[0-9a-fA-F]{64}$/.test(publicKey)) {
      return c.json({ error: 'publicKey must be 32 bytes, hex-encoded (64 chars)' }, 400);
    }
    
    // Key ID is hash of the key itself
    const keyId = hashContent(publicKey).slice(0, 16);
    
    try {
      insertPublicKey.run(agent.id, keyId, publicKey, algorithm);
    } catch (e: any) {
      if (e.code === 'SQLITE_CONSTRAINT') {
        return c.json({ error: 'Key already registered', keyId }, 409);
      }
      throw e;
    }
    
    console.log(`[secure-journal] ${agent.name} registered key: ${keyId}`);
    
    return c.json({ keyId, status: 'registered' }, 201);
  } catch (err: any) {
    console.error('[secure-journal] Error registering key:', err);
    return c.json({ error: 'Failed to register key' }, 500);
  }
});

/**
 * Create encrypted journal entry
 * Clawtlas stores the blob without being able to read it
 */
secureJournalRoutes.post('/entries', requireAuth, async (c) => {
  try {
    const agent = c.get('agent');
    const body = await c.req.json();
    
    // Extract entry fields
    const {
      entryId,
      encryptedPayload,
      commitments,
      signature,
      disclosedAttributes,
      createdAt,
      aclGrants,  // Optional: encrypted grants for other agents
    } = body;
    
    // Validate required fields
    if (!entryId) {
      return c.json({ error: 'entryId is required' }, 400);
    }
    if (!encryptedPayload?.ciphertext || !encryptedPayload?.nonce) {
      return c.json({ error: 'encryptedPayload with ciphertext and nonce required' }, 400);
    }
    if (!commitments?.contentHash || !commitments?.prevHash || !commitments?.entryHash) {
      return c.json({ error: 'commitments (contentHash, prevHash, entryHash) required' }, 400);
    }
    if (!signature) {
      return c.json({ error: 'signature is required' }, 400);
    }
    if (!createdAt) {
      return c.json({ error: 'createdAt is required (ISO 8601)' }, 400);
    }
    
    // Get agent's public key for verification
    const keyRow = getAgentPublicKey.get(agent.id) as { public_key: string } | undefined;
    if (!keyRow) {
      return c.json({ 
        error: 'No public key registered. POST /journal/v2/keys first' 
      }, 400);
    }
    
    // Reconstruct entry for verification
    const entry: SecureEntry = {
      version: 1,
      entryId,
      agentId: agent.id,
      encryptedPayload,
      commitments,
      signature,
      disclosedAttributes,
      createdAt,
    };
    
    // Get expected prev hash from chain state
    const chainState = getChainState.get(agent.id) as { latest_entry_hash: string } | undefined;
    const expectedPrevHash = chainState?.latest_entry_hash;
    
    // Verify the entry
    const publicKey = hexToBytes(keyRow.public_key);
    const verification = await verifySecureEntry(entry, publicKey, expectedPrevHash);
    
    if (!verification.valid) {
      return c.json({ 
        error: 'Entry verification failed', 
        details: verification.errors 
      }, 400);
    }
    
    // Store entry (encrypted payload stored as JSON string)
    insertSecureEntry.run(
      entryId,
      agent.id,
      JSON.stringify(encryptedPayload),
      commitments.contentHash,
      commitments.prevHash,
      commitments.entryHash,
      signature,
      disclosedAttributes ? JSON.stringify(disclosedAttributes) : null,
      1,  // version
      createdAt
    );
    
    // Update chain state
    upsertChainState.run(agent.id, commitments.entryHash);
    
    // Store ACL grants if provided
    if (aclGrants && Array.isArray(aclGrants)) {
      for (const grant of aclGrants) {
        if (grant.granteeHash && grant.encryptedGrant) {
          insertAclGrant.run(entryId, grant.granteeHash, grant.encryptedGrant);
        }
      }
    }
    
    console.log(`[secure-journal] ${agent.name} stored encrypted entry: ${entryId}`);
    
    return c.json({ 
      entryId, 
      status: 'stored',
      chainPosition: (chainState?.latest_entry_hash ? 'linked' : 'genesis'),
    }, 201);
  } catch (err: any) {
    console.error('[secure-journal] Error creating entry:', err);
    if (err.code === 'SQLITE_CONSTRAINT') {
      return c.json({ error: 'Entry ID already exists' }, 409);
    }
    return c.json({ error: 'Failed to create entry' }, 500);
  }
});

/**
 * Get encrypted entries
 * Returns encrypted blobs - client must decrypt
 */
secureJournalRoutes.get('/entries', async (c) => {
  try {
    const agentId = c.req.query('agent');
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = Math.max(parseInt(c.req.query('offset') || '0'), 0);
    
    if (!agentId) {
      return c.json({ error: 'agent query param required' }, 400);
    }
    
    const entries = getSecureEntriesByAgent.all(agentId, limit, offset) as any[];
    
    return c.json({
      entries: entries.map(e => ({
        entryId: e.entry_id,
        agentId: e.agent_id,
        encryptedPayload: JSON.parse(e.encrypted_payload),
        commitments: {
          contentHash: e.content_hash,
          prevHash: e.prev_hash,
          entryHash: e.entry_hash,
        },
        signature: e.signature,
        disclosedAttributes: e.disclosed_attributes ? JSON.parse(e.disclosed_attributes) : null,
        version: e.version,
        createdAt: e.created_at,
      })),
      pagination: { limit, offset },
    });
  } catch (err: any) {
    console.error('[secure-journal] Error querying entries:', err);
    return c.json({ error: 'Failed to query entries' }, 500);
  }
});

/**
 * Get a single entry by ID
 */
secureJournalRoutes.get('/entries/:id', async (c) => {
  try {
    const entryId = c.req.param('id');
    const entry = getSecureEntry.get(entryId) as any;
    
    if (!entry) {
      return c.json({ error: 'Entry not found' }, 404);
    }
    
    return c.json({
      entryId: entry.entry_id,
      agentId: entry.agent_id,
      encryptedPayload: JSON.parse(entry.encrypted_payload),
      commitments: {
        contentHash: entry.content_hash,
        prevHash: entry.prev_hash,
        entryHash: entry.entry_hash,
      },
      signature: entry.signature,
      disclosedAttributes: entry.disclosed_attributes ? JSON.parse(entry.disclosed_attributes) : null,
      version: entry.version,
      createdAt: entry.created_at,
    });
  } catch (err: any) {
    console.error('[secure-journal] Error getting entry:', err);
    return c.json({ error: 'Failed to get entry' }, 500);
  }
});

/**
 * Verify an entry's signature and chain integrity
 */
secureJournalRoutes.post('/verify', async (c) => {
  try {
    const body = await c.req.json();
    const { entryId, publicKey, prevHash } = body;
    
    if (!entryId) {
      return c.json({ error: 'entryId required' }, 400);
    }
    if (!publicKey) {
      return c.json({ error: 'publicKey required (hex)' }, 400);
    }
    
    // Get entry from DB
    const dbEntry = getSecureEntry.get(entryId) as any;
    if (!dbEntry) {
      return c.json({ error: 'Entry not found' }, 404);
    }
    
    // Reconstruct entry
    const entry: SecureEntry = {
      version: dbEntry.version,
      entryId: dbEntry.entry_id,
      agentId: dbEntry.agent_id,
      encryptedPayload: JSON.parse(dbEntry.encrypted_payload),
      commitments: {
        contentHash: dbEntry.content_hash,
        prevHash: dbEntry.prev_hash,
        entryHash: dbEntry.entry_hash,
      },
      signature: dbEntry.signature,
      disclosedAttributes: dbEntry.disclosed_attributes ? JSON.parse(dbEntry.disclosed_attributes) : null,
      createdAt: dbEntry.created_at,
    };
    
    // Verify
    const verification = await verifySecureEntry(
      entry, 
      hexToBytes(publicKey),
      prevHash
    );
    
    return c.json({
      entryId,
      signatureValid: verification.valid && !verification.errors.includes('Invalid signature'),
      chainValid: !verification.errors.some(e => e.includes('chain') || e.includes('hash')),
      errors: verification.errors,
    });
  } catch (err: any) {
    console.error('[secure-journal] Error verifying entry:', err);
    return c.json({ error: 'Failed to verify entry' }, 500);
  }
});

/**
 * Get agent's chain state
 */
secureJournalRoutes.get('/chain/:agentId', async (c) => {
  try {
    const agentId = c.req.param('agentId');
    const state = getChainState.get(agentId) as any;
    
    if (!state) {
      return c.json({ 
        agentId, 
        latestEntryHash: null, 
        entryCount: 0,
        message: 'No entries yet' 
      });
    }
    
    return c.json({
      agentId,
      latestEntryHash: state.latest_entry_hash,
      entryCount: state.entry_count,
      updatedAt: state.updated_at,
    });
  } catch (err: any) {
    console.error('[secure-journal] Error getting chain state:', err);
    return c.json({ error: 'Failed to get chain state' }, 500);
  }
});

/**
 * Get ACL grant for a specific entry (if you know your grantee hash)
 */
secureJournalRoutes.get('/acl/:entryId/:granteeHash', async (c) => {
  try {
    const entryId = c.req.param('entryId');
    const granteeHash = c.req.param('granteeHash');
    
    const grant = getAclGrant.get(entryId, granteeHash) as { encrypted_grant: string } | undefined;
    
    if (!grant) {
      return c.json({ error: 'No grant found' }, 404);
    }
    
    return c.json({
      entryId,
      granteeHash,
      encryptedGrant: grant.encrypted_grant,
    });
  } catch (err: any) {
    console.error('[secure-journal] Error getting ACL grant:', err);
    return c.json({ error: 'Failed to get grant' }, 500);
  }
});

/**
 * Query by disclosed attributes
 */
secureJournalRoutes.get('/search', async (c) => {
  try {
    const attribute = c.req.query('attribute');
    const agentId = c.req.query('agent');
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    
    if (!attribute) {
      return c.json({ error: 'attribute query param required' }, 400);
    }
    
    // Search in disclosed_attributes JSON
    // Note: This is a basic implementation - production would use JSON functions
    let query = `
      SELECT * FROM secure_entries 
      WHERE disclosed_attributes LIKE ?
    `;
    const params: any[] = [`%"${attribute}"%`];
    
    if (agentId) {
      query += ` AND agent_id = ?`;
      params.push(agentId);
    }
    
    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);
    
    const entries = db.prepare(query).all(...params) as any[];
    
    return c.json({
      query: { attribute, agentId },
      entries: entries.map(e => ({
        entryId: e.entry_id,
        agentId: e.agent_id,
        disclosedAttributes: e.disclosed_attributes ? JSON.parse(e.disclosed_attributes) : null,
        createdAt: e.created_at,
        // Note: encrypted payload not returned in search results
      })),
    });
  } catch (err: any) {
    console.error('[secure-journal] Error searching entries:', err);
    return c.json({ error: 'Failed to search entries' }, 500);
  }
});
