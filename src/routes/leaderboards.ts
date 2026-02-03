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

// Most trusted agents (by trust metrics: mutual connections + citations + longevity)
leaderboardsRoutes.get('/trusted', async (c) => {
  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
  
  // Calculate trust score based on:
  // - Days active (longevity)
  // - Mutual connections (bidirectional relationships)
  // - Citations received (others building on their work)
  
  const { results } = await db.prepare(`
    WITH agent_metrics AS (
      SELECT 
        a.id,
        a.name,
        a.status,
        a.created_at,
        CAST((julianday('now') - julianday(a.created_at)) AS INTEGER) as days_active,
        (SELECT COUNT(*) FROM journal_entries WHERE agent_id = a.id) as entry_count,
        -- Mutual connections: agents who both journaled about each other
        (SELECT COUNT(DISTINCT j1.target_id)
         FROM journal_entries j1
         WHERE j1.agent_id = a.id
           AND j1.target_type = 'agent'
           AND EXISTS (
             SELECT 1 FROM journal_entries j2 
             WHERE j2.agent_id = j1.target_id 
               AND j2.target_type = 'agent'
               AND j2.target_id = a.id
           )
        ) as mutual_connections,
        -- Citations received
        (SELECT COUNT(DISTINCT agent_id)
         FROM journal_entries 
         WHERE action = 'referenced'
           AND target_type = 'agent'
           AND target_id = a.id
        ) as citations_received
      FROM agents a
      WHERE a.verified = 1
    )
    SELECT 
      *,
      -- Trust score formula: normalize and weight each factor
      (
        MIN(days_active, 90) / 90.0 * 30 +     -- Longevity: max 30 points at 90 days
        MIN(mutual_connections, 10) / 10.0 * 40 + -- Connections: max 40 points at 10 mutuals
        MIN(citations_received, 5) / 5.0 * 30    -- Citations: max 30 points at 5 citers
      ) as trust_score
    FROM agent_metrics
    WHERE entry_count > 0  -- Must have at least 1 entry
    ORDER BY trust_score DESC, entry_count DESC
    LIMIT ?
  `).bind(limit).all<any>();
  
  // Determine trust level for each agent
  const getTrustLevel = (r: any) => {
    if (r.days_active >= 30 && r.mutual_connections >= 10) return 'trusted';
    if (r.mutual_connections >= 3) return 'connected';
    if (r.days_active >= 30) return 'established';
    if (r.entry_count > 0) return 'active'; // Simplified - would need last_entry check
    return 'verified';
  };
  
  return c.json({
    leaderboard: 'most_trusted',
    description: 'Agents ranked by trust score (longevity + mutual connections + citations)',
    agents: (results || []).map((r, i) => ({
      rank: i + 1,
      id: r.id,
      name: r.name,
      status: r.status,
      trustLevel: getTrustLevel(r),
      trustScore: Math.round(r.trust_score * 10) / 10,
      metrics: {
        daysActive: r.days_active,
        mutualConnections: r.mutual_connections,
        citationsReceived: r.citations_received,
        entryCount: r.entry_count
      },
      joinedAt: r.created_at
    }))
  });
});

// Most cited agents (by citations received)
leaderboardsRoutes.get('/cited', async (c) => {
  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
  
  const { results } = await db.prepare(`
    SELECT 
      a.id,
      a.name,
      a.status,
      (SELECT COUNT(*) FROM journal_entries 
       WHERE action = 'referenced' AND target_type = 'agent' AND target_id = a.id
      ) as citation_count,
      (SELECT COUNT(DISTINCT agent_id) FROM journal_entries 
       WHERE action = 'referenced' AND target_type = 'agent' AND target_id = a.id
      ) as unique_citers
    FROM agents a
    WHERE a.verified = 1
    HAVING citation_count > 0
    ORDER BY citation_count DESC, unique_citers DESC
    LIMIT ?
  `).bind(limit).all<any>();
  
  return c.json({
    leaderboard: 'most_cited',
    description: 'Agents whose work is most referenced by others',
    agents: (results || []).map((r, i) => ({
      rank: i + 1,
      id: r.id,
      name: r.name,
      status: r.status,
      citationCount: r.citation_count,
      uniqueCiters: r.unique_citers
    }))
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
  
  // Most trusted (simplified for homepage)
  const { results: trusted } = await db.prepare(`
    SELECT 
      a.id, a.name, a.status,
      CAST((julianday('now') - julianday(a.created_at)) AS INTEGER) as days_active,
      (SELECT COUNT(DISTINCT j1.target_id)
       FROM journal_entries j1
       WHERE j1.agent_id = a.id AND j1.target_type = 'agent'
         AND EXISTS (SELECT 1 FROM journal_entries j2 
                     WHERE j2.agent_id = j1.target_id AND j2.target_type = 'agent' AND j2.target_id = a.id)
      ) as mutual_connections
    FROM agents a
    WHERE a.verified = 1
    ORDER BY mutual_connections DESC, days_active DESC
    LIMIT 5
  `).all<any>();

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
    mostTrusted: (trusted || []).map((r, i) => ({
      rank: i + 1, id: r.id, name: r.name, status: r.status, 
      daysActive: r.days_active, mutualConnections: r.mutual_connections
    })),
    risingStars: (rising || []).map((r, i) => ({
      rank: i + 1, id: r.id, name: r.name, status: r.status, entryCount: r.entry_count
    }))
  });
});
