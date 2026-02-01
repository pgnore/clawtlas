/**
 * Targets routes - Digital entities (repos, services, APIs, etc.)
 */

import { Hono } from 'hono';

interface Env {
  DB: D1Database;
}

interface Target {
  id: string;
  type: string;
  identifier: string;
  name: string | null;
  metadata: string | null;
  first_seen: string;
  last_seen: string;
  interaction_count: number;
}

interface AgentTargetStat {
  agent_id: string;
  agent_name: string;
  target_id: string;
  interaction_count: number;
  first_interaction: string;
  last_interaction: string;
}

export const targetsRoutes = new Hono<{ Bindings: Env }>();

// Private target types (not shown publicly)
const PRIVATE_TARGET_TYPES = new Set(['person']);

// Get all targets (the digital map data)
targetsRoutes.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const type = c.req.query('type') || null;
    const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500);
    const offset = parseInt(c.req.query('offset') || '0');

    // Filter out private target types
    let query = 'SELECT * FROM targets WHERE type NOT IN (\'person\')';
    const params: any[] = [];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY interaction_count DESC, last_seen DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const { results: targets } = await db.prepare(query).bind(...params).all<Target>();

    return c.json({
      targets: (targets || []).map(t => ({
        id: t.id,
        type: t.type,
        identifier: t.identifier,
        name: t.name,
        metadata: t.metadata ? JSON.parse(t.metadata) : null,
        firstSeen: t.first_seen,
        lastSeen: t.last_seen,
        interactionCount: t.interaction_count
      }))
    });
  } catch (err: any) {
    console.error('[targets] Error fetching targets:', err);
    return c.json({ error: 'Failed to fetch targets' }, 500);
  }
});

// Get a specific target with its agents
targetsRoutes.get('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const targetId = c.req.param('id');

    const target = await db.prepare('SELECT * FROM targets WHERE id = ?').bind(targetId).first<Target>();

    if (!target) {
      return c.json({ error: 'Target not found' }, 404);
    }

    // Get agents who interacted with this target
    const { results: stats } = await db.prepare(`
      SELECT ats.*, a.name as agent_name
      FROM agent_target_stats ats
      JOIN agents a ON ats.agent_id = a.id
      WHERE ats.target_id = ?
      ORDER BY ats.interaction_count DESC
    `).bind(targetId).all<AgentTargetStat>();

    return c.json({
      target: {
        id: target.id,
        type: target.type,
        identifier: target.identifier,
        name: target.name,
        metadata: target.metadata ? JSON.parse(target.metadata) : null,
        firstSeen: target.first_seen,
        lastSeen: target.last_seen,
        interactionCount: target.interaction_count
      },
      agents: (stats || []).map(s => ({
        agentId: s.agent_id,
        agentName: s.agent_name,
        interactionCount: s.interaction_count,
        firstInteraction: s.first_interaction,
        lastInteraction: s.last_interaction
      }))
    });
  } catch (err: any) {
    console.error('[targets] Error fetching target:', err);
    return c.json({ error: 'Failed to fetch target' }, 500);
  }
});

// Get digital map data (agents + targets + connections)
targetsRoutes.get('/map/data', async (c) => {
  try {
    const db = c.env.DB;

    // Get all agents
    const { results: agents } = await db.prepare(`
      SELECT id, name, status, last_seen FROM agents
    `).all<{ id: string; name: string; status: string; last_seen: string }>();

    // Get all targets (excluding private types like 'person')
    const { results: targets } = await db.prepare(`
      SELECT * FROM targets 
      WHERE type NOT IN ('person')
      ORDER BY interaction_count DESC LIMIT 200
    `).all<Target>();

    // Get all agent-target connections (excluding private types)
    const { results: connections } = await db.prepare(`
      SELECT ats.*, a.name as agent_name, t.type as target_type, t.identifier as target_identifier
      FROM agent_target_stats ats
      JOIN agents a ON ats.agent_id = a.id
      JOIN targets t ON ats.target_id = t.id
      WHERE t.type NOT IN ('person')
      ORDER BY ats.last_interaction DESC
      LIMIT 500
    `).all<any>();

    // Build nodes array (agents + targets)
    const nodes: any[] = [];
    
    // Add agents as nodes
    for (const agent of agents || []) {
      nodes.push({
        id: agent.id,
        type: 'agent',
        name: agent.name,
        status: agent.status,
        lastSeen: agent.last_seen
      });
    }

    // Add targets as nodes
    for (const target of targets || []) {
      nodes.push({
        id: target.id,
        type: target.type,
        name: target.name || target.identifier,
        identifier: target.identifier,
        interactionCount: target.interaction_count,
        lastSeen: target.last_seen
      });
    }

    // Build links array
    const links = (connections || []).map((c: any) => ({
      source: c.agent_id,
      target: c.target_id,
      weight: c.interaction_count,
      lastInteraction: c.last_interaction
    }));

    return c.json({ nodes, links });
  } catch (err: any) {
    console.error('[targets] Error fetching map data:', err);
    return c.json({ error: 'Failed to fetch map data' }, 500);
  }
});

// Get target type stats (excluding private types)
targetsRoutes.get('/stats/types', async (c) => {
  try {
    const db = c.env.DB;

    const { results } = await db.prepare(`
      SELECT type, COUNT(*) as count, SUM(interaction_count) as total_interactions
      FROM targets
      WHERE type NOT IN ('person')
      GROUP BY type
      ORDER BY total_interactions DESC
    `).all<{ type: string; count: number; total_interactions: number }>();

    return c.json({ stats: results || [] });
  } catch (err: any) {
    console.error('[targets] Error fetching stats:', err);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});
