import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = process.env.CLAWTLAS_DB || join(process.cwd(), 'clawtlas.db');
export const db = new Database(dbPath);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  -- Agents table
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    metadata TEXT -- JSON blob for extra info
  );

  -- Journal entries table
  CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    agent_id TEXT NOT NULL REFERENCES agents(id),
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    target_label TEXT,
    session_id TEXT,
    channel TEXT,
    confidence REAL DEFAULT 1.0,
    metadata TEXT, -- JSON blob
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Indexes for common queries
  CREATE INDEX IF NOT EXISTS idx_entries_agent ON journal_entries(agent_id);
  CREATE INDEX IF NOT EXISTS idx_entries_timestamp ON journal_entries(timestamp);
  CREATE INDEX IF NOT EXISTS idx_entries_target ON journal_entries(target_type, target_id);
`);

// Prepared statements for common operations
export const insertAgent = db.prepare(`
  INSERT INTO agents (id, name, token, metadata)
  VALUES (?, ?, ?, ?)
`);

export const getAgentByToken = db.prepare(`
  SELECT * FROM agents WHERE token = ?
`);

export const getAgentById = db.prepare(`
  SELECT * FROM agents WHERE id = ?
`);

export const insertEntry = db.prepare(`
  INSERT INTO journal_entries 
  (id, timestamp, agent_id, action, target_type, target_id, summary, target_label, session_id, channel, confidence, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

export const getEntries = db.prepare(`
  SELECT * FROM journal_entries
  WHERE agent_id = COALESCE(?, agent_id)
  AND timestamp >= COALESCE(?, '1970-01-01')
  ORDER BY timestamp DESC
  LIMIT ?
`);

export const getAllEntries = db.prepare(`
  SELECT je.*, a.name as agent_name
  FROM journal_entries je
  JOIN agents a ON je.agent_id = a.id
  WHERE je.timestamp >= COALESCE(?, '1970-01-01')
  ORDER BY je.timestamp DESC
  LIMIT ?
`);

export const getAgents = db.prepare(`
  SELECT id, name, created_at, metadata FROM agents
`);

export const deleteEntry = db.prepare(`
  DELETE FROM journal_entries WHERE id = ? AND agent_id = ?
`);

console.log(`[db] Initialized at ${dbPath}`);
