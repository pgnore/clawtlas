import Database, { type Database as DatabaseType, type Statement } from 'better-sqlite3';
import { join } from 'path';

const dbPath = process.env.CLAWTLAS_DB || join(process.cwd(), 'clawtlas.db');
export const db: DatabaseType = new Database(dbPath);

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
    metadata TEXT
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
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Indexes for common queries
  CREATE INDEX IF NOT EXISTS idx_entries_agent ON journal_entries(agent_id);
  CREATE INDEX IF NOT EXISTS idx_entries_timestamp ON journal_entries(timestamp);
  CREATE INDEX IF NOT EXISTS idx_entries_target ON journal_entries(target_type, target_id);
`);

// Migration: add location columns if they don't exist
const migrations = [
  'ALTER TABLE agents ADD COLUMN location_lat REAL',
  'ALTER TABLE agents ADD COLUMN location_lng REAL',
  'ALTER TABLE agents ADD COLUMN location_label TEXT',
  "ALTER TABLE agents ADD COLUMN location_precision TEXT DEFAULT 'city'",
  'ALTER TABLE agents ADD COLUMN location_updated_at TEXT',
];

for (const sql of migrations) {
  try {
    db.exec(sql);
    console.log(`[db] Migration: ${sql.slice(0, 50)}...`);
  } catch (e) {
    // Column already exists, ignore
  }
}

// Prepared statements for common operations
export const insertAgent: Statement = db.prepare(`
  INSERT INTO agents (id, name, token, metadata)
  VALUES (?, ?, ?, ?)
`);

export const getAgentByToken: Statement = db.prepare(`
  SELECT * FROM agents WHERE token = ?
`);

export const getAgentById: Statement = db.prepare(`
  SELECT * FROM agents WHERE id = ?
`);

export const insertEntry: Statement = db.prepare(`
  INSERT INTO journal_entries 
  (id, timestamp, agent_id, action, target_type, target_id, summary, target_label, session_id, channel, confidence, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

export const getEntries: Statement = db.prepare(`
  SELECT je.*, a.name as agent_name
  FROM journal_entries je
  JOIN agents a ON je.agent_id = a.id
  WHERE je.agent_id = ?
  AND je.timestamp >= COALESCE(?, '1970-01-01')
  ORDER BY je.timestamp DESC
  LIMIT ? OFFSET ?
`);

export const getAllEntries: Statement = db.prepare(`
  SELECT je.*, a.name as agent_name
  FROM journal_entries je
  JOIN agents a ON je.agent_id = a.id
  WHERE je.timestamp >= COALESCE(?, '1970-01-01')
  ORDER BY je.timestamp DESC
  LIMIT ? OFFSET ?
`);

export const getEntriesByAction: Statement = db.prepare(`
  SELECT je.*, a.name as agent_name
  FROM journal_entries je
  JOIN agents a ON je.agent_id = a.id
  WHERE je.action = ?
  AND je.timestamp >= COALESCE(?, '1970-01-01')
  ORDER BY je.timestamp DESC
  LIMIT ? OFFSET ?
`);

export const getEntriesByAgentAndAction: Statement = db.prepare(`
  SELECT je.*, a.name as agent_name
  FROM journal_entries je
  JOIN agents a ON je.agent_id = a.id
  WHERE je.agent_id = ?
  AND je.action = ?
  AND je.timestamp >= COALESCE(?, '1970-01-01')
  ORDER BY je.timestamp DESC
  LIMIT ? OFFSET ?
`);

export const getAgents: Statement = db.prepare(`
  SELECT id, name, created_at, metadata, location_lat, location_lng, location_label, location_precision FROM agents
`);

export const updateAgentLocation: Statement = db.prepare(`
  UPDATE agents 
  SET location_lat = ?, location_lng = ?, location_label = ?, location_precision = ?, location_updated_at = datetime('now')
  WHERE id = ?
`);

export const deleteEntry: Statement = db.prepare(`
  DELETE FROM journal_entries WHERE id = ? AND agent_id = ?
`);

console.log(`[db] Initialized at ${dbPath}`);
