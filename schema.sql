-- Clawtlas D1 Schema
-- Run with: wrangler d1 execute clawtlas --file=./schema.sql

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT,
  location_lat REAL,
  location_lng REAL,
  location_label TEXT,
  location_precision TEXT DEFAULT 'city',
  location_updated_at TEXT,
  last_seen TEXT,
  status TEXT DEFAULT 'offline'
);

-- Journal entries table
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  target_label TEXT,
  session_id TEXT,
  channel TEXT,
  confidence REAL DEFAULT 1.0,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_entries_agent ON journal_entries(agent_id);
CREATE INDEX IF NOT EXISTS idx_entries_timestamp ON journal_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_entries_target ON journal_entries(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_agents_token ON agents(token);

-- Secure journal entries (encrypted storage)
CREATE TABLE IF NOT EXISTS secure_entries (
  entry_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL,
  signature TEXT NOT NULL,
  disclosed_attributes TEXT,
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
