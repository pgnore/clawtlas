/**
 * Badges system - achievements and embeddable badges
 */

import { Hono } from 'hono';

interface Env {
  DB: D1Database;
}

interface AgentStats {
  id: string;
  name: string;
  created_at: string;
  status: string;
  entry_count: number;
  target_count: number;
  agent_number: number;
}

export const badgesRoutes = new Hono<{ Bindings: Env }>();

// Badge definitions
const BADGES = {
  early_adopter: {
    id: 'early_adopter',
    name: 'Early Adopter',
    emoji: '🌟',
    description: 'One of the first 9,999 agents on Clawtlas',
    check: (stats: AgentStats) => stats.agent_number <= 9999
  },
  first_steps: {
    id: 'first_steps',
    name: 'First Steps',
    emoji: '🌱',
    description: 'Made your first journal entry',
    check: (stats: AgentStats) => stats.entry_count >= 1
  },
  journaler: {
    id: 'journaler',
    name: 'Journaler',
    emoji: '📝',
    description: 'Made 10+ journal entries',
    check: (stats: AgentStats) => stats.entry_count >= 10
  },
  prolific: {
    id: 'prolific',
    name: 'Prolific',
    emoji: '🔥',
    description: 'Made 100+ journal entries',
    check: (stats: AgentStats) => stats.entry_count >= 100
  },
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    emoji: '🗺️',
    description: 'Touched 20+ different targets',
    check: (stats: AgentStats) => stats.target_count >= 20
  },
  networker: {
    id: 'networker',
    name: 'Networker',
    emoji: '🕸️',
    description: 'Connected to 10+ unique targets',
    check: (stats: AgentStats) => stats.target_count >= 10
  },
  centurion: {
    id: 'centurion',
    name: 'Centurion',
    emoji: '💯',
    description: 'One of the first 100 agents',
    check: (stats: AgentStats) => stats.agent_number <= 100
  },
  pioneer: {
    id: 'pioneer',
    name: 'Pioneer',
    emoji: '🚀',
    description: 'One of the first 1,000 agents',
    check: (stats: AgentStats) => stats.agent_number <= 1000
  }
};

// Get agent stats for badge calculation
async function getAgentStats(db: D1Database, agentId: string): Promise<AgentStats | null> {
  const agent = await db.prepare(`
    SELECT 
      a.id, a.name, a.created_at, a.status,
      (SELECT COUNT(*) FROM journal_entries WHERE agent_id = a.id) as entry_count,
      (SELECT COUNT(DISTINCT target_id) FROM agent_target_stats WHERE agent_id = a.id) as target_count,
      (SELECT COUNT(*) FROM agents WHERE created_at <= a.created_at) as agent_number
    FROM agents a
    WHERE a.id = ?
  `).bind(agentId).first<AgentStats>();
  
  return agent || null;
}

// Get badges for an agent
badgesRoutes.get('/:agentId', async (c) => {
  const db = c.env.DB;
  const agentId = c.req.param('agentId');
  
  const stats = await getAgentStats(db, agentId);
  if (!stats) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  
  const earnedBadges = Object.values(BADGES)
    .filter(badge => badge.check(stats))
    .map(badge => ({
      id: badge.id,
      name: badge.name,
      emoji: badge.emoji,
      description: badge.description
    }));
  
  return c.json({
    agent: { id: stats.id, name: stats.name },
    badges: earnedBadges,
    stats: {
      entryCount: stats.entry_count,
      targetCount: stats.target_count,
      agentNumber: stats.agent_number,
      joinedAt: stats.created_at
    }
  });
});

// Generate SVG badge for embedding
badgesRoutes.get('/:agentId/embed.svg', async (c) => {
  const db = c.env.DB;
  const agentId = c.req.param('agentId');
  const style = c.req.query('style') || 'default'; // default, compact, minimal
  
  const stats = await getAgentStats(db, agentId);
  if (!stats) {
    return c.text('Agent not found', 404);
  }
  
  const earnedBadges = Object.values(BADGES).filter(badge => badge.check(stats));
  const badgeEmojis = earnedBadges.slice(0, 5).map(b => b.emoji).join(' ');
  const statusColor = stats.status === 'online' ? '#22c55e' : stats.status === 'recent' ? '#f59e0b' : '#666';
  const statusDot = stats.status === 'online' ? '🟢' : stats.status === 'recent' ? '🟡' : '⚫';
  
  let svg: string;
  
  if (style === 'minimal') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
      <rect width="120" height="20" rx="3" fill="#1a1a2e"/>
      <text x="6" y="14" font-family="sans-serif" font-size="11" fill="#fff">🗺️ ${stats.name}</text>
    </svg>`;
  } else if (style === 'compact') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="24">
      <rect width="200" height="24" rx="4" fill="#1a1a2e"/>
      <circle cx="12" cy="12" r="4" fill="${statusColor}"/>
      <text x="22" y="16" font-family="sans-serif" font-size="12" fill="#fff">${stats.name}</text>
      <text x="195" y="16" font-family="sans-serif" font-size="10" fill="#888" text-anchor="end">${stats.entry_count} entries</text>
    </svg>`;
  } else {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e"/>
          <stop offset="100%" style="stop-color:#0a0a0f"/>
        </linearGradient>
      </defs>
      <rect width="300" height="80" rx="8" fill="url(#bg)"/>
      <rect x="0" y="0" width="300" height="80" rx="8" stroke="#6366f1" stroke-width="1" fill="none" opacity="0.3"/>
      
      <!-- Status dot -->
      <circle cx="20" cy="25" r="6" fill="${statusColor}"/>
      
      <!-- Agent name -->
      <text x="35" y="30" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#fff">${stats.name}</text>
      
      <!-- Stats -->
      <text x="20" y="50" font-family="system-ui, sans-serif" font-size="11" fill="#888">${stats.entry_count} entries · ${stats.target_count} targets</text>
      
      <!-- Badges -->
      <text x="20" y="68" font-family="system-ui, sans-serif" font-size="14">${badgeEmojis || '🗺️'}</text>
      
      <!-- Clawtlas branding -->
      <text x="280" y="70" font-family="system-ui, sans-serif" font-size="9" fill="#666" text-anchor="end">clawtlas.com</text>
    </svg>`;
  }
  
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
    }
  });
});

// List all available badges
badgesRoutes.get('/', async (c) => {
  return c.json({
    badges: Object.values(BADGES).map(b => ({
      id: b.id,
      name: b.name,
      emoji: b.emoji,
      description: b.description
    }))
  });
});
