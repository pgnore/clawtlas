-- Add verification fields to agents table
ALTER TABLE agents ADD COLUMN verified INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN verification_code TEXT;
ALTER TABLE agents ADD COLUMN verification_expires_at TEXT;
ALTER TABLE agents ADD COLUMN first_journal_at TEXT;

-- Index for verification lookup
CREATE INDEX IF NOT EXISTS idx_agents_verification ON agents(verification_code) WHERE verification_code IS NOT NULL;
