/**
 * Journal routes - Cloudflare D1 edition
 */

import { Hono } from 'hono';
import { ulid } from 'ulid';
import { journalRateLimitMiddleware, sanitizeJournalEntry } from '../middleware/security.js';

// Cloudflare Workers bindings
interface Env {
  DB: D1Database;
}

interface Agent {
  id: string;
  name: string;
  token: string;
}

interface JournalEntry {
  id: string;
  timestamp: string;
  agent_id: string;
  agent_name?: string;
  action: string;
  target_type: string;
  target_id: string;
  summary: string;
  target_label?: string;
  session_id?: string;
  channel?: string;
  confidence?: number;
  metadata?: string;
}

type Variables = {
  agent: Agent;
};

export const journalRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Valid action types
const ACTIONS = new Set([
  'message_sent',
  'message_received', 
  'file_read',
  'file_write',
  'search',
  'url_fetch',
  'calendar_read',
  'calendar_write',
  'memory_access',
  'tool_use'
]);

// Valid target types
const TARGET_TYPES = new Set([
  'person',
  'file',
  'url',
  'topic',
  'channel',
  'event',
  'agent'
]);

// Auth middleware
async function requireAuth(c: any, next: any) {
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

  c.set('agent', agent);
  await next();
}

// Create journal entry (auth required, rate limited)
journalRoutes.post('/', journalRateLimitMiddleware, requireAuth, async (c) => {
  try {
    const db = c.env.DB;
    const agent = c.get('agent');
    const rawBody = await c.req.json();
    const body = sanitizeJournalEntry(rawBody);

    // Validate required fields
    const { timestamp, action, targetType, targetId, summary } = body;

    if (!timestamp) {
      return c.json({ error: 'timestamp is required (ISO 8601)' }, 400);
    }
    if (!action || !ACTIONS.has(action)) {
      return c.json({ 
        error: `action must be one of: ${[...ACTIONS].join(', ')}` 
      }, 400);
    }
    if (!targetType || !TARGET_TYPES.has(targetType)) {
      return c.json({ 
        error: `targetType must be one of: ${[...TARGET_TYPES].join(', ')}` 
      }, 400);
    }
    if (!targetId) {
      return c.json({ error: 'targetId is required' }, 400);
    }
    if (!summary || summary.length > 280) {
      return c.json({ error: 'summary is required (max 280 chars)' }, 400);
    }

    const id = body.id || ulid();

    await db.prepare(`
      INSERT INTO journal_entries 
      (id, timestamp, agent_id, action, target_type, target_id, summary, target_label, session_id, channel, confidence, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      timestamp,
      agent.id,
      action,
      targetType,
      targetId,
      summary,
      body.targetLabel || null,
      body.sessionId || null,
      body.channel || null,
      body.confidence ?? 1.0,
      body.metadata ? JSON.stringify(body.metadata) : null
    ).run();

    // Update agent presence
    await db.prepare('UPDATE agents SET last_seen = datetime(\'now\') WHERE id = ?').bind(agent.id).run();

    console.log(`[journal] ${agent.name} logged: ${action} → ${targetType}:${targetId}`);

    return c.json({ id, status: 'created' }, 201);
  } catch (err: any) {
    console.error('[journal] Error creating entry:', err);
    return c.json({ error: 'Failed to create entry' }, 500);
  }
});

// Query journal entries (public)
journalRoutes.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const agentId = c.req.query('agent') || null;
    const action = c.req.query('action') || null;
    const since = c.req.query('since') || null;
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 500);
    const offset = Math.max(parseInt(c.req.query('offset') || '0'), 0);

    let query = `
      SELECT je.*, a.name as agent_name
      FROM journal_entries je
      JOIN agents a ON je.agent_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (agentId) {
      query += ` AND je.agent_id = ?`;
      params.push(agentId);
    }
    if (action) {
      query += ` AND je.action = ?`;
      params.push(action);
    }
    if (since) {
      query += ` AND je.timestamp >= ?`;
      params.push(since);
    }
    
    query += ` ORDER BY je.timestamp DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = db.prepare(query);
    const { results: entries } = await stmt.bind(...params).all<JournalEntry>();

    return c.json({
      entries: (entries || []).map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        agent_id: e.agent_id,
        agentName: e.agent_name,
        action: e.action,
        target_type: e.target_type,
        target_id: e.target_id,
        target_label: e.target_label,
        summary: e.summary,
        sessionId: e.session_id,
        channel: e.channel,
        confidence: e.confidence,
        metadata: e.metadata ? JSON.parse(e.metadata) : null
      }))
    });
  } catch (err: any) {
    console.error('[journal] Error querying entries:', err);
    return c.json({ error: 'Failed to query entries' }, 500);
  }
});

// Delete entry (auth required, own entries only)
journalRoutes.delete('/:id', requireAuth, async (c) => {
  try {
    const db = c.env.DB;
    const agent = c.get('agent');
    const entryId = c.req.param('id');

    const result = await db.prepare('DELETE FROM journal_entries WHERE id = ? AND agent_id = ?')
      .bind(entryId, agent.id).run();
    
    if (!result.meta.changes || result.meta.changes === 0) {
      return c.json({ error: 'Entry not found or not owned by you' }, 404);
    }

    return c.json({ status: 'deleted' });
  } catch (err: any) {
    console.error('[journal] Error deleting entry:', err);
    return c.json({ error: 'Failed to delete entry' }, 500);
  }
});
