/**
 * Test suite for Clawtlas Secure Journal crypto module
 * 
 * Run with: npm run test:crypto
 */

import {
  generateMasterSecret,
  deriveAgentKeys,
  exportMasterSecret,
  exportPublicKey,
  importMasterSecret,
  encryptPayload,
  decryptPayload,
  deriveEntryKey,
  createCommitment,
  verifyChainLink,
  signEntry,
  verifySignature,
  createSecureEntry,
  verifySecureEntry,
  readSecureEntry,
  extractAttributes,
  encryptAccessPolicy,
  decryptAccessPolicy,
  JournalPayload,
  AccessPolicy,
} from './index.js';

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => Promise<void> | void) {
  return async () => {
    try {
      await fn();
      console.log(`${GREEN}✓${RESET} ${name}`);
      passed++;
    } catch (err: any) {
      console.log(`${RED}✗${RESET} ${name}`);
      console.log(`  ${RED}${err.message}${RESET}`);
      failed++;
    }
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

// ============================================================================
// Tests
// ============================================================================

const tests = [
  // Key Generation
  test('generates master secret (32 bytes)', () => {
    const secret = generateMasterSecret();
    assertEqual(secret.length, 32, 'Secret length');
  }),

  test('derives agent keys from master secret', async () => {
    const secret = generateMasterSecret();
    const keys = await deriveAgentKeys(secret);
    
    assert(keys.masterSecret === secret, 'Master secret preserved');
    assertEqual(keys.identityPrivate.length, 32, 'Identity private key length');
    assertEqual(keys.identityPublic.length, 32, 'Identity public key length');
    assertEqual(keys.journalKey.length, 32, 'Journal key length');
  }),

  test('exports and imports master secret', async () => {
    const secret = generateMasterSecret();
    const keys = await deriveAgentKeys(secret);
    const exported = exportMasterSecret(keys);
    
    assertEqual(exported.length, 64, 'Exported hex length');
    
    const reimported = await importMasterSecret(exported);
    assertEqual(exportPublicKey(reimported), exportPublicKey(keys), 'Same public key after reimport');
  }),

  // Encryption
  test('encrypts and decrypts payload', async () => {
    const keys = await deriveAgentKeys(generateMasterSecret());
    
    const payload: JournalPayload = {
      timestamp: new Date().toISOString(),
      action: 'message_sent',
      targetType: 'person',
      targetId: 'alice',
      summary: 'Said hello',
    };
    
    const encrypted = encryptPayload(payload, keys.journalKey, 'test-key');
    assert(encrypted.ciphertext.length > 0, 'Ciphertext exists');
    assert(encrypted.nonce.length > 0, 'Nonce exists');
    
    const decrypted = decryptPayload(encrypted, keys.journalKey);
    assertEqual(decrypted.action, payload.action, 'Action matches');
    assertEqual(decrypted.summary, payload.summary, 'Summary matches');
  }),

  test('decryption fails with wrong key', async () => {
    const keys1 = await deriveAgentKeys(generateMasterSecret());
    const keys2 = await deriveAgentKeys(generateMasterSecret());
    
    const payload: JournalPayload = {
      timestamp: new Date().toISOString(),
      action: 'file_read',
      targetType: 'file',
      targetId: '/secret.txt',
      summary: 'Read secret file',
    };
    
    const encrypted = encryptPayload(payload, keys1.journalKey, 'test');
    
    let threw = false;
    try {
      decryptPayload(encrypted, keys2.journalKey);
    } catch {
      threw = true;
    }
    assert(threw, 'Should throw with wrong key');
  }),

  // Per-entry keys
  test('derives unique keys per entry', async () => {
    const secret = generateMasterSecret();
    
    const key1 = deriveEntryKey(secret, 'entry-001');
    const key2 = deriveEntryKey(secret, 'entry-002');
    
    assert(key1.toString() !== key2.toString(), 'Keys should be different');
    
    // Same entry ID should give same key
    const key1again = deriveEntryKey(secret, 'entry-001');
    assertEqual(key1.toString(), key1again.toString(), 'Same entry ID gives same key');
  }),

  // Hash Chain
  test('creates valid commitment', () => {
    const payload: JournalPayload = {
      timestamp: new Date().toISOString(),
      action: 'search',
      targetType: 'topic',
      targetId: 'quantum computing',
      summary: 'Researched topic',
    };
    
    const commitment = createCommitment(payload, 'genesis');
    
    assert(commitment.contentHash.length === 64, 'Content hash is 64 hex chars');
    assertEqual(commitment.prevHash, 'genesis', 'Prev hash preserved');
    assert(commitment.entryHash.length === 64, 'Entry hash is 64 hex chars');
  }),

  test('verifies hash chain link', () => {
    const payload: JournalPayload = {
      timestamp: new Date().toISOString(),
      action: 'url_fetch',
      targetType: 'url',
      targetId: 'https://example.com',
      summary: 'Fetched page',
    };
    
    const commitment = createCommitment(payload, 'prev-hash-123');
    
    const valid = verifyChainLink(
      commitment.contentHash,
      'prev-hash-123',
      commitment.entryHash
    );
    assert(valid, 'Chain link should be valid');
    
    const invalid = verifyChainLink(
      commitment.contentHash,
      'wrong-prev-hash',
      commitment.entryHash
    );
    assert(!invalid, 'Chain link should be invalid with wrong prev hash');
  }),

  // Signatures
  test('signs and verifies entry', async () => {
    const keys = await deriveAgentKeys(generateMasterSecret());
    
    const entry = {
      version: 1 as const,
      entryId: 'test-entry-001',
      agentId: 'agent-123',
      encryptedPayload: {
        ciphertext: 'dummy',
        nonce: 'dummy',
        keyId: 'key-001',
      },
      commitments: {
        contentHash: 'abc123',
        prevHash: 'genesis',
        entryHash: 'def456',
      },
      createdAt: new Date().toISOString(),
    };
    
    const signature = await signEntry(entry, keys.identityPrivate);
    assert(signature.length === 128, 'Signature is 64 bytes hex');
    
    const fullEntry = { ...entry, signature };
    const valid = await verifySignature(fullEntry, keys.identityPublic);
    assert(valid, 'Signature should be valid');
  }),

  test('signature verification fails for tampered entry', async () => {
    const keys = await deriveAgentKeys(generateMasterSecret());
    
    const entry = {
      version: 1 as const,
      entryId: 'test-entry-001',
      agentId: 'agent-123',
      encryptedPayload: {
        ciphertext: 'dummy',
        nonce: 'dummy',
        keyId: 'key-001',
      },
      commitments: {
        contentHash: 'abc123',
        prevHash: 'genesis',
        entryHash: 'def456',
      },
      createdAt: new Date().toISOString(),
    };
    
    const signature = await signEntry(entry, keys.identityPrivate);
    
    // Tamper with entry
    const tampered = { 
      ...entry, 
      signature,
      entryId: 'tampered-entry',  // Changed!
    };
    
    const valid = await verifySignature(tampered, keys.identityPublic);
    assert(!valid, 'Tampered entry should fail verification');
  }),

  // Full Entry Flow
  test('creates and verifies complete secure entry', async () => {
    const keys = await deriveAgentKeys(generateMasterSecret());
    const agentId = 'test-agent';
    const entryId = 'entry-001';
    
    const payload: JournalPayload = {
      timestamp: new Date().toISOString(),
      action: 'message_sent',
      targetType: 'person',
      targetId: 'bob',
      summary: 'Sent message to Bob',
      confidence: 0.95,
    };
    
    const entry = await createSecureEntry(payload, keys, agentId, entryId, 'genesis');
    
    assertEqual(entry.version, 1, 'Version');
    assertEqual(entry.entryId, entryId, 'Entry ID');
    assertEqual(entry.agentId, agentId, 'Agent ID');
    assert(entry.encryptedPayload.ciphertext.length > 0, 'Has ciphertext');
    assert(entry.signature.length > 0, 'Has signature');
    
    // Verify
    const verification = await verifySecureEntry(entry, keys.identityPublic, 'genesis');
    assert(verification.valid, 'Entry should be valid');
    assertEqual(verification.errors.length, 0, 'No errors');
    
    // Decrypt and read
    const decrypted = readSecureEntry(entry, keys.masterSecret);
    assertEqual(decrypted.action, 'message_sent', 'Action matches');
    assertEqual(decrypted.summary, 'Sent message to Bob', 'Summary matches');
  }),

  test('detects broken hash chain', async () => {
    const keys = await deriveAgentKeys(generateMasterSecret());
    
    const payload: JournalPayload = {
      timestamp: new Date().toISOString(),
      action: 'file_write',
      targetType: 'file',
      targetId: '/notes.txt',
      summary: 'Wrote notes',
    };
    
    const entry = await createSecureEntry(payload, keys, 'agent', 'entry-001', 'correct-prev');
    
    // Verify with wrong prev hash
    const verification = await verifySecureEntry(entry, keys.identityPublic, 'wrong-prev');
    assert(!verification.valid, 'Should detect chain break');
    assert(verification.errors.some(e => e.includes('hash')), 'Error mentions hash');
  }),

  // Selective Disclosure
  test('extracts attributes from payload', () => {
    const payload: JournalPayload = {
      timestamp: '2025-01-15T12:00:00Z',
      action: 'message_sent',
      targetType: 'person',
      targetId: 'alice',
      summary: 'Hello!',
      confidence: 0.9,
      channel: 'discord',
    };
    
    const attrs = extractAttributes(payload);
    
    assert(attrs.includes('action:message_sent'), 'Has action');
    assert(attrs.includes('target_type:person'), 'Has target type');
    assert(attrs.includes('time_bucket:2025-01'), 'Has time bucket');
    assert(attrs.includes('has_summary:true'), 'Has summary flag');
    assert(attrs.includes('confidence:high'), 'Has confidence');
    assert(attrs.includes('channel:discord'), 'Has channel');
  }),

  // Access Control
  test('encrypts and decrypts access policy', async () => {
    const keys = await deriveAgentKeys(generateMasterSecret());
    
    const policy: AccessPolicy = {
      default: 'none',
      grants: [
        { grantee: 'agent-bob', level: 'full' },
        { grantee: '*', level: 'exists' },
      ],
    };
    
    const encrypted = encryptAccessPolicy(policy, keys.journalKey);
    assert(encrypted.length > 0, 'Has encrypted policy');
    
    const decrypted = decryptAccessPolicy(encrypted, keys.journalKey);
    assertEqual(decrypted.default, 'none', 'Default level');
    assertEqual(decrypted.grants.length, 2, 'Grant count');
    assertEqual(decrypted.grants[0].grantee, 'agent-bob', 'Grantee');
  }),
];

// ============================================================================
// Run Tests
// ============================================================================

async function run() {
  console.log(`\n${YELLOW}Clawtlas Secure Journal - Crypto Tests${RESET}\n`);
  console.log('─'.repeat(50));
  
  for (const t of tests) {
    await t();
  }
  
  console.log('─'.repeat(50));
  console.log(`\nResults: ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : ''}${failed} failed${RESET}\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(console.error);
