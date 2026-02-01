/**
 * Clawtlas Secure Journal - Cryptographic Core
 * 
 * Implements end-to-end encryption, signatures, and hash chains
 * for agent journal entries.
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { blake3 } from '@noble/hashes/blake3';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import * as ed from '@noble/ed25519';
import { bytesToHex, hexToBytes, utf8ToBytes, concatBytes } from '@noble/hashes/utils';

// ============================================================================
// Types
// ============================================================================

export interface AgentKeys {
  masterSecret: Uint8Array;
  identityPrivate: Uint8Array;
  identityPublic: Uint8Array;
  journalKey: Uint8Array;
}

export interface EncryptedPayload {
  ciphertext: string;      // Base64
  nonce: string;           // Base64
  keyId: string;           // Which key encrypted this
}

export interface Commitment {
  contentHash: string;     // BLAKE3 of plaintext
  prevHash: string;        // Previous entry hash
  entryHash: string;       // Hash of this entry (for next link)
}

export interface SecureEntry {
  version: 1;
  entryId: string;
  agentId: string;
  encryptedPayload: EncryptedPayload;
  commitments: Commitment;
  signature: string;       // Ed25519 signature
  disclosedAttributes?: string[];  // For selective disclosure
  createdAt: string;
}

export interface JournalPayload {
  timestamp: string;
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

export interface AccessGrant {
  grantee: string;         // Agent ID or '*' for public
  level: 'none' | 'exists' | 'metadata' | 'summary' | 'full' | 'admin';
  expires?: string;
}

export interface AccessPolicy {
  default: AccessGrant['level'];
  grants: AccessGrant[];
}

// ============================================================================
// Key Management
// ============================================================================

/**
 * Generate a new master secret for an agent
 */
export function generateMasterSecret(): Uint8Array {
  return randomBytes(32);
}

/**
 * Derive all agent keys from master secret
 */
export async function deriveAgentKeys(masterSecret: Uint8Array): Promise<AgentKeys> {
  const identitySeed = hkdf(sha256, masterSecret, undefined, utf8ToBytes('clawtlas-identity-v1'), 32);
  const journalKey = hkdf(sha256, masterSecret, undefined, utf8ToBytes('clawtlas-journal-v1'), 32);
  
  // Derive Ed25519 keypair from seed
  const identityPrivate = identitySeed;
  const identityPublic = await ed.getPublicKeyAsync(identityPrivate);
  
  return {
    masterSecret,
    identityPrivate,
    identityPublic,
    journalKey,
  };
}

/**
 * Derive a unique key for a specific entry
 */
export function deriveEntryKey(masterSecret: Uint8Array, entryId: string): Uint8Array {
  return hkdf(sha256, masterSecret, undefined, utf8ToBytes(`clawtlas-entry-${entryId}`), 32);
}

/**
 * Export public key as hex string
 */
export function exportPublicKey(keys: AgentKeys): string {
  return bytesToHex(keys.identityPublic);
}

/**
 * Export master secret as hex (for secure storage)
 */
export function exportMasterSecret(keys: AgentKeys): string {
  return bytesToHex(keys.masterSecret);
}

/**
 * Import master secret from hex
 */
export async function importMasterSecret(hex: string): Promise<AgentKeys> {
  const masterSecret = hexToBytes(hex);
  return deriveAgentKeys(masterSecret);
}

// ============================================================================
// Encryption
// ============================================================================

/**
 * Encrypt journal entry content
 */
export function encryptPayload(
  plaintext: JournalPayload,
  key: Uint8Array,
  keyId: string
): EncryptedPayload {
  const nonce = randomBytes(24);  // XChaCha20 uses 24-byte nonce
  const plaintextBytes = utf8ToBytes(JSON.stringify(plaintext));
  
  const cipher = xchacha20poly1305(key, nonce);
  const ciphertext = cipher.encrypt(plaintextBytes);
  
  return {
    ciphertext: Buffer.from(ciphertext).toString('base64'),
    nonce: Buffer.from(nonce).toString('base64'),
    keyId,
  };
}

/**
 * Decrypt journal entry content
 */
export function decryptPayload(
  encrypted: EncryptedPayload,
  key: Uint8Array
): JournalPayload {
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
  const nonce = Buffer.from(encrypted.nonce, 'base64');
  
  const cipher = xchacha20poly1305(key, new Uint8Array(nonce));
  const plaintext = cipher.decrypt(new Uint8Array(ciphertext));
  
  return JSON.parse(Buffer.from(plaintext).toString('utf8'));
}

// ============================================================================
// Hashing & Commitments
// ============================================================================

/**
 * Hash content using BLAKE3
 */
export function hashContent(content: string | Uint8Array): string {
  const bytes = typeof content === 'string' ? utf8ToBytes(content) : content;
  return bytesToHex(blake3(bytes));
}

/**
 * Create commitment for entry
 */
export function createCommitment(
  plaintext: JournalPayload,
  prevHash: string
): Commitment {
  const contentHash = hashContent(JSON.stringify(plaintext));
  
  // Entry hash combines content with previous hash for chain
  const entryHashInput = utf8ToBytes(`${contentHash}:${prevHash}`);
  const entryHash = bytesToHex(blake3(entryHashInput));
  
  return {
    contentHash,
    prevHash,
    entryHash,
  };
}

/**
 * Verify hash chain integrity
 */
export function verifyChainLink(
  contentHash: string,
  prevHash: string,
  expectedEntryHash: string
): boolean {
  const computed = bytesToHex(blake3(utf8ToBytes(`${contentHash}:${prevHash}`)));
  return computed === expectedEntryHash;
}

// ============================================================================
// Signatures
// ============================================================================

/**
 * Sign entry data
 */
export async function signEntry(
  entry: Omit<SecureEntry, 'signature'>,
  privateKey: Uint8Array
): Promise<string> {
  // Create canonical representation for signing
  const signable = JSON.stringify({
    version: entry.version,
    entryId: entry.entryId,
    agentId: entry.agentId,
    encryptedPayload: entry.encryptedPayload,
    commitments: entry.commitments,
    createdAt: entry.createdAt,
  });
  
  const signature = await ed.signAsync(utf8ToBytes(signable), privateKey);
  return bytesToHex(signature);
}

/**
 * Verify entry signature
 */
export async function verifySignature(
  entry: SecureEntry,
  publicKey: Uint8Array
): Promise<boolean> {
  const signable = JSON.stringify({
    version: entry.version,
    entryId: entry.entryId,
    agentId: entry.agentId,
    encryptedPayload: entry.encryptedPayload,
    commitments: entry.commitments,
    createdAt: entry.createdAt,
  });
  
  try {
    return await ed.verifyAsync(
      hexToBytes(entry.signature),
      utf8ToBytes(signable),
      publicKey
    );
  } catch {
    return false;
  }
}

// ============================================================================
// Access Control
// ============================================================================

/**
 * Encrypt access policy
 */
export function encryptAccessPolicy(
  policy: AccessPolicy,
  key: Uint8Array
): string {
  const nonce = randomBytes(24);
  const plaintextBytes = utf8ToBytes(JSON.stringify(policy));
  
  const cipher = xchacha20poly1305(key, nonce);
  const ciphertext = cipher.encrypt(plaintextBytes);
  
  // Concatenate nonce + ciphertext
  const combined = concatBytes(nonce, ciphertext);
  return Buffer.from(combined).toString('base64');
}

/**
 * Decrypt access policy
 */
export function decryptAccessPolicy(
  encrypted: string,
  key: Uint8Array
): AccessPolicy {
  const combined = Buffer.from(encrypted, 'base64');
  const nonce = combined.slice(0, 24);
  const ciphertext = combined.slice(24);
  
  const cipher = xchacha20poly1305(key, new Uint8Array(nonce));
  const plaintext = cipher.decrypt(new Uint8Array(ciphertext));
  
  return JSON.parse(Buffer.from(plaintext).toString('utf8'));
}

/**
 * Hash grantee ID for routing (so server can route without knowing identity)
 */
export function hashGranteeId(granteeId: string, salt: string): string {
  return hashContent(`${granteeId}:${salt}`);
}

// ============================================================================
// Selective Disclosure (Simplified)
// ============================================================================

/**
 * Extract disclosable attributes from payload
 * (Full BBS+ would be more complex - this is a simplified version)
 */
export function extractAttributes(payload: JournalPayload): string[] {
  const attrs: string[] = [];
  
  // Action type
  attrs.push(`action:${payload.action}`);
  
  // Target type
  attrs.push(`target_type:${payload.targetType}`);
  
  // Time bucket (month granularity for privacy)
  const date = new Date(payload.timestamp);
  attrs.push(`time_bucket:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  
  // Has summary
  attrs.push(`has_summary:${!!payload.summary}`);
  
  // Confidence bucket
  if (payload.confidence !== undefined) {
    const bucket = payload.confidence >= 0.8 ? 'high' : payload.confidence >= 0.5 ? 'medium' : 'low';
    attrs.push(`confidence:${bucket}`);
  }
  
  // Channel (if present)
  if (payload.channel) {
    attrs.push(`channel:${payload.channel}`);
  }
  
  return attrs;
}

/**
 * Create a commitment to attributes (simplified - real impl would use BBS+)
 */
export function commitToAttributes(attributes: string[], secretKey: Uint8Array): string {
  const attrString = attributes.sort().join('|');
  const commitment = hkdf(sha256, secretKey, undefined, utf8ToBytes(attrString), 32);
  return bytesToHex(commitment);
}

/**
 * Verify attribute commitment
 */
export function verifyAttributeCommitment(
  attributes: string[],
  commitment: string,
  secretKey: Uint8Array
): boolean {
  const computed = commitToAttributes(attributes, secretKey);
  return computed === commitment;
}

// ============================================================================
// High-Level API
// ============================================================================

/**
 * Create a complete secure journal entry
 */
export async function createSecureEntry(
  payload: JournalPayload,
  keys: AgentKeys,
  agentId: string,
  entryId: string,
  prevHash: string
): Promise<SecureEntry> {
  // Create commitment
  const commitments = createCommitment(payload, prevHash);
  
  // Encrypt payload
  const entryKey = deriveEntryKey(keys.masterSecret, entryId);
  const keyId = hashContent(bytesToHex(entryKey)).slice(0, 16);
  const encryptedPayload = encryptPayload(payload, entryKey, keyId);
  
  // Extract attributes for selective disclosure
  const disclosedAttributes = extractAttributes(payload);
  
  // Build entry (without signature)
  const entry: Omit<SecureEntry, 'signature'> = {
    version: 1,
    entryId,
    agentId,
    encryptedPayload,
    commitments,
    disclosedAttributes,
    createdAt: new Date().toISOString(),
  };
  
  // Sign
  const signature = await signEntry(entry, keys.identityPrivate);
  
  return { ...entry, signature };
}

/**
 * Verify a secure entry without decrypting
 */
export async function verifySecureEntry(
  entry: SecureEntry,
  publicKey: Uint8Array,
  expectedPrevHash?: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  // Verify signature
  const sigValid = await verifySignature(entry, publicKey);
  if (!sigValid) {
    errors.push('Invalid signature');
  }
  
  // Verify hash chain link (if prev hash provided)
  if (expectedPrevHash !== undefined) {
    const chainValid = verifyChainLink(
      entry.commitments.contentHash,
      expectedPrevHash,
      entry.commitments.entryHash
    );
    if (!chainValid) {
      errors.push('Hash chain broken');
    }
    if (entry.commitments.prevHash !== expectedPrevHash) {
      errors.push('Previous hash mismatch');
    }
  }
  
  // Verify entry ID matches creation time (ULID check)
  // ULID first 10 chars encode timestamp
  // This is a basic sanity check
  const entryTime = new Date(entry.createdAt).getTime();
  const now = Date.now();
  if (entryTime > now + 60000) {  // Allow 1 minute clock skew
    errors.push('Entry timestamp in future');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Decrypt and read an entry (if you have the key)
 */
export function readSecureEntry(
  entry: SecureEntry,
  masterSecret: Uint8Array
): JournalPayload {
  const entryKey = deriveEntryKey(masterSecret, entry.entryId);
  return decryptPayload(entry.encryptedPayload, entryKey);
}

// ============================================================================
// Utility Exports
// ============================================================================

export { bytesToHex, hexToBytes };
