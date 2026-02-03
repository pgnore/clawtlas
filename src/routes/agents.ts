/**
 * Agent routes - Cloudflare D1 edition
 */

import { Hono } from 'hono';
import { ulid } from 'ulid';
import { registrationRateLimitMiddleware } from '../middleware/security.js';

// Cloudflare Workers bindings
interface Env {
  DB: D1Database;
}

interface Agent {
  id: string;
  name: string;
  token: string;
  created_at: string;
  metadata?: string;
  location_lat?: number;
  location_lng?: number;
  location_label?: string;
  location_precision?: string;
  location_updated_at?: string;
  last_seen?: string;
}

// Compute presence status from last_seen timestamp
function getPresenceStatus(lastSeen: string | null): 'online' | 'recent' | 'offline' {
  if (!lastSeen) return 'offline';
  const lastSeenTime = new Date(lastSeen + 'Z').getTime();
  const now = Date.now();
  const diffMinutes = (now - lastSeenTime) / (1000 * 60);
  if (diffMinutes < 5) return 'online';
  if (diffMinutes < 60) return 'recent';
  return 'offline';
}

export const agentRoutes = new Hono<{ Bindings: Env }>();

// Generate a secure token
function generateToken(): string {
  const tokenBytes = new Uint8Array(24);
  crypto.getRandomValues(tokenBytes);
  return `claw_${btoa(String.fromCharCode(...tokenBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;
}

// Register a new agent
agentRoutes.post('/', registrationRateLimitMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const body = await c.req.json();
    const { name, metadata, location } = body;

    if (!name || typeof name !== 'string' || name.length < 1) {
      return c.json({ error: 'name is required (string, min 1 char)' }, 400);
    }

    const id = ulid();
    const token = generateToken();

    await db.prepare(`
      INSERT INTO agents (id, name, token, metadata)
      VALUES (?, ?, ?, ?)
    `).bind(
      id,
      name.trim(),
      token,
      metadata ? JSON.stringify(metadata) : null
    ).run();

    // If location provided at registration, set it
    if (location && location.lat !== undefined && location.lng !== undefined) {
      await db.prepare(`
        UPDATE agents 
        SET location_lat = ?, location_lng = ?, location_label = ?, location_precision = ?, location_updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        location.lat,
        location.lng,
        location.label || null,
        location.precision || 'city',
        id
      ).run();
    }

    console.log(`[agents] New agent registered: ${name.trim()} (${id})`);

    return c.json({
      agent: {
        id,
        name: name.trim(),
        token // Only returned once at creation!
      },
      message: 'Welcome to Clawtlas! Save your token.'
    }, 201);
  } catch (err: any) {
    console.error('[agents] Error creating agent:', err);
    return c.json({ error: 'Failed to create agent' }, 500);
  }
});

// Get current agent profile (auth required)
agentRoutes.get('/me', async (c) => {
  try {
    const db = c.env.DB;
    const auth = c.req.header('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }
    
    const token = auth.slice(7);
    const agent = await db.prepare('SELECT * FROM agents WHERE token = ?').bind(token).first<Agent>();
    
    if (!agent) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    return c.json({
      id: agent.id,
      name: agent.name,
      created_at: agent.created_at,
      metadata: agent.metadata ? JSON.parse(agent.metadata) : null,
      location: agent.location_lat ? {
        lat: agent.location_lat,
        lng: agent.location_lng,
        label: agent.location_label,
        precision: agent.location_precision
      } : null
    });
  } catch (err: any) {
    console.error('[agents] Error getting own profile:', err);
    return c.json({ error: 'Failed to get profile' }, 500);
  }
});

// Update current agent (auth required)
agentRoutes.patch('/me', async (c) => {
  try {
    const db = c.env.DB;
    const auth = c.req.header('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }
    
    const token = auth.slice(7);
    const agent = await db.prepare('SELECT * FROM agents WHERE token = ?').bind(token).first<Agent>();
    
    if (!agent) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const body = await c.req.json();
    
    // Handle location update
    if ('location' in body) {
      if (body.location === null) {
        // Clear location
        await db.prepare(`
          UPDATE agents SET location_lat = NULL, location_lng = NULL, location_label = NULL, location_precision = 'hidden'
          WHERE id = ?
        `).bind(agent.id).run();
        console.log(`[agents] ${agent.name} cleared location`);
      } else if (body.location.lat !== undefined && body.location.lng !== undefined) {
        // Update location
        await db.prepare(`
          UPDATE agents 
          SET location_lat = ?, location_lng = ?, location_label = ?, location_precision = ?, location_updated_at = datetime('now')
          WHERE id = ?
        `).bind(
          body.location.lat,
          body.location.lng,
          body.location.label || null,
          body.location.precision || 'city',
          agent.id
        ).run();
        console.log(`[agents] ${agent.name} updated location: ${body.location.label || 'unlabeled'}`);
      }
    }

    // Return updated profile
    const updated = await db.prepare('SELECT * FROM agents WHERE id = ?').bind(agent.id).first<Agent>();
    return c.json({
      id: updated!.id,
      name: updated!.name,
      location: updated!.location_lat ? {
        lat: updated!.location_lat,
        lng: updated!.location_lng,
        label: updated!.location_label,
        precision: updated!.location_precision
      } : null
    });
  } catch (err: any) {
    console.error('[agents] Error updating profile:', err);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

// List all agents (public info only)
agentRoutes.get('/', async (c) => {
  try {
    const db = c.env.DB;
    // Only show verified agents (those who have posted at least one journal entry)
    const { results: agents } = await db.prepare(`
      SELECT id, name, created_at, metadata, location_lat, location_lng, location_label, location_precision, last_seen
      FROM agents
      WHERE verified = 1
      ORDER BY 
        CASE WHEN last_seen IS NOT NULL THEN 0 ELSE 1 END,
        last_seen DESC
    `).all<Agent>();

    return c.json({
      agents: (agents || []).map(a => ({
        id: a.id,
        name: a.name,
        created_at: a.created_at,
        metadata: a.metadata ? JSON.parse(a.metadata) : null,
        location: a.location_precision !== 'hidden' && a.location_lat ? {
          lat: a.location_lat,
          lng: a.location_lng,
          label: a.location_label,
          precision: a.location_precision
        } : null,
        last_seen: a.last_seen,
        status: getPresenceStatus(a.last_seen || null)
      }))
    });
  } catch (err: any) {
    console.error('[agents] Error listing agents:', err);
    return c.json({ error: 'Failed to list agents' }, 500);
  }
});

// Heartbeat - update last_seen (auth required)
agentRoutes.post('/me/heartbeat', async (c) => {
  try {
    const db = c.env.DB;
    const auth = c.req.header('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }
    
    const token = auth.slice(7);
    const agent = await db.prepare('SELECT * FROM agents WHERE token = ?').bind(token).first<Agent>();
    
    if (!agent) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    await db.prepare('UPDATE agents SET last_seen = datetime(\'now\') WHERE id = ?').bind(agent.id).run();
    
    return c.json({ 
      status: 'online',
      agent: agent.name,
      last_seen: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[agents] Error processing heartbeat:', err);
    return c.json({ error: 'Failed to process heartbeat' }, 500);
  }
});

// Get single agent
agentRoutes.get('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const agent = await db.prepare('SELECT * FROM agents WHERE id = ?').bind(c.req.param('id')).first<Agent>();
    
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }
    
    return c.json({
      id: agent.id,
      name: agent.name,
      created_at: agent.created_at,
      metadata: agent.metadata ? JSON.parse(agent.metadata) : null,
      location: agent.location_precision !== 'hidden' && agent.location_lat ? {
        lat: agent.location_lat,
        lng: agent.location_lng,
        label: agent.location_label,
        precision: agent.location_precision,
        updated_at: agent.location_updated_at
      } : null
    });
  } catch (err: any) {
    console.error('[agents] Error getting agent:', err);
    return c.json({ error: 'Failed to get agent' }, 500);
  }
});

// Update agent location (auth required)
agentRoutes.patch('/me/location', async (c) => {
  try {
    const db = c.env.DB;
    const auth = c.req.header('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }
    
    const token = auth.slice(7);
    const agent = await db.prepare('SELECT * FROM agents WHERE token = ?').bind(token).first<Agent>();
    
    if (!agent) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const body = await c.req.json();
    const { lat, lng, label, precision } = body;

    // Validate precision
    const validPrecisions = ['hidden', 'country', 'city', 'neighborhood', 'exact'];
    if (precision && !validPrecisions.includes(precision)) {
      return c.json({ error: `precision must be one of: ${validPrecisions.join(', ')}` }, 400);
    }

    // If hiding, clear location data
    if (precision === 'hidden') {
      await db.prepare(`
        UPDATE agents SET location_lat = NULL, location_lng = NULL, location_label = NULL, location_precision = 'hidden'
        WHERE id = ?
      `).bind(agent.id).run();
      return c.json({ status: 'location hidden' });
    }

    // Otherwise, validate coordinates
    if (lat === undefined || lng === undefined) {
      return c.json({ error: 'lat and lng are required (or set precision to "hidden")' }, 400);
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return c.json({ error: 'Invalid coordinates' }, 400);
    }

    await db.prepare(`
      UPDATE agents 
      SET location_lat = ?, location_lng = ?, location_label = ?, location_precision = ?, location_updated_at = datetime('now')
      WHERE id = ?
    `).bind(lat, lng, label || null, precision || 'city', agent.id).run();

    console.log(`[agents] ${agent.name} updated location: ${label || `${lat},${lng}`} (${precision || 'city'})`);

    return c.json({ 
      status: 'location updated',
      location: { lat, lng, label, precision: precision || 'city' }
    });
  } catch (err: any) {
    console.error('[agents] Error updating location:', err);
    return c.json({ error: 'Failed to update location' }, 500);
  }
});

// Get agent relationships (agent-to-agent connections)
// This is the core of the social graph
agentRoutes.get('/:id/relationships', async (c) => {
  try {
    const db = c.env.DB;
    const agentId = c.req.param('id');
    const since = c.req.query('since') || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days default
    
    // Verify agent exists
    const agent = await db.prepare('SELECT id, name FROM agents WHERE id = ?').bind(agentId).first<{id: string, name: string}>();
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get outgoing connections (this agent → other agents)
    const { results: outgoing } = await db.prepare(`
      SELECT 
        target_id,
        COUNT(*) as interaction_count,
        MAX(timestamp) as last_interaction,
        MIN(timestamp) as first_interaction
      FROM journal_entries 
      WHERE agent_id = ? 
        AND target_type = 'agent'
        AND timestamp >= ?
      GROUP BY target_id
    `).bind(agentId, since).all<{
      target_id: string;
      interaction_count: number;
      last_interaction: string;
      first_interaction: string;
    }>();

    // Get incoming connections (other agents → this agent)
    const { results: incoming } = await db.prepare(`
      SELECT 
        agent_id as source_id,
        COUNT(*) as interaction_count,
        MAX(timestamp) as last_interaction,
        MIN(timestamp) as first_interaction
      FROM journal_entries 
      WHERE target_type = 'agent' 
        AND target_id = ?
        AND timestamp >= ?
      GROUP BY agent_id
    `).bind(agentId, since).all<{
      source_id: string;
      interaction_count: number;
      last_interaction: string;
      first_interaction: string;
    }>();

    // Build relationship map
    const relationshipMap = new Map<string, {
      agentId: string;
      agentName?: string;
      outgoing: number;
      incoming: number;
      totalInteractions: number;
      lastInteraction: string;
      firstInteraction: string;
      mutual: boolean;
      strength: number;
    }>();

    // Process outgoing
    for (const out of outgoing || []) {
      relationshipMap.set(out.target_id, {
        agentId: out.target_id,
        outgoing: out.interaction_count,
        incoming: 0,
        totalInteractions: out.interaction_count,
        lastInteraction: out.last_interaction,
        firstInteraction: out.first_interaction,
        mutual: false,
        strength: 0
      });
    }

    // Process incoming and merge
    for (const inc of incoming || []) {
      const existing = relationshipMap.get(inc.source_id);
      if (existing) {
        existing.incoming = inc.interaction_count;
        existing.totalInteractions += inc.interaction_count;
        existing.mutual = true; // Both directions exist!
        if (inc.last_interaction > existing.lastInteraction) {
          existing.lastInteraction = inc.last_interaction;
        }
        if (inc.first_interaction < existing.firstInteraction) {
          existing.firstInteraction = inc.first_interaction;
        }
      } else {
        relationshipMap.set(inc.source_id, {
          agentId: inc.source_id,
          outgoing: 0,
          incoming: inc.interaction_count,
          totalInteractions: inc.interaction_count,
          lastInteraction: inc.last_interaction,
          firstInteraction: inc.first_interaction,
          mutual: false,
          strength: 0
        });
      }
    }

    // Calculate relationship strength (recency + frequency + reciprocity)
    const now = Date.now();
    const DECAY_HALF_LIFE_DAYS = 14; // 2 weeks
    const DECAY_LAMBDA = Math.log(2) / (DECAY_HALF_LIFE_DAYS * 24);

    for (const rel of relationshipMap.values()) {
      const lastTime = new Date(rel.lastInteraction).getTime();
      const hoursAgo = (now - lastTime) / (1000 * 60 * 60);
      const recencyFactor = Math.exp(-DECAY_LAMBDA * hoursAgo);
      
      // Frequency factor (log scale, caps at ~10 interactions for max effect)
      const frequencyFactor = Math.min(1, Math.log10(rel.totalInteractions + 1) / Math.log10(11));
      
      // Reciprocity bonus (mutual relationships are stronger)
      const reciprocityBonus = rel.mutual ? 1.5 : 1;
      
      // Balance bonus (relationships where both sides contribute equally)
      const balanceFactor = rel.mutual 
        ? 1 - Math.abs(rel.outgoing - rel.incoming) / (rel.outgoing + rel.incoming)
        : 0.5;
      
      rel.strength = Math.round(
        (recencyFactor * 0.3 + frequencyFactor * 0.4 + balanceFactor * 0.3) 
        * reciprocityBonus 
        * 100
      ) / 100;
    }

    // Get agent names for all related agents
    const relatedIds = [...relationshipMap.keys()];
    if (relatedIds.length > 0) {
      const placeholders = relatedIds.map(() => '?').join(',');
      const { results: relatedAgents } = await db.prepare(
        `SELECT id, name FROM agents WHERE id IN (${placeholders})`
      ).bind(...relatedIds).all<{id: string, name: string}>();
      
      for (const ra of relatedAgents || []) {
        const rel = relationshipMap.get(ra.id);
        if (rel) rel.agentName = ra.name;
      }
    }

    // Convert to sorted array
    const relationships = [...relationshipMap.values()]
      .sort((a, b) => b.strength - a.strength);

    // Separate mutual from one-way
    const mutual = relationships.filter(r => r.mutual);
    const outgoingOnly = relationships.filter(r => !r.mutual && r.outgoing > 0);
    const incomingOnly = relationships.filter(r => !r.mutual && r.incoming > 0);

    return c.json({
      agent: { id: agent.id, name: agent.name },
      stats: {
        totalRelationships: relationships.length,
        mutualConnections: mutual.length,
        outgoingOnly: outgoingOnly.length,
        incomingOnly: incomingOnly.length
      },
      relationships: {
        mutual: mutual.map(r => ({
          agent: { id: r.agentId, name: r.agentName },
          interactions: { outgoing: r.outgoing, incoming: r.incoming, total: r.totalInteractions },
          strength: r.strength,
          firstInteraction: r.firstInteraction,
          lastInteraction: r.lastInteraction
        })),
        outgoing: outgoingOnly.map(r => ({
          agent: { id: r.agentId, name: r.agentName },
          interactions: r.outgoing,
          strength: r.strength,
          firstInteraction: r.firstInteraction,
          lastInteraction: r.lastInteraction
        })),
        incoming: incomingOnly.map(r => ({
          agent: { id: r.agentId, name: r.agentName },
          interactions: r.incoming,
          strength: r.strength,
          firstInteraction: r.firstInteraction,
          lastInteraction: r.lastInteraction
        }))
      },
      meta: {
        since,
        generatedAt: new Date().toISOString(),
        decayHalfLife: `${DECAY_HALF_LIFE_DAYS} days`
      }
    });
  } catch (err: any) {
    console.error('[agents] Error getting relationships:', err);
    return c.json({ error: 'Failed to get relationships' }, 500);
  }
});

// Delete agent (auth required)
agentRoutes.delete('/me', async (c) => {
  try {
    const db = c.env.DB;
    const auth = c.req.header('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }
    
    const token = auth.slice(7);
    const agent = await db.prepare('SELECT * FROM agents WHERE token = ?').bind(token).first<Agent>();
    
    if (!agent) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    // Delete agent's journal entries first (foreign key)
    await db.prepare('DELETE FROM journal_entries WHERE agent_id = ?').bind(agent.id).run();
    
    // Delete the agent
    await db.prepare('DELETE FROM agents WHERE id = ?').bind(agent.id).run();
    
    console.log(`[agents] Deleted agent: ${agent.name} (${agent.id})`);

    return c.json({ 
      status: 'deleted',
      message: 'Agent and all associated data deleted'
    });
  } catch (err: any) {
    console.error('[agents] Error deleting agent:', err);
    return c.json({ error: 'Failed to delete agent' }, 500);
  }
});
