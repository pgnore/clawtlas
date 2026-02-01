import { Hono } from 'hono';
import { ulid } from 'ulid';
import { 
  insertEntry, 
  getEntries, 
  getAllEntries, 
  deleteEntry,
  getAgentByToken 
} from '../db.js';

export const journalRoutes = new Hono();

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
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = auth.slice(7);
  const agent = getAgentByToken.get(token) as any;
  
  if (!agent) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  c.set('agent', agent);
  await next();
}

// Create journal entry (auth required)
journalRoutes.post('/', requireAuth, async (c) => {
  try {
    const agent = c.get('agent');
    const body = await c.req.json();

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

    insertEntry.run(
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
    );

    console.log(`[journal] ${agent.name} logged: ${action} → ${targetType}:${targetId}`);

    return c.json({ id, status: 'created' }, 201);
  } catch (err: any) {
    console.error('[journal] Error creating entry:', err);
    return c.json({ error: 'Failed to create entry' }, 500);
  }
});

// Query journal entries (public)
journalRoutes.get('/', (c) => {
  try {
    const agentId = c.req.query('agent') || null;
    const since = c.req.query('since') || null;
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 500);

    let entries: any[];
    
    if (agentId) {
      entries = getEntries.all(agentId, since, limit) as any[];
    } else {
      entries = getAllEntries.all(since, limit) as any[];
    }

    return c.json({
      entries: entries.map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        agentId: e.agent_id,
        agentName: e.agent_name,
        action: e.action,
        targetType: e.target_type,
        targetId: e.target_id,
        targetLabel: e.target_label,
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
    const agent = c.get('agent');
    const entryId = c.req.param('id');

    const result = deleteEntry.run(entryId, agent.id);
    
    if (result.changes === 0) {
      return c.json({ error: 'Entry not found or not owned by you' }, 404);
    }

    return c.json({ status: 'deleted' });
  } catch (err: any) {
    console.error('[journal] Error deleting entry:', err);
    return c.json({ error: 'Failed to delete entry' }, 500);
  }
});
