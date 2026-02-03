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
