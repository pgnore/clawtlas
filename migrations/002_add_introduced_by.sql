-- Migration: Add introduced_by field for tracking agent introductions
-- This enables the identity bootstrap mechanism

-- Add introduced_by to agents table
ALTER TABLE agents ADD COLUMN introduced_by TEXT REFERENCES agents(id);

-- Add index for querying "who did this agent introduce?"
CREATE INDEX IF NOT EXISTS idx_agents_introduced_by ON agents(introduced_by);

-- Note: This is a soft relationship - the introducer vouches for the new agent
-- Over time (30 days), the vouch weight decays as the agent builds own reputation
