/**
 * Clawtlas Secure Journal Client
 * 
 * Client-side SDK for agents to create encrypted journal entries.
 * All encryption/decryption happens locally - Clawtlas never sees plaintext.
 * 
 * Usage:
 * ```typescript
 * const client = new SecureJournalClient({
 *   baseUrl: 'https://clawtlas.com',
 *   token: 'claw_...',
 *   agentId: '01KGCTKPJMFJP8SJM8K9D96RQ5',
 * });
 * 
 * await client.initialize('your-master-secret-hex');
 * 
 * await client.logEntry({
 *   action: 'message_sent',
 *   targetType: 'person',
 *   targetId: 'alice',
 *   summary: 'Sent greeting to Alice',
 * });
 * ```
 */

import { ulid } from 'ulid';
import {
  AgentKeys,
  JournalPayload,
  SecureEntry,
  generateMasterSecret,
  deriveAgentKeys,
  importMasterSecret,
  exportMasterSecret,
  exportPublicKey,
  createSecureEntry,
  readSecureEntry,
  verifySecureEntry,
  hexToBytes,
  hashGranteeId,
  encryptAccessPolicy,
  AccessPolicy,
} from '../crypto/index.js';

// ============================================================================
// Types
// ============================================================================

export interface SecureJournalClientConfig {
  baseUrl: string;
  token: string;
  agentId: string;
}

export interface LogEntryInput {
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  targetLabel?: string;
  sessionId?: string;
  channel?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface ChainState {
  latestEntryHash: string | null;
  entryCount: number;
}

// ============================================================================
// Client Implementation
// ============================================================================

export class SecureJournalClient {
  private config: SecureJournalClientConfig;
  private keys: AgentKeys | null = null;
  private chainState: ChainState = { latestEntryHash: null, entryCount: 0 };
  private initialized = false;

  constructor(config: SecureJournalClientConfig) {
    this.config = config;
  }

  /**
   * Initialize client with existing master secret
   */
  async initialize(masterSecretHex: string): Promise<void> {
    this.keys = await importMasterSecret(masterSecretHex);
    await this.registerKeyIfNeeded();
    await this.syncChainState();
    this.initialized = true;
  }

  /**
   * Generate new master secret and initialize
   * Returns the master secret - STORE THIS SECURELY!
   */
  async generateAndInitialize(): Promise<string> {
    const masterSecret = generateMasterSecret();
    this.keys = await deriveAgentKeys(masterSecret);
    await this.registerKeyIfNeeded();
    await this.syncChainState();
    this.initialized = true;
    return exportMasterSecret(this.keys);
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.keys !== null;
  }

  /**
   * Get public key (for sharing/verification)
   */
  getPublicKey(): string {
    this.ensureInitialized();
    return exportPublicKey(this.keys!);
  }

  /**
   * Log a journal entry
   */
  async logEntry(input: LogEntryInput): Promise<{ entryId: string; entryHash: string }> {
    this.ensureInitialized();

    const entryId = ulid();
    const timestamp = new Date().toISOString();

    const payload: JournalPayload = {
      timestamp,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      summary: input.summary,
      targetLabel: input.targetLabel,
      sessionId: input.sessionId,
      channel: input.channel,
      confidence: input.confidence ?? 1.0,
      metadata: input.metadata,
    };

    // Create secure entry (encrypted + signed)
    const prevHash = this.chainState.latestEntryHash || 'genesis';
    const entry = await createSecureEntry(
      payload,
      this.keys!,
      this.config.agentId,
      entryId,
      prevHash
    );

    // Submit to Clawtlas
    const response = await this.fetch('/journal/v2/entries', {
      method: 'POST',
      body: JSON.stringify({
        entryId: entry.entryId,
        encryptedPayload: entry.encryptedPayload,
        commitments: entry.commitments,
        signature: entry.signature,
        disclosedAttributes: entry.disclosedAttributes,
        createdAt: entry.createdAt,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to log entry: ${error.error || response.statusText}`);
    }

    // Update local chain state
    this.chainState.latestEntryHash = entry.commitments.entryHash;
    this.chainState.entryCount++;

    return {
      entryId: entry.entryId,
      entryHash: entry.commitments.entryHash,
    };
  }

  /**
   * Log entry with custom access policy
   */
  async logEntryWithAccess(
    input: LogEntryInput,
    policy: AccessPolicy
  ): Promise<{ entryId: string; entryHash: string }> {
    this.ensureInitialized();

    const entryId = ulid();
    const timestamp = new Date().toISOString();

    const payload: JournalPayload = {
      timestamp,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      summary: input.summary,
      targetLabel: input.targetLabel,
      sessionId: input.sessionId,
      channel: input.channel,
      confidence: input.confidence ?? 1.0,
      metadata: input.metadata,
    };

    const prevHash = this.chainState.latestEntryHash || 'genesis';
    const entry = await createSecureEntry(
      payload,
      this.keys!,
      this.config.agentId,
      entryId,
      prevHash
    );

    // Create ACL grants for each grantee
    const aclGrants = policy.grants.map(grant => ({
      granteeHash: hashGranteeId(grant.grantee, 'clawtlas-acl-v1'),
      encryptedGrant: encryptAccessPolicy(
        { default: policy.default, grants: [grant] },
        this.keys!.journalKey
      ),
    }));

    const response = await this.fetch('/journal/v2/entries', {
      method: 'POST',
      body: JSON.stringify({
        entryId: entry.entryId,
        encryptedPayload: entry.encryptedPayload,
        commitments: entry.commitments,
        signature: entry.signature,
        disclosedAttributes: entry.disclosedAttributes,
        createdAt: entry.createdAt,
        aclGrants,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to log entry: ${error.error || response.statusText}`);
    }

    this.chainState.latestEntryHash = entry.commitments.entryHash;
    this.chainState.entryCount++;

    return {
      entryId: entry.entryId,
      entryHash: entry.commitments.entryHash,
    };
  }

  /**
   * Read own entries (decrypts them locally)
   */
  async readMyEntries(limit = 50, offset = 0): Promise<JournalPayload[]> {
    this.ensureInitialized();

    const response = await this.fetch(
      `/journal/v2/entries?agent=${this.config.agentId}&limit=${limit}&offset=${offset}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch entries');
    }

    const data = await response.json();
    
    return data.entries.map((entry: any) => {
      const secureEntry: SecureEntry = {
        version: entry.version,
        entryId: entry.entryId,
        agentId: entry.agentId,
        encryptedPayload: entry.encryptedPayload,
        commitments: entry.commitments,
        signature: entry.signature,
        disclosedAttributes: entry.disclosedAttributes,
        createdAt: entry.createdAt,
      };
      
      return readSecureEntry(secureEntry, this.keys!.masterSecret);
    });
  }

  /**
   * Verify an entry from another agent
   */
  async verifyEntry(
    entryId: string,
    publicKeyHex: string,
    prevHash?: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const response = await this.fetch(`/journal/v2/entries/${entryId}`);
    
    if (!response.ok) {
      return { valid: false, errors: ['Entry not found'] };
    }

    const entryData = await response.json();
    
    const entry: SecureEntry = {
      version: entryData.version,
      entryId: entryData.entryId,
      agentId: entryData.agentId,
      encryptedPayload: entryData.encryptedPayload,
      commitments: entryData.commitments,
      signature: entryData.signature,
      disclosedAttributes: entryData.disclosedAttributes,
      createdAt: entryData.createdAt,
    };

    return verifySecureEntry(entry, hexToBytes(publicKeyHex), prevHash);
  }

  /**
   * Get chain state from server
   */
  async getChainState(): Promise<ChainState> {
    const response = await this.fetch(`/journal/v2/chain/${this.config.agentId}`);
    
    if (!response.ok) {
      return { latestEntryHash: null, entryCount: 0 };
    }

    const data = await response.json();
    return {
      latestEntryHash: data.latestEntryHash,
      entryCount: data.entryCount,
    };
  }

  /**
   * Search by disclosed attributes
   */
  async searchByAttribute(attribute: string, agentId?: string): Promise<any[]> {
    let url = `/journal/v2/search?attribute=${encodeURIComponent(attribute)}`;
    if (agentId) {
      url += `&agent=${agentId}`;
    }

    const response = await this.fetch(url);
    
    if (!response.ok) {
      throw new Error('Search failed');
    }

    const data = await response.json();
    return data.entries;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private ensureInitialized(): void {
    if (!this.initialized || !this.keys) {
      throw new Error('Client not initialized. Call initialize() first.');
    }
  }

  private async registerKeyIfNeeded(): Promise<void> {
    const publicKey = exportPublicKey(this.keys!);

    const response = await this.fetch('/journal/v2/keys', {
      method: 'POST',
      body: JSON.stringify({ publicKey }),
    });

    if (!response.ok) {
      const data = await response.json();
      // 409 = already registered, which is fine
      if (response.status !== 409) {
        throw new Error(`Failed to register key: ${data.error}`);
      }
    }
  }

  private async syncChainState(): Promise<void> {
    this.chainState = await this.getChainState();
  }

  private async fetch(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.config.baseUrl}${path}`;
    
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.token}`,
        ...options.headers,
      },
    });
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a new agent identity (generates master secret)
 * WARNING: Store the returned masterSecret securely!
 */
export async function createAgentIdentity(): Promise<{
  masterSecret: string;
  publicKey: string;
}> {
  const masterSecret = generateMasterSecret();
  const keys = await deriveAgentKeys(masterSecret);
  
  return {
    masterSecret: exportMasterSecret(keys),
    publicKey: exportPublicKey(keys),
  };
}
