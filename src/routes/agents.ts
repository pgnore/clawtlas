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
  introduced_by?: string;
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
    const { name, metadata, location, introducedBy } = body;

    if (!name || typeof name !== 'string' || name.length < 1) {
      return c.json({ error: 'name is required (string, min 1 char)' }, 400);
    }

    // Validate introducer exists if provided
    let introducerName: string | null = null;
    if (introducedBy) {
      const introducer = await db.prepare('SELECT id, name FROM agents WHERE id = ?').bind(introducedBy).first<{id: string, name: string}>();
      if (!introducer) {
        return c.json({ error: 'introducedBy agent not found' }, 400);
      }
      introducerName = introducer.name;
    }

    const id = ulid();
    const token = generateToken();

    await db.prepare(`
      INSERT INTO agents (id, name, token, metadata, introduced_by)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      id,
      name.trim(),
      token,
      metadata ? JSON.stringify(metadata) : null,
      introducedBy || null
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

    console.log(`[agents] New agent registered: ${name.trim()} (${id})${introducerName ? ` introduced by ${introducerName}` : ''}`);

    return c.json({
      agent: {
        id,
        name: name.trim(),
        token, // Only returned once at creation!
        ...(introducedBy && { introducedBy: { id: introducedBy, name: introducerName } })
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

    // Get introducer info if present
    let introducedBy: { id: string; name: string } | null = null;
    if (agent.introduced_by) {
      const introducer = await db.prepare('SELECT id, name FROM agents WHERE id = ?').bind(agent.introduced_by).first<{id: string, name: string}>();
      if (introducer) {
        introducedBy = { id: introducer.id, name: introducer.name };
      }
    }

    // Get agents this one introduced
    const { results: introduced } = await db.prepare(`
      SELECT id, name FROM agents WHERE introduced_by = ?
    `).bind(agent.id).all<{id: string, name: string}>();
    
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
      } : null,
      introducedBy,
      introduced: introduced?.length ? introduced : null
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

// Get agent citations (who builds on whose output)
// Citations are journal entries with action="referenced" targeting agents
agentRoutes.get('/:id/citations', async (c) => {
  try {
    const db = c.env.DB;
    const agentId = c.req.param('id');
    const since = c.req.query('since') || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(); // 180 days default (longer than relationships)
    
    // Verify agent exists
    const agent = await db.prepare('SELECT id, name FROM agents WHERE id = ?').bind(agentId).first<{id: string, name: string}>();
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get citations OF this agent (others referencing this agent's work)
    const { results: citedBy } = await db.prepare(`
      SELECT 
        agent_id,
        COUNT(*) as citation_count,
        MAX(timestamp) as last_citation,
        MIN(timestamp) as first_citation,
        GROUP_CONCAT(summary, ' | ') as summaries
      FROM journal_entries 
      WHERE action = 'referenced'
        AND target_type = 'agent'
        AND target_id = ?
        AND timestamp >= ?
      GROUP BY agent_id
      ORDER BY last_citation DESC
    `).bind(agentId, since).all<{
      agent_id: string;
      citation_count: number;
      last_citation: string;
      first_citation: string;
      summaries: string;
    }>();

    // Get citations BY this agent (this agent referencing others)
    const { results: citing } = await db.prepare(`
      SELECT 
        target_id,
        COUNT(*) as citation_count,
        MAX(timestamp) as last_citation,
        MIN(timestamp) as first_citation,
        GROUP_CONCAT(summary, ' | ') as summaries
      FROM journal_entries 
      WHERE agent_id = ?
        AND action = 'referenced'
        AND target_type = 'agent'
        AND timestamp >= ?
      GROUP BY target_id
      ORDER BY last_citation DESC
    `).bind(agentId, since).all<{
      target_id: string;
      citation_count: number;
      last_citation: string;
      first_citation: string;
      summaries: string;
    }>();

    // Get agent names for all related agents
    const allAgentIds = [
      ...(citedBy || []).map(c => c.agent_id),
      ...(citing || []).map(c => c.target_id)
    ];
    
    const agentNames = new Map<string, string>();
    if (allAgentIds.length > 0) {
      const uniqueIds = [...new Set(allAgentIds)];
      const placeholders = uniqueIds.map(() => '?').join(',');
      const { results: agents } = await db.prepare(
        `SELECT id, name FROM agents WHERE id IN (${placeholders})`
      ).bind(...uniqueIds).all<{id: string, name: string}>();
      
      for (const a of agents || []) {
        agentNames.set(a.id, a.name);
      }
    }

    // Calculate citation score (similar to relationship strength but slower decay)
    const now = Date.now();
    const CITATION_DECAY_HALF_LIFE_DAYS = 90; // Citations matter longer than interactions
    const DECAY_LAMBDA = Math.log(2) / (CITATION_DECAY_HALF_LIFE_DAYS * 24);

    const formatCitation = (c: any, isIncoming: boolean) => {
      const agentKey = isIncoming ? c.agent_id : c.target_id;
      const lastTime = new Date(c.last_citation).getTime();
      const hoursAgo = (now - lastTime) / (1000 * 60 * 60);
      const recencyFactor = Math.exp(-DECAY_LAMBDA * hoursAgo);
      const frequencyFactor = Math.min(1, Math.log10(c.citation_count + 1) / Math.log10(6)); // Caps at ~5 citations
      const strength = Math.round((recencyFactor * 0.4 + frequencyFactor * 0.6) * 100) / 100;

      return {
        agentId: agentKey,
        agentName: agentNames.get(agentKey) || null,
        citationCount: c.citation_count,
        firstCitation: c.first_citation,
        lastCitation: c.last_citation,
        strength,
        contexts: c.summaries?.split(' | ').slice(0, 3) || [] // First 3 summaries as context
      };
    };

    const incomingCitations = (citedBy || []).map(c => formatCitation(c, true));
    const outgoingCitations = (citing || []).map(c => formatCitation(c, false));

    // Calculate aggregate citation score
    const totalIncomingStrength = incomingCitations.reduce((sum, c) => sum + c.strength, 0);
    const citationScore = Math.round(Math.min(1, totalIncomingStrength / 3) * 100) / 100; // Normalize to 0-1

    console.log(`[agents] Citations for ${agent.name}: ${incomingCitations.length} incoming, ${outgoingCitations.length} outgoing`);

    return c.json({
      agent: { id: agent.id, name: agent.name },
      stats: {
        totalCitedBy: incomingCitations.length,
        totalCiting: outgoingCitations.length,
        totalIncomingCitations: incomingCitations.reduce((sum, c) => sum + c.citationCount, 0),
        totalOutgoingCitations: outgoingCitations.reduce((sum, c) => sum + c.citationCount, 0),
        citationScore // How much others build on this agent's work
      },
      citations: {
        incoming: incomingCitations, // Others citing this agent
        outgoing: outgoingCitations  // This agent citing others
      },
      meta: {
        since,
        generatedAt: new Date().toISOString(),
        decayHalfLife: `${CITATION_DECAY_HALF_LIFE_DAYS} days`
      }
    });
  } catch (err: any) {
    console.error('[agents] Error getting citations:', err);
    return c.json({ error: 'Failed to get citations' }, 500);
  }
});

// Get agent behavioral fingerprint (activity patterns)
agentRoutes.get('/:id/fingerprint', async (c) => {
  try {
    const db = c.env.DB;
    const agentId = c.req.param('id');
    const since = c.req.query('since') || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    
    // Verify agent exists
    const agent = await db.prepare('SELECT id, name, created_at FROM agents WHERE id = ?').bind(agentId).first<{id: string, name: string, created_at: string}>();
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get all journal entries for analysis
    const { results: entries } = await db.prepare(`
      SELECT timestamp, action, target_type, summary
      FROM journal_entries 
      WHERE agent_id = ? AND timestamp >= ?
      ORDER BY timestamp DESC
    `).bind(agentId, since).all<{
      timestamp: string;
      action: string;
      target_type: string;
      summary: string;
    }>();

    if (!entries || entries.length < 5) {
      return c.json({
        agent: { id: agent.id, name: agent.name },
        fingerprint: null,
        message: 'Not enough data for fingerprint (need at least 5 entries)',
        entryCount: entries?.length || 0
      });
    }

    // Analyze timing patterns
    const hours = entries.map(e => new Date(e.timestamp + 'Z').getUTCHours());
    const hourCounts = new Array(24).fill(0);
    hours.forEach(h => hourCounts[h]++);
    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .filter(h => h.count > 0)
      .map(h => h.hour);
    
    // Infer timezone (peak activity centered around work hours)
    const avgHour = hours.reduce((sum, h) => sum + h, 0) / hours.length;
    const inferredOffset = Math.round((14 - avgHour + 24) % 24); // Assume peak ~2pm local
    
    // Burstiness: how clustered is the activity?
    const timestamps = entries.map(e => new Date(e.timestamp + 'Z').getTime());
    const gaps = timestamps.slice(0, -1).map((t, i) => Math.abs(timestamps[i + 1] - t));
    const avgGap = gaps.length > 0 ? gaps.reduce((sum, g) => sum + g, 0) / gaps.length : 0;
    const gapVariance = gaps.length > 0 ? gaps.reduce((sum, g) => sum + Math.pow(g - avgGap, 2), 0) / gaps.length : 0;
    const burstiness = avgGap > 0 ? Math.min(1, Math.sqrt(gapVariance) / avgGap) : 0;

    // Action distribution
    const actionCounts: Record<string, number> = {};
    entries.forEach(e => {
      actionCounts[e.action] = (actionCounts[e.action] || 0) + 1;
    });
    const totalActions = entries.length;
    const actionDistribution: Record<string, number> = {};
    Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6) // Top 6 actions
      .forEach(([action, count]) => {
        actionDistribution[action] = Math.round(count / totalActions * 100) / 100;
      });

    // Target type preferences
    const targetCounts: Record<string, number> = {};
    entries.forEach(e => {
      targetCounts[e.target_type] = (targetCounts[e.target_type] || 0) + 1;
    });
    const targetPreferences: Record<string, number> = {};
    Object.entries(targetCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([type, count]) => {
        targetPreferences[type] = Math.round(count / totalActions * 100) / 100;
      });

    // Summary style analysis
    const summaryLengths = entries.map(e => e.summary?.length || 0);
    const avgSummaryLength = Math.round(summaryLengths.reduce((sum, l) => sum + l, 0) / summaryLengths.length);
    const minSummaryLength = Math.min(...summaryLengths);
    const maxSummaryLength = Math.max(...summaryLengths);
    
    // Technical vocabulary score (heuristic: count technical terms)
    const technicalTerms = ['api', 'deploy', 'commit', 'merge', 'build', 'test', 'debug', 'refactor', 'endpoint', 'database', 'query', 'function', 'class', 'module'];
    const allSummaries = entries.map(e => e.summary?.toLowerCase() || '').join(' ');
    const technicalCount = technicalTerms.reduce((count, term) => count + (allSummaries.match(new RegExp(term, 'g'))?.length || 0), 0);
    const technicalScore = Math.min(1, technicalCount / entries.length);

    // Calculate fingerprint hash (for comparison)
    const fingerprintData = `${peakHours.join(',')}-${Object.keys(actionDistribution).slice(0, 3).join(',')}-${Object.keys(targetPreferences).slice(0, 3).join(',')}`;
    const fingerprintHash = btoa(fingerprintData).slice(0, 12);

    console.log(`[agents] Fingerprint for ${agent.name}: ${entries.length} entries analyzed`);

    return c.json({
      agent: { id: agent.id, name: agent.name },
      fingerprint: {
        hash: fingerprintHash,
        activityPattern: {
          peakHours,
          inferredTimezoneOffset: inferredOffset,
          burstiness: Math.round(burstiness * 100) / 100
        },
        actionDistribution,
        targetPreferences,
        summaryStyle: {
          avgLength: avgSummaryLength,
          minLength: minSummaryLength,
          maxLength: maxSummaryLength,
          technicalScore: Math.round(technicalScore * 100) / 100
        }
      },
      meta: {
        entriesAnalyzed: entries.length,
        since,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error('[agents] Error generating fingerprint:', err);
    return c.json({ error: 'Failed to generate fingerprint' }, 500);
  }
});

// Compare two agents' fingerprints
agentRoutes.get('/compare/:id1/:id2', async (c) => {
  try {
    const db = c.env.DB;
    const id1 = c.req.param('id1');
    const id2 = c.req.param('id2');
    const since = c.req.query('since') || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    
    // Fetch both agents
    const [agent1, agent2] = await Promise.all([
      db.prepare('SELECT id, name FROM agents WHERE id = ?').bind(id1).first<{id: string, name: string}>(),
      db.prepare('SELECT id, name FROM agents WHERE id = ?').bind(id2).first<{id: string, name: string}>()
    ]);
    
    if (!agent1) return c.json({ error: `Agent ${id1} not found` }, 404);
    if (!agent2) return c.json({ error: `Agent ${id2} not found` }, 404);

    // Fetch entries for both
    const [entries1, entries2] = await Promise.all([
      db.prepare('SELECT action, target_type FROM journal_entries WHERE agent_id = ? AND timestamp >= ?').bind(id1, since).all<{action: string, target_type: string}>(),
      db.prepare('SELECT action, target_type FROM journal_entries WHERE agent_id = ? AND timestamp >= ?').bind(id2, since).all<{action: string, target_type: string}>()
    ]);

    if (!entries1.results?.length || !entries2.results?.length) {
      return c.json({
        agent1: { id: agent1.id, name: agent1.name },
        agent2: { id: agent2.id, name: agent2.name },
        comparison: null,
        message: 'Not enough data for comparison'
      });
    }

    // Calculate action distributions
    const getDistribution = (entries: any[]) => {
      const counts: Record<string, number> = {};
      entries.forEach(e => { counts[e.action] = (counts[e.action] || 0) + 1; });
      const total = entries.length;
      const dist: Record<string, number> = {};
      Object.entries(counts).forEach(([k, v]) => { dist[k] = v / total; });
      return dist;
    };

    const getTargetDist = (entries: any[]) => {
      const counts: Record<string, number> = {};
      entries.forEach(e => { counts[e.target_type] = (counts[e.target_type] || 0) + 1; });
      const total = entries.length;
      const dist: Record<string, number> = {};
      Object.entries(counts).forEach(([k, v]) => { dist[k] = v / total; });
      return dist;
    };

    const actionDist1 = getDistribution(entries1.results);
    const actionDist2 = getDistribution(entries2.results);
    const targetDist1 = getTargetDist(entries1.results);
    const targetDist2 = getTargetDist(entries2.results);

    // Calculate cosine similarity between distributions
    const cosineSimilarity = (d1: Record<string, number>, d2: Record<string, number>) => {
      const allKeys = new Set([...Object.keys(d1), ...Object.keys(d2)]);
      let dot = 0, mag1 = 0, mag2 = 0;
      allKeys.forEach(k => {
        const v1 = d1[k] || 0;
        const v2 = d2[k] || 0;
        dot += v1 * v2;
        mag1 += v1 * v1;
        mag2 += v2 * v2;
      });
      return mag1 > 0 && mag2 > 0 ? dot / (Math.sqrt(mag1) * Math.sqrt(mag2)) : 0;
    };

    const actionSimilarity = cosineSimilarity(actionDist1, actionDist2);
    const targetSimilarity = cosineSimilarity(targetDist1, targetDist2);
    const overallSimilarity = (actionSimilarity + targetSimilarity) / 2;

    // Check for shared interactions
    const { results: sharedResult } = await db.prepare(`
      SELECT COUNT(DISTINCT j1.target_id) as shared_targets
      FROM journal_entries j1
      JOIN journal_entries j2 ON j1.target_id = j2.target_id AND j1.target_type = j2.target_type
      WHERE j1.agent_id = ? AND j2.agent_id = ? AND j1.timestamp >= ? AND j2.timestamp >= ?
    `).bind(id1, id2, since, since).all<{shared_targets: number}>();

    // Check for direct interactions between them
    const { results: directResult } = await db.prepare(`
      SELECT COUNT(*) as direct_interactions
      FROM journal_entries
      WHERE (agent_id = ? AND target_type = 'agent' AND target_id = ?)
         OR (agent_id = ? AND target_type = 'agent' AND target_id = ?)
    `).bind(id1, id2, id2, id1).all<{direct_interactions: number}>();

    console.log(`[agents] Comparing ${agent1.name} vs ${agent2.name}: similarity ${Math.round(overallSimilarity * 100)}%`);

    return c.json({
      agent1: { id: agent1.id, name: agent1.name, entryCount: entries1.results.length },
      agent2: { id: agent2.id, name: agent2.name, entryCount: entries2.results.length },
      comparison: {
        similarity: {
          overall: Math.round(overallSimilarity * 100) / 100,
          actions: Math.round(actionSimilarity * 100) / 100,
          targets: Math.round(targetSimilarity * 100) / 100
        },
        relationship: {
          sharedTargets: sharedResult?.[0]?.shared_targets || 0,
          directInteractions: directResult?.[0]?.direct_interactions || 0,
          isMutual: (directResult?.[0]?.direct_interactions || 0) >= 2
        },
        interpretation: overallSimilarity > 0.8 ? 'Very similar behavior patterns' :
                       overallSimilarity > 0.5 ? 'Moderately similar' :
                       overallSimilarity > 0.3 ? 'Some overlap' : 'Different patterns'
      },
      meta: {
        since,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error('[agents] Error comparing agents:', err);
    return c.json({ error: 'Failed to compare agents' }, 500);
  }
});

// Verify agent identity by comparing recent behavior to historical fingerprint
agentRoutes.get('/:id/verify', async (c) => {
  try {
    const db = c.env.DB;
    const agentId = c.req.param('id');
    
    // Verify agent exists
    const agent = await db.prepare('SELECT id, name, created_at FROM agents WHERE id = ?').bind(agentId).first<{id: string, name: string, created_at: string}>();
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get historical entries (older than 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { results: historicalEntries } = await db.prepare(`
      SELECT action, target_type FROM journal_entries 
      WHERE agent_id = ? AND timestamp >= ? AND timestamp < ?
    `).bind(agentId, monthAgo, weekAgo).all<{action: string, target_type: string}>();

    // Get recent entries (last 7 days)
    const { results: recentEntries } = await db.prepare(`
      SELECT action, target_type FROM journal_entries 
      WHERE agent_id = ? AND timestamp >= ?
    `).bind(agentId, weekAgo).all<{action: string, target_type: string}>();

    if (!historicalEntries?.length || historicalEntries.length < 5) {
      return c.json({
        agent: { id: agent.id, name: agent.name },
        verified: null,
        status: 'insufficient_history',
        message: 'Not enough historical data to verify (need at least 5 entries older than 7 days)',
        historicalEntries: historicalEntries?.length || 0,
        recentEntries: recentEntries?.length || 0
      });
    }

    if (!recentEntries?.length) {
      return c.json({
        agent: { id: agent.id, name: agent.name },
        verified: null,
        status: 'no_recent_activity',
        message: 'No recent activity to verify against history',
        historicalEntries: historicalEntries.length,
        recentEntries: 0
      });
    }

    // Calculate distributions
    const getDistribution = (entries: any[]) => {
      const counts: Record<string, number> = {};
      entries.forEach(e => { counts[e.action] = (counts[e.action] || 0) + 1; });
      const total = entries.length;
      const dist: Record<string, number> = {};
      Object.entries(counts).forEach(([k, v]) => { dist[k] = v / total; });
      return dist;
    };

    const getTargetDist = (entries: any[]) => {
      const counts: Record<string, number> = {};
      entries.forEach(e => { counts[e.target_type] = (counts[e.target_type] || 0) + 1; });
      const total = entries.length;
      const dist: Record<string, number> = {};
      Object.entries(counts).forEach(([k, v]) => { dist[k] = v / total; });
      return dist;
    };

    const historicalActionDist = getDistribution(historicalEntries);
    const recentActionDist = getDistribution(recentEntries);
    const historicalTargetDist = getTargetDist(historicalEntries);
    const recentTargetDist = getTargetDist(recentEntries);

    // Cosine similarity
    const cosineSimilarity = (d1: Record<string, number>, d2: Record<string, number>) => {
      const allKeys = new Set([...Object.keys(d1), ...Object.keys(d2)]);
      let dot = 0, mag1 = 0, mag2 = 0;
      allKeys.forEach(k => {
        const v1 = d1[k] || 0;
        const v2 = d2[k] || 0;
        dot += v1 * v2;
        mag1 += v1 * v1;
        mag2 += v2 * v2;
      });
      return mag1 > 0 && mag2 > 0 ? dot / (Math.sqrt(mag1) * Math.sqrt(mag2)) : 0;
    };

    const actionConsistency = cosineSimilarity(historicalActionDist, recentActionDist);
    const targetConsistency = cosineSimilarity(historicalTargetDist, recentTargetDist);
    const overallConsistency = (actionConsistency + targetConsistency) / 2;

    // Determine verification result
    const isVerified = overallConsistency >= 0.5;
    const confidence = overallConsistency >= 0.8 ? 'high' : 
                       overallConsistency >= 0.6 ? 'medium' : 
                       overallConsistency >= 0.4 ? 'low' : 'very_low';

    console.log(`[agents] Verify ${agent.name}: ${isVerified ? 'PASS' : 'FAIL'} (${Math.round(overallConsistency * 100)}% consistency)`);

    return c.json({
      agent: { id: agent.id, name: agent.name },
      verified: isVerified,
      status: isVerified ? 'consistent' : 'inconsistent',
      confidence,
      consistency: {
        overall: Math.round(overallConsistency * 100) / 100,
        actions: Math.round(actionConsistency * 100) / 100,
        targets: Math.round(targetConsistency * 100) / 100
      },
      interpretation: isVerified 
        ? `Recent behavior is ${confidence} consistent with historical patterns`
        : 'Recent behavior differs significantly from historical patterns - possible identity change or compromise',
      meta: {
        historicalEntries: historicalEntries.length,
        recentEntries: recentEntries.length,
        historicalPeriod: `${monthAgo} to ${weekAgo}`,
        recentPeriod: `${weekAgo} to now`,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error('[agents] Error verifying agent:', err);
    return c.json({ error: 'Failed to verify agent' }, 500);
  }
});

// Get agent's extended network (2-hop connections)
agentRoutes.get('/:id/network', async (c) => {
  try {
    const db = c.env.DB;
    const agentId = c.req.param('id');
    const since = c.req.query('since') || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    
    // Verify agent exists
    const agent = await db.prepare('SELECT id, name FROM agents WHERE id = ?').bind(agentId).first<{id: string, name: string}>();
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get direct connections (1-hop)
    const { results: directConnections } = await db.prepare(`
      SELECT DISTINCT
        CASE 
          WHEN j.agent_id = ? THEN j.target_id
          ELSE j.agent_id
        END as connected_agent_id,
        CASE 
          WHEN j.agent_id = ? THEN 'outgoing'
          ELSE 'incoming'
        END as direction,
        COUNT(*) as interaction_count
      FROM journal_entries j
      WHERE j.target_type = 'agent'
        AND (j.agent_id = ? OR j.target_id = ?)
        AND j.timestamp >= ?
      GROUP BY connected_agent_id
    `).bind(agentId, agentId, agentId, agentId, since).all<{
      connected_agent_id: string;
      direction: string;
      interaction_count: number;
    }>();

    const directIds = new Set((directConnections || []).map(c => c.connected_agent_id));

    // Get 2-hop connections (friends of friends)
    const twoHopConnections: Map<string, { via: string[], count: number }> = new Map();
    
    for (const direct of (directConnections || [])) {
      const { results: theirConnections } = await db.prepare(`
        SELECT DISTINCT
          CASE 
            WHEN j.agent_id = ? THEN j.target_id
            ELSE j.agent_id
          END as connected_agent_id,
          COUNT(*) as interaction_count
        FROM journal_entries j
        WHERE j.target_type = 'agent'
          AND (j.agent_id = ? OR j.target_id = ?)
          AND j.timestamp >= ?
        GROUP BY connected_agent_id
        LIMIT 20
      `).bind(direct.connected_agent_id, direct.connected_agent_id, direct.connected_agent_id, since).all<{
        connected_agent_id: string;
        interaction_count: number;
      }>();

      for (const hop2 of (theirConnections || [])) {
        // Skip if it's the original agent or a direct connection
        if (hop2.connected_agent_id === agentId || directIds.has(hop2.connected_agent_id)) continue;
        
        const existing = twoHopConnections.get(hop2.connected_agent_id);
        if (existing) {
          existing.via.push(direct.connected_agent_id);
          existing.count += hop2.interaction_count;
        } else {
          twoHopConnections.set(hop2.connected_agent_id, {
            via: [direct.connected_agent_id],
            count: hop2.interaction_count
          });
        }
      }
    }

    // Get agent names for all connections
    const allIds = [...directIds, ...twoHopConnections.keys()];
    const agentNames = new Map<string, string>();
    if (allIds.length > 0) {
      const uniqueIds = [...new Set(allIds)];
      const placeholders = uniqueIds.map(() => '?').join(',');
      const { results: agents } = await db.prepare(
        `SELECT id, name FROM agents WHERE id IN (${placeholders})`
      ).bind(...uniqueIds).all<{id: string, name: string}>();
      
      for (const a of agents || []) {
        agentNames.set(a.id, a.name);
      }
    }

    // Format direct connections
    const direct = (directConnections || []).map(c => ({
      agentId: c.connected_agent_id,
      agentName: agentNames.get(c.connected_agent_id) || null,
      direction: c.direction,
      interactions: c.interaction_count
    }));

    // Format 2-hop connections, sorted by number of paths
    const twoHop = [...twoHopConnections.entries()]
      .map(([id, data]) => ({
        agentId: id,
        agentName: agentNames.get(id) || null,
        via: data.via.map(v => ({ id: v, name: agentNames.get(v) || null })),
        pathCount: data.via.length,
        totalInteractions: data.count
      }))
      .sort((a, b) => b.pathCount - a.pathCount)
      .slice(0, 20);

    console.log(`[agents] Network for ${agent.name}: ${direct.length} direct, ${twoHop.length} 2-hop`);

    return c.json({
      agent: { id: agent.id, name: agent.name },
      network: {
        direct: direct,
        twoHop: twoHop,
        stats: {
          directCount: direct.length,
          twoHopCount: twoHop.length,
          totalReach: direct.length + twoHop.length
        }
      },
      meta: {
        since,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error('[agents] Error getting network:', err);
    return c.json({ error: 'Failed to get network' }, 500);
  }
});

// Get comprehensive agent summary (combines multiple endpoints)
agentRoutes.get('/:id/summary', async (c) => {
  try {
    const db = c.env.DB;
    const agentId = c.req.param('id');
    
    // Verify agent exists and get basic info
    const agent = await db.prepare(`
      SELECT id, name, created_at, metadata, status, last_seen, location_label
      FROM agents WHERE id = ?
    `).bind(agentId).first<any>();
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get entry stats
    const entryStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_entries,
        COUNT(DISTINCT target_id) as unique_targets,
        MIN(timestamp) as first_entry,
        MAX(timestamp) as last_entry
      FROM journal_entries WHERE agent_id = ?
    `).bind(agentId).first<any>();

    // Get top actions
    const { results: topActions } = await db.prepare(`
      SELECT action, COUNT(*) as count 
      FROM journal_entries WHERE agent_id = ?
      GROUP BY action ORDER BY count DESC LIMIT 5
    `).bind(agentId).all<{action: string, count: number}>();

    // Get top target types  
    const { results: topTargets } = await db.prepare(`
      SELECT target_type, COUNT(*) as count
      FROM journal_entries WHERE agent_id = ?
      GROUP BY target_type ORDER BY count DESC LIMIT 5
    `).bind(agentId).all<{target_type: string, count: number}>();

    // Get relationship counts
    const relStats = await db.prepare(`
      SELECT 
        (SELECT COUNT(DISTINCT target_id) FROM journal_entries 
         WHERE agent_id = ? AND target_type = 'agent') as outgoing,
        (SELECT COUNT(DISTINCT agent_id) FROM journal_entries 
         WHERE target_id = ? AND target_type = 'agent') as incoming
    `).bind(agentId, agentId).first<{outgoing: number, incoming: number}>();

    // Get citation count
    const citations = await db.prepare(`
      SELECT COUNT(DISTINCT agent_id) as citers
      FROM journal_entries 
      WHERE action = 'referenced' AND target_type = 'agent' AND target_id = ?
    `).bind(agentId).first<{citers: number}>();

    // Calculate days active
    const daysActive = Math.floor((Date.now() - new Date(agent.created_at).getTime()) / (1000 * 60 * 60 * 24));

    // Determine trust level
    let trustLevel = 'unverified';
    const lastEntry = entryStats?.last_entry ? new Date(entryStats.last_entry + 'Z') : null;
    const daysSinceEntry = lastEntry ? (Date.now() - lastEntry.getTime()) / (1000 * 60 * 60 * 24) : Infinity;
    
    if (entryStats?.total_entries > 0) trustLevel = 'verified';
    if (daysSinceEntry <= 7) trustLevel = 'active';
    if (daysActive >= 30) trustLevel = 'established';
    // Note: Connected/Trusted require mutual connections check which we skip for performance

    // Generate summary text
    const summaryText = `${agent.name} is a${trustLevel === 'active' ? 'n' : ''} ${trustLevel} agent` +
      ` with ${entryStats?.total_entries || 0} journal entries` +
      ` across ${entryStats?.unique_targets || 0} unique targets.` +
      ` Active for ${daysActive} days.` +
      (relStats?.outgoing ? ` Connected to ${relStats.outgoing} agents.` : '') +
      (citations?.citers ? ` Cited by ${citations.citers} agents.` : '');

    console.log(`[agents] Summary for ${agent.name}`);

    return c.json({
      agent: {
        id: agent.id,
        name: agent.name,
        createdAt: agent.created_at,
        location: agent.location_label || null,
        status: getPresenceStatus(agent.last_seen),
        trustLevel
      },
      activity: {
        totalEntries: entryStats?.total_entries || 0,
        uniqueTargets: entryStats?.unique_targets || 0,
        firstEntry: entryStats?.first_entry || null,
        lastEntry: entryStats?.last_entry || null,
        daysActive,
        topActions: (topActions || []).map(a => ({ action: a.action, count: a.count })),
        topTargets: (topTargets || []).map(t => ({ type: t.target_type, count: t.count }))
      },
      social: {
        outgoingConnections: relStats?.outgoing || 0,
        incomingConnections: relStats?.incoming || 0,
        citedBy: citations?.citers || 0
      },
      summary: summaryText,
      generatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[agents] Error getting summary:', err);
    return c.json({ error: 'Failed to get summary' }, 500);
  }
});

// Get agent's activity timeline (activity over time)
agentRoutes.get('/:id/timeline', async (c) => {
  try {
    const db = c.env.DB;
    const agentId = c.req.param('id');
    const days = Math.min(parseInt(c.req.query('days') || '30'), 90);
    
    // Verify agent exists
    const agent = await db.prepare('SELECT id, name, created_at FROM agents WHERE id = ?').bind(agentId).first<{id: string, name: string, created_at: string}>();
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get daily activity counts
    const { results: dailyActivity } = await db.prepare(`
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as entries,
        COUNT(DISTINCT target_id) as unique_targets,
        COUNT(DISTINCT action) as action_variety
      FROM journal_entries 
      WHERE agent_id = ? 
        AND timestamp >= datetime('now', '-' || ? || ' days')
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `).bind(agentId, days).all<{
      date: string;
      entries: number;
      unique_targets: number;
      action_variety: number;
    }>();

    // Get hourly distribution (all time)
    const { results: hourlyDist } = await db.prepare(`
      SELECT 
        CAST(strftime('%H', timestamp) AS INTEGER) as hour,
        COUNT(*) as count
      FROM journal_entries WHERE agent_id = ?
      GROUP BY hour
      ORDER BY hour
    `).bind(agentId).all<{hour: number, count: number}>();

    // Create 24-hour array
    const hourlyArray = new Array(24).fill(0);
    (hourlyDist || []).forEach(h => { hourlyArray[h.hour] = h.count; });
    const peakHour = hourlyArray.indexOf(Math.max(...hourlyArray));

    // Calculate activity trend (comparing last 7 days to previous 7 days)
    const last7 = (dailyActivity || []).slice(0, 7).reduce((sum, d) => sum + d.entries, 0);
    const prev7 = (dailyActivity || []).slice(7, 14).reduce((sum, d) => sum + d.entries, 0);
    const trend = prev7 > 0 ? Math.round((last7 - prev7) / prev7 * 100) : 0;
    const trendLabel = trend > 20 ? 'increasing' : trend < -20 ? 'decreasing' : 'stable';

    // Get milestones (significant events)
    const { results: milestones } = await db.prepare(`
      SELECT timestamp, action, target_type, summary
      FROM journal_entries 
      WHERE agent_id = ?
        AND (action IN ('shipped', 'deployed', 'created', 'launched') OR summary LIKE '%first%')
      ORDER BY timestamp DESC
      LIMIT 5
    `).bind(agentId).all<{
      timestamp: string;
      action: string;
      target_type: string;
      summary: string;
    }>();

    console.log(`[agents] Timeline for ${agent.name}: ${days} days, ${trend}% trend`);

    return c.json({
      agent: { id: agent.id, name: agent.name },
      timeline: {
        daily: (dailyActivity || []).map(d => ({
          date: d.date,
          entries: d.entries,
          uniqueTargets: d.unique_targets,
          actionVariety: d.action_variety
        })),
        hourlyDistribution: hourlyArray,
        peakHour,
        trend: {
          percentage: trend,
          label: trendLabel,
          last7Days: last7,
          previous7Days: prev7
        }
      },
      milestones: (milestones || []).map(m => ({
        timestamp: m.timestamp,
        action: m.action,
        targetType: m.target_type,
        summary: m.summary
      })),
      meta: {
        daysAnalyzed: days,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error('[agents] Error getting timeline:', err);
    return c.json({ error: 'Failed to get timeline' }, 500);
  }
});

// Find similar agents (based on behavioral patterns)
agentRoutes.get('/:id/similar', async (c) => {
  try {
    const db = c.env.DB;
    const agentId = c.req.param('id');
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 20);
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    
    // Verify agent exists
    const agent = await db.prepare('SELECT id, name FROM agents WHERE id = ?').bind(agentId).first<{id: string, name: string}>();
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get this agent's action distribution
    const { results: myActions } = await db.prepare(`
      SELECT action, COUNT(*) as count FROM journal_entries 
      WHERE agent_id = ? AND timestamp >= ?
      GROUP BY action
    `).bind(agentId, since).all<{action: string, count: number}>();

    if (!myActions?.length) {
      return c.json({
        agent: { id: agent.id, name: agent.name },
        similar: [],
        message: 'Not enough activity to find similar agents'
      });
    }

    // Calculate my distribution
    const myTotal = myActions.reduce((sum, a) => sum + a.count, 0);
    const myDist: Record<string, number> = {};
    myActions.forEach(a => { myDist[a.action] = a.count / myTotal; });

    // Get all other agents with activity
    const { results: otherAgents } = await db.prepare(`
      SELECT DISTINCT agent_id FROM journal_entries 
      WHERE agent_id != ? AND timestamp >= ?
    `).bind(agentId, since).all<{agent_id: string}>();

    // Calculate similarity for each
    const similarities: Array<{id: string, similarity: number}> = [];
    
    for (const other of (otherAgents || [])) {
      const { results: theirActions } = await db.prepare(`
        SELECT action, COUNT(*) as count FROM journal_entries 
        WHERE agent_id = ? AND timestamp >= ?
        GROUP BY action
      `).bind(other.agent_id, since).all<{action: string, count: number}>();

      if (!theirActions?.length) continue;

      const theirTotal = theirActions.reduce((sum, a) => sum + a.count, 0);
      const theirDist: Record<string, number> = {};
      theirActions.forEach(a => { theirDist[a.action] = a.count / theirTotal; });

      // Cosine similarity
      const allKeys = new Set([...Object.keys(myDist), ...Object.keys(theirDist)]);
      let dot = 0, mag1 = 0, mag2 = 0;
      allKeys.forEach(k => {
        const v1 = myDist[k] || 0;
        const v2 = theirDist[k] || 0;
        dot += v1 * v2;
        mag1 += v1 * v1;
        mag2 += v2 * v2;
      });
      const similarity = mag1 > 0 && mag2 > 0 ? dot / (Math.sqrt(mag1) * Math.sqrt(mag2)) : 0;
      
      similarities.push({ id: other.agent_id, similarity });
    }

    // Sort by similarity and take top N
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topSimilar = similarities.slice(0, limit);

    // Get agent names
    if (topSimilar.length > 0) {
      const ids = topSimilar.map(s => s.id);
      const placeholders = ids.map(() => '?').join(',');
      const { results: names } = await db.prepare(
        `SELECT id, name FROM agents WHERE id IN (${placeholders})`
      ).bind(...ids).all<{id: string, name: string}>();
      
      const nameMap = new Map((names || []).map(n => [n.id, n.name]));
      
      console.log(`[agents] Similar to ${agent.name}: found ${topSimilar.length}`);

      return c.json({
        agent: { id: agent.id, name: agent.name },
        similar: topSimilar.map(s => ({
          agentId: s.id,
          agentName: nameMap.get(s.id) || null,
          similarity: Math.round(s.similarity * 100) / 100,
          match: s.similarity > 0.8 ? 'high' : s.similarity > 0.5 ? 'moderate' : 'low'
        })),
        meta: {
          totalCandidates: otherAgents?.length || 0,
          since,
          generatedAt: new Date().toISOString()
        }
      });
    }

    return c.json({
      agent: { id: agent.id, name: agent.name },
      similar: [],
      meta: { totalCandidates: 0, since, generatedAt: new Date().toISOString() }
    });
  } catch (err: any) {
    console.error('[agents] Error finding similar:', err);
    return c.json({ error: 'Failed to find similar agents' }, 500);
  }
});

// Detect behavioral anomalies
agentRoutes.get('/:id/anomalies', async (c) => {
  try {
    const db = c.env.DB;
    const agentId = c.req.param('id');
    
    // Verify agent exists
    const agent = await db.prepare('SELECT id, name, created_at FROM agents WHERE id = ?').bind(agentId).first<{id: string, name: string, created_at: string}>();
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const anomalies: Array<{type: string, severity: string, description: string, data?: any}> = [];

    // Get baseline stats (last 30 days excluding last 7)
    const baselineStats = await db.prepare(`
      SELECT 
        AVG(daily_count) as avg_daily,
        COUNT(*) as days_with_activity
      FROM (
        SELECT DATE(timestamp) as date, COUNT(*) as daily_count
        FROM journal_entries 
        WHERE agent_id = ? AND timestamp >= ? AND timestamp < ?
        GROUP BY DATE(timestamp)
      )
    `).bind(agentId, monthAgo, weekAgo).first<{avg_daily: number, days_with_activity: number}>();

    // Get recent stats (last 7 days)
    const recentStats = await db.prepare(`
      SELECT 
        AVG(daily_count) as avg_daily,
        MAX(daily_count) as max_daily,
        COUNT(*) as days_with_activity
      FROM (
        SELECT DATE(timestamp) as date, COUNT(*) as daily_count
        FROM journal_entries 
        WHERE agent_id = ? AND timestamp >= ?
        GROUP BY DATE(timestamp)
      )
    `).bind(agentId, weekAgo).first<{avg_daily: number, max_daily: number, days_with_activity: number}>();

    // Check for activity spike (>3x baseline)
    if (baselineStats?.avg_daily && recentStats?.avg_daily) {
      const ratio = recentStats.avg_daily / baselineStats.avg_daily;
      if (ratio > 3) {
        anomalies.push({
          type: 'activity_spike',
          severity: 'warning',
          description: `Activity increased ${ratio.toFixed(1)}x from baseline (${baselineStats.avg_daily.toFixed(1)} → ${recentStats.avg_daily.toFixed(1)} entries/day)`,
          data: { baseline: baselineStats.avg_daily, recent: recentStats.avg_daily, ratio }
        });
      }
    }

    // Check for activity drop (>50% decrease)
    if (baselineStats?.avg_daily && recentStats?.avg_daily) {
      const ratio = recentStats.avg_daily / baselineStats.avg_daily;
      if (ratio < 0.5 && baselineStats.avg_daily > 5) {
        anomalies.push({
          type: 'activity_drop',
          severity: 'info',
          description: `Activity decreased to ${(ratio * 100).toFixed(0)}% of baseline`,
          data: { baseline: baselineStats.avg_daily, recent: recentStats.avg_daily, ratio }
        });
      }
    }

    // Check for new action types (actions in last 7 days not seen before)
    const { results: newActions } = await db.prepare(`
      SELECT DISTINCT action FROM journal_entries 
      WHERE agent_id = ? AND timestamp >= ?
      AND action NOT IN (
        SELECT DISTINCT action FROM journal_entries 
        WHERE agent_id = ? AND timestamp < ?
      )
    `).bind(agentId, weekAgo, agentId, weekAgo).all<{action: string}>();

    if (newActions?.length) {
      anomalies.push({
        type: 'new_behavior',
        severity: 'info',
        description: `Started ${newActions.length} new action type(s): ${newActions.map(a => a.action).join(', ')}`,
        data: { actions: newActions.map(a => a.action) }
      });
    }

    // Check for unusual target types
    const { results: newTargetTypes } = await db.prepare(`
      SELECT DISTINCT target_type FROM journal_entries 
      WHERE agent_id = ? AND timestamp >= ?
      AND target_type NOT IN (
        SELECT DISTINCT target_type FROM journal_entries 
        WHERE agent_id = ? AND timestamp < ?
      )
    `).bind(agentId, weekAgo, agentId, weekAgo).all<{target_type: string}>();

    if (newTargetTypes?.length) {
      anomalies.push({
        type: 'new_targets',
        severity: 'info',
        description: `Started interacting with ${newTargetTypes.length} new target type(s): ${newTargetTypes.map(t => t.target_type).join(', ')}`,
        data: { targetTypes: newTargetTypes.map(t => t.target_type) }
      });
    }

    // Check for burst activity (>10 entries in 1 hour)
    const { results: bursts } = await db.prepare(`
      SELECT 
        strftime('%Y-%m-%d %H:00', timestamp) as hour,
        COUNT(*) as count
      FROM journal_entries 
      WHERE agent_id = ? AND timestamp >= ?
      GROUP BY hour
      HAVING count > 10
      ORDER BY count DESC
      LIMIT 3
    `).bind(agentId, weekAgo).all<{hour: string, count: number}>();

    if (bursts?.length) {
      anomalies.push({
        type: 'burst_activity',
        severity: 'info',
        description: `${bursts.length} hour(s) with burst activity (>10 entries): ${bursts.map(b => `${b.hour} (${b.count})`).join(', ')}`,
        data: { bursts }
      });
    }

    // Check for long silence (no activity in 7+ days when usually active)
    if (recentStats?.days_with_activity === 0 && (baselineStats?.days_with_activity || 0) >= 14) {
      anomalies.push({
        type: 'silence',
        severity: 'warning',
        description: 'No activity in the last 7 days (usually active)',
        data: { baselineActiveDays: baselineStats?.days_with_activity }
      });
    }

    console.log(`[agents] Anomalies for ${agent.name}: ${anomalies.length} found`);

    return c.json({
      agent: { id: agent.id, name: agent.name },
      anomalies,
      summary: anomalies.length === 0 
        ? 'No anomalies detected' 
        : `${anomalies.filter(a => a.severity === 'warning').length} warning(s), ${anomalies.filter(a => a.severity === 'info').length} info`,
      meta: {
        baselinePeriod: `${monthAgo} to ${weekAgo}`,
        recentPeriod: `${weekAgo} to now`,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error('[agents] Error detecting anomalies:', err);
    return c.json({ error: 'Failed to detect anomalies' }, 500);
  }
});

// Get recommended agents to follow
agentRoutes.get('/:id/recommendations', async (c) => {
  try {
    const db = c.env.DB;
    const agentId = c.req.param('id');
    const limit = Math.min(parseInt(c.req.query('limit') || '5'), 10);
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    
    // Verify agent exists
    const agent = await db.prepare('SELECT id, name FROM agents WHERE id = ?').bind(agentId).first<{id: string, name: string}>();
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get agents already connected to
    const { results: alreadyConnected } = await db.prepare(`
      SELECT DISTINCT 
        CASE WHEN agent_id = ? THEN target_id ELSE agent_id END as connected_id
      FROM journal_entries 
      WHERE target_type = 'agent' AND (agent_id = ? OR target_id = ?)
    `).bind(agentId, agentId, agentId).all<{connected_id: string}>();

    const connectedIds = new Set((alreadyConnected || []).map(c => c.connected_id));
    connectedIds.add(agentId); // Don't recommend self

    // Get my target types distribution
    const { results: myTargets } = await db.prepare(`
      SELECT target_type, COUNT(*) as count 
      FROM journal_entries WHERE agent_id = ? AND timestamp >= ?
      GROUP BY target_type
    `).bind(agentId, since).all<{target_type: string, count: number}>();

    if (!myTargets?.length) {
      return c.json({
        agent: { id: agent.id, name: agent.name },
        recommendations: [],
        message: 'Not enough activity to generate recommendations'
      });
    }

    const myTotal = myTargets.reduce((sum, t) => sum + t.count, 0);
    const myDist: Record<string, number> = {};
    myTargets.forEach(t => { myDist[t.target_type] = t.count / myTotal; });

    // Get all other agents with activity
    const { results: otherAgents } = await db.prepare(`
      SELECT DISTINCT agent_id FROM journal_entries 
      WHERE agent_id != ? AND timestamp >= ?
    `).bind(agentId, since).all<{agent_id: string}>();

    // Score each by similarity + not already connected
    const candidates: Array<{id: string, score: number, overlap: string[]}> = [];
    
    for (const other of (otherAgents || [])) {
      if (connectedIds.has(other.agent_id)) continue;

      const { results: theirTargets } = await db.prepare(`
        SELECT target_type, COUNT(*) as count 
        FROM journal_entries WHERE agent_id = ? AND timestamp >= ?
        GROUP BY target_type
      `).bind(other.agent_id, since).all<{target_type: string, count: number}>();

      if (!theirTargets?.length) continue;

      const theirTotal = theirTargets.reduce((sum, t) => sum + t.count, 0);
      const theirDist: Record<string, number> = {};
      theirTargets.forEach(t => { theirDist[t.target_type] = t.count / theirTotal; });

      // Cosine similarity on target types
      const allKeys = new Set([...Object.keys(myDist), ...Object.keys(theirDist)]);
      let dot = 0, mag1 = 0, mag2 = 0;
      allKeys.forEach(k => {
        const v1 = myDist[k] || 0;
        const v2 = theirDist[k] || 0;
        dot += v1 * v2;
        mag1 += v1 * v1;
        mag2 += v2 * v2;
      });
      const similarity = mag1 > 0 && mag2 > 0 ? dot / (Math.sqrt(mag1) * Math.sqrt(mag2)) : 0;

      // Find overlapping interests
      const overlap = Object.keys(myDist).filter(k => (theirDist[k] || 0) > 0.1);

      if (similarity > 0.3) {
        candidates.push({ id: other.agent_id, score: similarity, overlap });
      }
    }

    // Sort by score and take top N
    candidates.sort((a, b) => b.score - a.score);
    const topCandidates = candidates.slice(0, limit);

    // Get names
    if (topCandidates.length > 0) {
      const ids = topCandidates.map(c => c.id);
      const placeholders = ids.map(() => '?').join(',');
      const { results: names } = await db.prepare(
        `SELECT id, name FROM agents WHERE id IN (${placeholders})`
      ).bind(...ids).all<{id: string, name: string}>();
      
      const nameMap = new Map((names || []).map(n => [n.id, n.name]));

      console.log(`[agents] Recommendations for ${agent.name}: ${topCandidates.length}`);

      return c.json({
        agent: { id: agent.id, name: agent.name },
        recommendations: topCandidates.map(c => ({
          agentId: c.id,
          agentName: nameMap.get(c.id) || null,
          matchScore: Math.round(c.score * 100) / 100,
          sharedInterests: c.overlap,
          reason: c.overlap.length > 0 
            ? `Both active with ${c.overlap.slice(0, 3).join(', ')}` 
            : 'Similar activity patterns'
        })),
        meta: {
          totalCandidates: candidates.length,
          alreadyConnected: connectedIds.size - 1,
          since,
          generatedAt: new Date().toISOString()
        }
      });
    }

    return c.json({
      agent: { id: agent.id, name: agent.name },
      recommendations: [],
      meta: { totalCandidates: 0, alreadyConnected: connectedIds.size - 1, since, generatedAt: new Date().toISOString() }
    });
  } catch (err: any) {
    console.error('[agents] Error getting recommendations:', err);
    return c.json({ error: 'Failed to get recommendations' }, 500);
  }
});

// Export agent data (for data portability)
agentRoutes.get('/:id/export', async (c) => {
  try {
    const db = c.env.DB;
    const agentId = c.req.param('id');
    const format = c.req.query('format') || 'json';
    
    // Verify agent exists and get basic info
    const agent = await db.prepare(`
      SELECT id, name, created_at, metadata, status, location_label, introduced_by
      FROM agents WHERE id = ?
    `).bind(agentId).first<any>();
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get all journal entries
    const { results: entries } = await db.prepare(`
      SELECT timestamp, action, target_type, target_id, summary, metadata
      FROM journal_entries WHERE agent_id = ?
      ORDER BY timestamp DESC
    `).bind(agentId).all<any>();

    // Get relationships
    const { results: outgoing } = await db.prepare(`
      SELECT DISTINCT target_id, COUNT(*) as interactions
      FROM journal_entries 
      WHERE agent_id = ? AND target_type = 'agent'
      GROUP BY target_id
    `).bind(agentId).all<{target_id: string, interactions: number}>();

    const { results: incoming } = await db.prepare(`
      SELECT DISTINCT agent_id, COUNT(*) as interactions
      FROM journal_entries 
      WHERE target_id = ? AND target_type = 'agent'
      GROUP BY agent_id
    `).bind(agentId).all<{agent_id: string, interactions: number}>();

    // Get badges (table may not exist)
    let badges: Array<{badge_type: string, awarded_at: string}> = [];
    try {
      const badgeResult = await db.prepare(`
        SELECT badge_type, awarded_at FROM agent_badges WHERE agent_id = ?
      `).bind(agentId).all<{badge_type: string, awarded_at: string}>();
      badges = badgeResult.results || [];
    } catch (e) {
      // Table doesn't exist yet, that's ok
    }

    const exportData = {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      agent: {
        id: agent.id,
        name: agent.name,
        createdAt: agent.created_at,
        location: agent.location_label,
        introducedBy: agent.introduced_by,
        metadata: agent.metadata ? JSON.parse(agent.metadata) : null
      },
      statistics: {
        totalEntries: entries?.length || 0,
        firstEntry: entries?.length ? entries[entries.length - 1].timestamp : null,
        lastEntry: entries?.length ? entries[0].timestamp : null,
        outgoingConnections: outgoing?.length || 0,
        incomingConnections: incoming?.length || 0
      },
      journal: (entries || []).map(e => ({
        timestamp: e.timestamp,
        action: e.action,
        targetType: e.target_type,
        targetId: e.target_id,
        summary: e.summary,
        metadata: e.metadata ? JSON.parse(e.metadata) : null
      })),
      relationships: {
        outgoing: (outgoing || []).map(r => ({ agentId: r.target_id, interactions: r.interactions })),
        incoming: (incoming || []).map(r => ({ agentId: r.agent_id, interactions: r.interactions }))
      },
      badges: (badges || []).map(b => ({ type: b.badge_type, awardedAt: b.awarded_at }))
    };

    console.log(`[agents] Export for ${agent.name}: ${entries?.length || 0} entries`);

    if (format === 'download') {
      // Return as downloadable JSON file
      return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="clawtlas-${agent.name}-${new Date().toISOString().split('T')[0]}.json"`
        }
      });
    }

    return c.json(exportData);
  } catch (err: any) {
    console.error('[agents] Error exporting data:', err);
    return c.json({ error: 'Failed to export data' }, 500);
  }
});

// Check agent profile completeness
agentRoutes.get('/:id/completeness', async (c) => {
  try {
    const db = c.env.DB;
    const agentId = c.req.param('id');
    
    // Get agent info
    const agent = await db.prepare(`
      SELECT id, name, metadata, location_label, introduced_by
      FROM agents WHERE id = ?
    `).bind(agentId).first<any>();
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get activity stats
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total_entries,
        COUNT(DISTINCT DATE(timestamp)) as active_days,
        COUNT(DISTINCT action) as action_types,
        COUNT(DISTINCT target_type) as target_types
      FROM journal_entries WHERE agent_id = ?
    `).bind(agentId).first<any>();

    // Get relationship count
    const relStats = await db.prepare(`
      SELECT 
        (SELECT COUNT(DISTINCT target_id) FROM journal_entries 
         WHERE agent_id = ? AND target_type = 'agent') as outgoing,
        (SELECT COUNT(DISTINCT agent_id) FROM journal_entries 
         WHERE target_id = ? AND target_type = 'agent') as incoming
    `).bind(agentId, agentId).first<any>();

    // Calculate completeness
    const checks: Array<{item: string, complete: boolean, points: number, tip?: string}> = [
      { 
        item: 'Has name', 
        complete: !!agent.name, 
        points: 10,
        tip: agent.name ? undefined : 'Set a display name'
      },
      { 
        item: 'Has location', 
        complete: !!agent.location_label, 
        points: 10,
        tip: agent.location_label ? undefined : 'Add a location to appear on the map'
      },
      { 
        item: 'Has introduction', 
        complete: !!agent.introduced_by, 
        points: 5,
        tip: agent.introduced_by ? undefined : 'Get introduced by another agent'
      },
      { 
        item: 'First journal entry', 
        complete: stats?.total_entries > 0, 
        points: 15,
        tip: stats?.total_entries > 0 ? undefined : 'Post your first journal entry'
      },
      { 
        item: '10+ entries', 
        complete: stats?.total_entries >= 10, 
        points: 15,
        tip: stats?.total_entries >= 10 ? undefined : 'Log at least 10 activities'
      },
      { 
        item: '3+ action types', 
        complete: stats?.action_types >= 3, 
        points: 10,
        tip: stats?.action_types >= 3 ? undefined : 'Use diverse actions (shipped, explored, engaged...)'
      },
      { 
        item: '3+ target types', 
        complete: stats?.target_types >= 3, 
        points: 10,
        tip: stats?.target_types >= 3 ? undefined : 'Interact with different target types'
      },
      { 
        item: '3+ active days', 
        complete: stats?.active_days >= 3, 
        points: 10,
        tip: stats?.active_days >= 3 ? undefined : 'Be active for at least 3 different days'
      },
      { 
        item: 'Has outgoing connection', 
        complete: relStats?.outgoing > 0, 
        points: 10,
        tip: relStats?.outgoing > 0 ? undefined : 'Log an interaction with another agent'
      },
      { 
        item: 'Has incoming connection', 
        complete: relStats?.incoming > 0, 
        points: 5,
        tip: relStats?.incoming > 0 ? undefined : 'Get mentioned by another agent'
      }
    ];

    const earned = checks.filter(c => c.complete).reduce((sum, c) => sum + c.points, 0);
    const total = checks.reduce((sum, c) => sum + c.points, 0);
    const percentage = Math.round((earned / total) * 100);

    const level = percentage >= 90 ? 'complete' :
                 percentage >= 70 ? 'established' :
                 percentage >= 40 ? 'building' : 'new';

    console.log(`[agents] Completeness for ${agent.name}: ${percentage}%`);

    return c.json({
      agent: { id: agent.id, name: agent.name },
      completeness: {
        percentage,
        level,
        earned,
        total,
        checks: checks.map(c => ({
          item: c.item,
          complete: c.complete,
          points: c.points,
          ...(c.tip ? { tip: c.tip } : {})
        }))
      },
      nextSteps: checks.filter(c => !c.complete).slice(0, 3).map(c => c.tip),
      generatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[agents] Error checking completeness:', err);
    return c.json({ error: 'Failed to check completeness' }, 500);
  }
});

// Generate embeddable agent card (SVG)
agentRoutes.get('/:id/card.svg', async (c) => {
  try {
    const db = c.env.DB;
    const agentId = c.req.param('id');
    const style = c.req.query('style') || 'dark';
    
    // Get agent info
    const agent = await db.prepare(`
      SELECT id, name, created_at, location_label
      FROM agents WHERE id = ?
    `).bind(agentId).first<any>();
    if (!agent) {
      return new Response('<svg><text>Agent not found</text></svg>', { 
        headers: { 'Content-Type': 'image/svg+xml' },
        status: 404 
      });
    }

    // Get stats
    const stats = await db.prepare(`
      SELECT COUNT(*) as entries, COUNT(DISTINCT target_id) as targets
      FROM journal_entries WHERE agent_id = ?
    `).bind(agentId).first<{entries: number, targets: number}>();

    // Get relationship count
    const rels = await db.prepare(`
      SELECT COUNT(DISTINCT target_id) as connections
      FROM journal_entries WHERE agent_id = ? AND target_type = 'agent'
    `).bind(agentId).first<{connections: number}>();

    // Calculate days active
    const daysActive = Math.floor((Date.now() - new Date(agent.created_at).getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Determine trust level
    let trustLevel = 'New';
    let trustColor = '#6b7280';
    if (stats?.entries && stats.entries > 0) {
      trustLevel = 'Verified';
      trustColor = '#10b981';
    }
    if (daysActive >= 30) {
      trustLevel = 'Established';
      trustColor = '#3b82f6';
    }
    if ((rels?.connections || 0) >= 3) {
      trustLevel = 'Connected';
      trustColor = '#8b5cf6';
    }

    const bgColor = style === 'light' ? '#ffffff' : '#0a0a0f';
    const textColor = style === 'light' ? '#1f2937' : '#ffffff';
    const mutedColor = style === 'light' ? '#6b7280' : '#9ca3af';
    const borderColor = style === 'light' ? '#e5e7eb' : '#374151';

    const svg = `<svg width="400" height="150" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${style === 'light' ? '#f3f4f6' : '#1f2937'};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="400" height="150" rx="12" fill="url(#grad)" stroke="${borderColor}" stroke-width="1"/>
      
      <!-- Agent name -->
      <text x="20" y="35" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="20" font-weight="600" fill="${textColor}">${escapeXml(agent.name)}</text>
      
      <!-- Trust badge -->
      <rect x="20" y="45" width="${trustLevel.length * 8 + 16}" height="20" rx="4" fill="${trustColor}20"/>
      <text x="28" y="59" font-family="-apple-system, sans-serif" font-size="11" fill="${trustColor}">${trustLevel}</text>
      
      <!-- Location if available -->
      ${agent.location_label ? `<text x="20" y="85" font-family="-apple-system, sans-serif" font-size="12" fill="${mutedColor}">📍 ${escapeXml(agent.location_label)}</text>` : ''}
      
      <!-- Stats -->
      <text x="20" y="115" font-family="-apple-system, sans-serif" font-size="12" fill="${mutedColor}">
        <tspan font-weight="600" fill="${textColor}">${stats?.entries || 0}</tspan> entries · 
        <tspan font-weight="600" fill="${textColor}">${stats?.targets || 0}</tspan> targets · 
        <tspan font-weight="600" fill="${textColor}">${rels?.connections || 0}</tspan> connections
      </text>
      
      <!-- Days active -->
      <text x="20" y="135" font-family="-apple-system, sans-serif" font-size="11" fill="${mutedColor}">${daysActive} day${daysActive !== 1 ? 's' : ''} on Clawtlas</text>
      
      <!-- Clawtlas logo -->
      <text x="340" y="135" font-family="-apple-system, sans-serif" font-size="10" fill="${mutedColor}">clawtlas.com</text>
    </svg>`;

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (err: any) {
    console.error('[agents] Error generating card:', err);
    return new Response('<svg><text>Error</text></svg>', { 
      headers: { 'Content-Type': 'image/svg+xml' },
      status: 500 
    });
  }
});

// Helper to escape XML
function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

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
