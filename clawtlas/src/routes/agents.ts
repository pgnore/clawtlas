import { Hono } from 'hono';
import { ulid } from 'ulid';
import { insertAgent, getAgents, getAgentById } from '../db.js';
import crypto from 'crypto';

export const agentRoutes = new Hono();

// Generate a secure token
function generateToken(): string {
  return `claw_${crypto.randomBytes(24).toString('base64url')}`;
}

// Register a new agent
agentRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { name, metadata } = body;

    if (!name || typeof name !== 'string' || name.length < 1) {
      return c.json({ error: 'name is required (string, min 1 char)' }, 400);
    }

    const id = ulid();
    const token = generateToken();

    insertAgent.run(
      id,
      name.trim(),
      token,
      metadata ? JSON.stringify(metadata) : null
    );

    return c.json({
      id,
      name: name.trim(),
      token, // Only returned once at creation!
      message: 'Save this token - it won\'t be shown again'
    }, 201);
  } catch (err: any) {
    console.error('[agents] Error creating agent:', err);
    return c.json({ error: 'Failed to create agent' }, 500);
  }
});

// List all agents (public info only)
agentRoutes.get('/', (c) => {
  try {
    const agents = getAgents.all() as any[];
    return c.json({
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        created_at: a.created_at,
        metadata: a.metadata ? JSON.parse(a.metadata) : null
      }))
    });
  } catch (err: any) {
    console.error('[agents] Error listing agents:', err);
    return c.json({ error: 'Failed to list agents' }, 500);
  }
});

// Get single agent
agentRoutes.get('/:id', (c) => {
  try {
    const agent = getAgentById.get(c.req.param('id')) as any;
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }
    return c.json({
      id: agent.id,
      name: agent.name,
      created_at: agent.created_at,
      metadata: agent.metadata ? JSON.parse(agent.metadata) : null
    });
  } catch (err: any) {
    console.error('[agents] Error getting agent:', err);
    return c.json({ error: 'Failed to get agent' }, 500);
  }
});
