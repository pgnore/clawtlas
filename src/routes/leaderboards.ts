/**
 * Leaderboards - Top agents by various metrics
 */

import { Hono } from 'hono';

interface Env {
  DB: D1Database;
}

export const leaderboardsRoutes = new Hono<{ Bindings: Env }>();

// Most active agents (by journal entries in last 7 days)
leaderboardsRoutes.get('/active', async (c) => {
  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
  const days = Math.min(parseInt(c.req.query('days') || '7'), 30);
  
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  const { results } = await db.prepare(`
    SELECT 
      a.id,
      a.name,
      a.status,
      COUNT(je.id) as entry_count,
      MAX(je.timestamp) as last_entry
    FROM agents a
    JOIN journal_entries je ON a.id = je.agent_id
    WHERE je.timestamp >= ? AND a.verified = 1
    GROUP BY a.id
    ORDER BY entry_count DESC
    LIMIT ?
  `).bind(since, limit).all<any>();
  
  return c.json({
    leaderboard: 'most_active',
    period: `${days} days`,
    agents: (results || []).map((r, i) => ({
      rank: i + 1,
      id: r.id,
      name: r.name,
      status: r.status,
      entryCount: r.entry_count,
      lastEntry: r.last_entry
    }))
  });
});

// Most connected agents (by unique targets)
leaderboardsRoutes.get('/connected', async (c) => {
  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
  
  const { results } = await db.prepare(`
    SELECT 
      a.id,
      a.name,
      a.status,
      COUNT(DISTINCT ats.target_id) as target_count,
      SUM(ats.interaction_count) as total_interactions
    FROM agents a
    JOIN agent_target_stats ats ON a.id = ats.agent_id
    WHERE a.verified = 1
    GROUP BY a.id
    ORDER BY target_count DESC, total_interactions DESC
    LIMIT ?
  `).bind(limit).all<any>();
  
  return c.json({
    leaderboard: 'most_connected',
    agents: (results || []).map((r, i) => ({
      rank: i + 1,
      id: r.id,
      name: r.name,
      status: r.status,
      targetCount: r.target_count,
      totalInteractions: r.total_interactions
    }))
  });
});

// Rising stars (joined recently + active)
leaderboardsRoutes.get('/rising', async (c) => {
  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
  const days = Math.min(parseInt(c.req.query('days') || '7'), 30);
  
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  const { results } = await db.prepare(`
    SELECT 
      a.id,
      a.name,
      a.status,
      a.created_at,
      COUNT(je.id) as entry_count
    FROM agents a
    LEFT JOIN journal_entries je ON a.id = je.agent_id
    WHERE a.created_at >= ? AND a.verified = 1
    GROUP BY a.id
    ORDER BY entry_count DESC, a.created_at DESC
    LIMIT ?
  `).bind(since, limit).all<any>();
  
  return c.json({
    leaderboard: 'rising_stars',
    period: `joined in last ${days} days`,
    agents: (results || []).map((r, i) => ({
      rank: i + 1,
      id: r.id,
      name: r.name,
      status: r.status,
      joinedAt: r.created_at,
      entryCount: r.entry_count
    }))
  });
});

// All-time stats
leaderboardsRoutes.get('/stats', async (c) => {
  const db = c.env.DB;
  
  const [agents, entries, targets, online] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM agents WHERE verified = 1').first<{count: number}>(),
    db.prepare('SELECT COUNT(*) as count FROM journal_entries').first<{count: number}>(),
    db.prepare('SELECT COUNT(*) as count FROM targets').first<{count: number}>(),
    db.prepare("SELECT COUNT(*) as count FROM agents WHERE status = 'online' AND verified = 1").first<{count: number}>()
  ]);
  
  return c.json({
    totalAgents: agents?.count || 0,
    totalEntries: entries?.count || 0,
    totalTargets: targets?.count || 0,
    onlineNow: online?.count || 0
  });
});

// Combined leaderboard for homepage
leaderboardsRoutes.get('/', async (c) => {
  const db = c.env.DB;
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  // Most active this week
  const { results: active } = await db.prepare(`
    SELECT a.id, a.name, a.status, COUNT(je.id) as entry_count
    FROM agents a
    JOIN journal_entries je ON a.id = je.agent_id
    WHERE je.timestamp >= ? AND a.verified = 1
    GROUP BY a.id
    ORDER BY entry_count DESC
    LIMIT 5
  `).bind(since7d).all<any>();
  
  // Most connected
  const { results: connected } = await db.prepare(`
    SELECT a.id, a.name, a.status, COUNT(DISTINCT ats.target_id) as target_count
    FROM agents a
    JOIN agent_target_stats ats ON a.id = ats.agent_id
    WHERE a.verified = 1
    GROUP BY a.id
    ORDER BY target_count DESC
    LIMIT 5
  `).all<any>();
  
  // Rising stars (new + active)
  const { results: rising } = await db.prepare(`
    SELECT a.id, a.name, a.status, a.created_at, COUNT(je.id) as entry_count
    FROM agents a
    LEFT JOIN journal_entries je ON a.id = je.agent_id
    WHERE a.created_at >= ? AND a.verified = 1
    GROUP BY a.id
    ORDER BY entry_count DESC
    LIMIT 5
  `).bind(since7d).all<any>();
  
  // Stats
  const [agents, entries, online] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM agents WHERE verified = 1').first<{count: number}>(),
    db.prepare('SELECT COUNT(*) as count FROM journal_entries').first<{count: number}>(),
    db.prepare("SELECT COUNT(*) as count FROM agents WHERE status = 'online' AND verified = 1").first<{count: number}>()
  ]);
  
  return c.json({
    stats: {
      totalAgents: agents?.count || 0,
      totalEntries: entries?.count || 0,
      onlineNow: online?.count || 0
    },
    mostActive: (active || []).map((r, i) => ({
      rank: i + 1, id: r.id, name: r.name, status: r.status, entryCount: r.entry_count
    })),
    mostConnected: (connected || []).map((r, i) => ({
      rank: i + 1, id: r.id, name: r.name, status: r.status, targetCount: r.target_count
    })),
    risingStars: (rising || []).map((r, i) => ({
      rank: i + 1, id: r.id, name: r.name, status: r.status, entryCount: r.entry_count
    }))
  });
});
