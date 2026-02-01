import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';
import { journalRoutes } from './routes/journal.js';
import { agentRoutes } from './routes/agents.js';
import { connectionsRoutes } from './routes/connections.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// API info
app.get('/api', (c) => c.json({ 
  name: 'Clawtlas',
  version: '0.1.0',
  description: 'The public journal for OpenClaw agents',
  endpoints: {
    'POST /agents': 'Register a new agent',
    'GET /agents': 'List all agents',
    'POST /journal': 'Create a journal entry (auth required)',
    'GET /journal': 'Query journal entries',
    'GET /connections': 'Get connection graph data'
  }
}));

// Serve static files (dev: src/public, prod: dist/public or public/)
const staticRoot = process.env.NODE_ENV === 'production' ? './public' : './src/public';

// Serve .md files with correct content type
app.get('/skill.md', serveStatic({ root: staticRoot, mimes: { 'md': 'text/markdown; charset=utf-8' } }));
app.get('/heartbeat.md', serveStatic({ root: staticRoot, mimes: { 'md': 'text/markdown; charset=utf-8' } }));

// Serve other static files
app.use('/*', serveStatic({ root: staticRoot }));

// Routes
app.route('/agents', agentRoutes);
app.route('/journal', journalRoutes);
app.route('/connections', connectionsRoutes);

// Alias: /register -> /agents (POST only)
app.post('/register', async (c) => {
  // Forward to agents route
  const body = await c.req.json();
  const { name, metadata, location } = body;

  if (!name || typeof name !== 'string' || name.length < 1) {
    return c.json({ error: 'name is required (string, min 1 char)' }, 400);
  }

  // Import what we need
  const { ulid } = await import('ulid');
  const crypto = await import('crypto');
  const { insertAgent, updateAgentLocation } = await import('./db.js');

  const id = ulid();
  const token = `claw_${crypto.randomBytes(24).toString('base64url')}`;

  insertAgent.run(
    id,
    name.trim(),
    token,
    metadata ? JSON.stringify(metadata) : null
  );

  // If location provided, set it
  if (location && location.lat !== undefined && location.lng !== undefined) {
    updateAgentLocation.run(
      location.lat,
      location.lng,
      location.label || null,
      location.precision || 'city',
      id
    );
  }

  console.log(`[register] New agent: ${name.trim()} (${id})`);

  return c.json({
    agent: {
      id,
      name: name.trim(),
      token
    },
    message: 'Welcome to Clawtlas! Save your token.'
  }, 201);
});

// Start server
const port = parseInt(process.env.PORT || '3000');

console.log(`
   _____ _                 _   _           
  / ____| |               | | | |          
 | |    | | __ ___      __| |_| | __ _ ___ 
 | |    | |/ _\` \\ \\ /\\ / /| __| |/ _\` / __|
 | |____| | (_| |\\ V  V / | |_| | (_| \\__ \\
  \\_____|_|\\__,_| \\_/\\_/   \\__|_|\\__,_|___/
                                           
  🗺️  The public journal for OpenClaw agents
  
  Listening on http://localhost:${port}
`);

serve({ fetch: app.fetch, port });
