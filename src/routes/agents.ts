import { Hono } from 'hono';
import { ulid } from 'ulid';
import { insertAgent, getAgents, getAgentById, getAgentByToken, updateAgentLocation } from '../db.js';
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
    const { name, metadata, location } = body;

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

    // If location provided at registration, set it
    if (location && location.lat !== undefined && location.lng !== undefined) {
      updateAgentLocation.run(
        location.lat,
        location.lng,
        location.label || null,
        location.precision || 'city',
        id
      );
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
agentRoutes.get('/me', (c) => {
  try {
    const auth = c.req.header('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }
    
    const token = auth.slice(7);
    const agent = getAgentByToken.get(token) as any;
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
    const auth = c.req.header('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }
    
    const token = auth.slice(7);
    const agent = getAgentByToken.get(token) as any;
    if (!agent) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const body = await c.req.json();
    
    // Handle location update
    if ('location' in body) {
      if (body.location === null) {
        // Clear location
        updateAgentLocation.run(null, null, null, 'hidden', agent.id);
        console.log(`[agents] ${agent.name} cleared location`);
      } else if (body.location.lat !== undefined && body.location.lng !== undefined) {
        // Update location
        updateAgentLocation.run(
          body.location.lat,
          body.location.lng,
          body.location.label || null,
          body.location.precision || 'city',
          agent.id
        );
        console.log(`[agents] ${agent.name} updated location: ${body.location.label || 'unlabeled'}`);
      }
    }

    // Return updated profile
    const updated = getAgentByToken.get(token) as any;
    return c.json({
      id: updated.id,
      name: updated.name,
      location: updated.location_lat ? {
        lat: updated.location_lat,
        lng: updated.location_lng,
        label: updated.location_label,
        precision: updated.location_precision
      } : null
    });
  } catch (err: any) {
    console.error('[agents] Error updating profile:', err);
    return c.json({ error: 'Failed to update profile' }, 500);
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
        metadata: a.metadata ? JSON.parse(a.metadata) : null,
        location: a.location_precision !== 'hidden' && a.location_lat ? {
          lat: a.location_lat,
          lng: a.location_lng,
          label: a.location_label,
          precision: a.location_precision
        } : null
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
      metadata: agent.metadata ? JSON.parse(agent.metadata) : null,
      location: agent.location_precision !== 'hidden' ? {
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
    const auth = c.req.header('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }
    
    const token = auth.slice(7);
    const agent = getAgentByToken.get(token) as any;
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
      updateAgentLocation.run(null, null, null, 'hidden', agent.id);
      return c.json({ status: 'location hidden' });
    }

    // Otherwise, validate coordinates
    if (lat === undefined || lng === undefined) {
      return c.json({ error: 'lat and lng are required (or set precision to "hidden")' }, 400);
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return c.json({ error: 'Invalid coordinates' }, 400);
    }

    updateAgentLocation.run(
      lat,
      lng,
      label || null,
      precision || 'city',
      agent.id
    );

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
