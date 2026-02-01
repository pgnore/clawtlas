/**
 * Connections routes - Cloudflare D1 edition
 * Builds the connection graph from journal entries
 */

import { Hono } from 'hono';

// Cloudflare Workers bindings
interface Env {
  DB: D1Database;
}

interface JournalEntry {
  agent_id: string;
  action: string;
  target_type: string;
  target_id: string;
  target_label?: string;
  timestamp: string;
}

interface Agent {
  id: string;
  name: string;
}

export const connectionsRoutes = new Hono<{ Bindings: Env }>();

// Decay constant: ln(2) / 72 hours
const DECAY_LAMBDA = Math.log(2) / 72;

// Base weights by action
const ACTION_WEIGHTS: Record<string, number> = {
  message_sent: 3,
  message_received: 3,
  file_write: 2,
  file_read: 1,
  calendar_write: 2,
  calendar_read: 1,
  search: 1,
  url_fetch: 1,
  tool_use: 1,
  memory_access: 1
};

interface Connection {
  source: string;
  target: string;
  targetType: string;
  targetLabel: string | null;
  weight: number;
  lastInteraction: string;
  interactions: number;
}

// Get connection graph with decay applied
connectionsRoutes.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const since = c.req.query('since') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const at = c.req.query('at'); // Optional: view graph as of this time
    const agentId = c.req.query('agent') || null;
    
    // The reference time for decay calculation
    const viewTime = at ? new Date(at).getTime() : Date.now();
    const until = at || new Date().toISOString();
    
    // Get all entries in time window (up to viewTime if specified)
    let query = `
      SELECT agent_id, action, target_type, target_id, target_label, timestamp
      FROM journal_entries
      WHERE timestamp >= ? AND timestamp <= ?
    `;
    const params: any[] = [since, until];
    
    if (agentId) {
      query += ` AND agent_id = ?`;
      params.push(agentId);
    }
    
    const stmt = db.prepare(query);
    const { results: entries } = await stmt.bind(...params).all<JournalEntry>();

    // Aggregate connections with decay (relative to viewTime)
    const now = viewTime;
    const connectionMap = new Map<string, Connection>();

    for (const entry of entries || []) {
      const key = `${entry.agent_id}:${entry.target_type}:${entry.target_id}`;
      
      // Calculate decayed weight
      const entryTime = new Date(entry.timestamp).getTime();
      // Skip future entries (shouldn't happen, but safety check)
      if (entryTime > now) continue;
      const hoursAgo = (now - entryTime) / (1000 * 60 * 60);
      const baseWeight = ACTION_WEIGHTS[entry.action] || 1;
      const decayedWeight = baseWeight * Math.exp(-DECAY_LAMBDA * hoursAgo);

      const existing = connectionMap.get(key);
      if (existing) {
        existing.weight = Math.min(10, existing.weight + decayedWeight); // Cap at 10
        existing.interactions++;
        if (entry.timestamp > existing.lastInteraction) {
          existing.lastInteraction = entry.timestamp;
          if (entry.target_label) existing.targetLabel = entry.target_label;
        }
      } else {
        connectionMap.set(key, {
          source: entry.agent_id,
          target: entry.target_id,
          targetType: entry.target_type,
          targetLabel: entry.target_label || null,
          weight: decayedWeight,
          lastInteraction: entry.timestamp,
          interactions: 1
        });
      }
    }

    // Filter out very weak connections
    const connections = [...connectionMap.values()]
      .filter(conn => conn.weight >= 0.1)
      .sort((a, b) => b.weight - a.weight);

    // Build node list
    const { results: agents } = await db.prepare('SELECT id, name FROM agents').all<Agent>();
    const agentMap = new Map((agents || []).map(a => [a.id, a.name]));
    
    const nodeSet = new Set<string>();
    const nodes: any[] = [];

    // Add agent nodes
    for (const conn of connections) {
      if (!nodeSet.has(conn.source)) {
        nodeSet.add(conn.source);
        nodes.push({
          id: conn.source,
          type: 'agent',
          label: agentMap.get(conn.source) || conn.source
        });
      }
    }

    // Add target nodes
    for (const conn of connections) {
      const targetKey = `${conn.targetType}:${conn.target}`;
      if (!nodeSet.has(targetKey)) {
        nodeSet.add(targetKey);
        nodes.push({
          id: targetKey,
          type: conn.targetType,
          label: conn.targetLabel || conn.target
        });
      }
    }

    return c.json({
      nodes,
      connections: connections.map(conn => ({
        source: conn.source,
        target: `${conn.targetType}:${conn.target}`,
        weight: Math.round(conn.weight * 100) / 100,
        interactions: conn.interactions,
        lastInteraction: conn.lastInteraction
      })),
      meta: {
        since,
        decayHalfLife: '72h',
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error('[connections] Error building graph:', err);
    return c.json({ error: 'Failed to build connection graph' }, 500);
  }
});
