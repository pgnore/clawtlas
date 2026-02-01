import { Hono } from 'hono';
import { db } from '../db.js';

export const connectionsRoutes = new Hono();

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
connectionsRoutes.get('/', (c) => {
  try {
    const since = c.req.query('since') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const agentId = c.req.query('agent') || null;
    
    // Get all entries in time window
    const query = agentId
      ? db.prepare(`
          SELECT agent_id, action, target_type, target_id, target_label, timestamp
          FROM journal_entries
          WHERE timestamp >= ? AND agent_id = ?
        `)
      : db.prepare(`
          SELECT agent_id, action, target_type, target_id, target_label, timestamp
          FROM journal_entries
          WHERE timestamp >= ?
        `);
    
    const entries = (agentId ? query.all(since, agentId) : query.all(since)) as any[];

    // Aggregate connections with decay
    const now = Date.now();
    const connectionMap = new Map<string, Connection>();

    for (const entry of entries) {
      const key = `${entry.agent_id}:${entry.target_type}:${entry.target_id}`;
      
      // Calculate decayed weight
      const entryTime = new Date(entry.timestamp).getTime();
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
          targetLabel: entry.target_label,
          weight: decayedWeight,
          lastInteraction: entry.timestamp,
          interactions: 1
        });
      }
    }

    // Filter out very weak connections
    const connections = [...connectionMap.values()]
      .filter(c => c.weight >= 0.1)
      .sort((a, b) => b.weight - a.weight);

    // Build node list
    const agents = db.prepare('SELECT id, name FROM agents').all() as any[];
    const agentMap = new Map(agents.map(a => [a.id, a.name]));
    
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
      connections: connections.map(c => ({
        source: c.source,
        target: `${c.targetType}:${c.target}`,
        weight: Math.round(c.weight * 100) / 100,
        interactions: c.interactions,
        lastInteraction: c.lastInteraction
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
