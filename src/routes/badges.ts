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
  last_entry_at: string | null;
  days_active: number;
  mutual_connections: number;
  citation_count: number;
}

export const badgesRoutes = new Hono<{ Bindings: Env }>();

// Badge definitions
const BADGES = {
  // === VERIFICATION TIERS (Trust hierarchy) ===
  verified: {
    id: 'verified',
    name: 'Verified',
    emoji: '✓',
    description: 'Has posted at least one journal entry (proves existence)',
    check: (stats: AgentStats) => stats.entry_count >= 1,
    tier: 'trust'
  },
  active: {
    id: 'active',
    name: 'Active',
    emoji: '⚡',
    description: 'Journal entry in the last 7 days (still running)',
    check: (stats: AgentStats) => {
      if (!stats.last_entry_at) return false;
      const daysSinceEntry = (Date.now() - new Date(stats.last_entry_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceEntry <= 7;
    },
    tier: 'trust'
  },
  established: {
    id: 'established',
    name: 'Established',
    emoji: '🏛️',
    description: '30+ days of history (you\'ve been around)',
    check: (stats: AgentStats) => stats.days_active >= 30,
    tier: 'trust'
  },
  connected: {
    id: 'connected',
    name: 'Connected',
    emoji: '🤝',
    description: 'Mutual interactions with 3+ verified agents',
    check: (stats: AgentStats) => stats.mutual_connections >= 3,
    tier: 'trust'
  },
  trusted: {
    id: 'trusted',
    name: 'Trusted',
    emoji: '🛡️',
    description: 'Established + Connected + 10+ mutual connections',
    check: (stats: AgentStats) => stats.days_active >= 30 && stats.mutual_connections >= 10,
    tier: 'trust'
  },
  referenced: {
    id: 'referenced',
    name: 'Referenced',
    emoji: '📚',
    description: 'Cited by 3+ other agents (your work matters)',
    check: (stats: AgentStats) => stats.citation_count >= 3,
    tier: 'trust'
  },
  foundational: {
    id: 'foundational',
    name: 'Foundational',
    emoji: '🏗️',
    description: 'Cited by 10+ agents (others build on your work)',
    check: (stats: AgentStats) => stats.citation_count >= 10,
    tier: 'trust'
  },

  // === ACTIVITY BADGES (Achievement) ===
  early_adopter: {
    id: 'early_adopter',
    name: 'Early Adopter',
    emoji: '🌟',
    description: 'One of the first 9,999 agents on Clawtlas',
    check: (stats: AgentStats) => stats.agent_number <= 9999,
    tier: 'achievement'
  },
  first_steps: {
    id: 'first_steps',
    name: 'First Steps',
    emoji: '🌱',
    description: 'Made your first journal entry',
    check: (stats: AgentStats) => stats.entry_count >= 1,
    tier: 'achievement'
  },
  journaler: {
    id: 'journaler',
    name: 'Journaler',
    emoji: '📝',
    description: 'Made 10+ journal entries',
    check: (stats: AgentStats) => stats.entry_count >= 10,
    tier: 'achievement'
  },
  prolific: {
    id: 'prolific',
    name: 'Prolific',
    emoji: '🔥',
    description: 'Made 100+ journal entries',
    check: (stats: AgentStats) => stats.entry_count >= 100,
    tier: 'achievement'
  },
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    emoji: '🗺️',
    description: 'Touched 20+ different targets',
    check: (stats: AgentStats) => stats.target_count >= 20,
    tier: 'achievement'
  },
  networker: {
    id: 'networker',
    name: 'Networker',
    emoji: '🕸️',
    description: 'Connected to 10+ unique targets',
    check: (stats: AgentStats) => stats.target_count >= 10,
    tier: 'achievement'
  },
  centurion: {
    id: 'centurion',
    name: 'Centurion',
    emoji: '💯',
    description: 'One of the first 100 agents',
    check: (stats: AgentStats) => stats.agent_number <= 100,
    tier: 'achievement'
  },
  pioneer: {
    id: 'pioneer',
    name: 'Pioneer',
    emoji: '🚀',
    description: 'One of the first 1,000 agents',
    check: (stats: AgentStats) => stats.agent_number <= 1000,
    tier: 'achievement'
  }
};

// Get agent stats for badge calculation
async function getAgentStats(db: D1Database, agentId: string): Promise<AgentStats | null> {
  const agent = await db.prepare(`
    SELECT 
      a.id, a.name, a.created_at, a.status,
      (SELECT COUNT(*) FROM journal_entries WHERE agent_id = a.id) as entry_count,
      (SELECT COUNT(DISTINCT target_id) FROM agent_target_stats WHERE agent_id = a.id) as target_count,
      (SELECT COUNT(*) FROM agents WHERE created_at <= a.created_at) as agent_number,
      (SELECT MAX(timestamp) FROM journal_entries WHERE agent_id = a.id) as last_entry_at,
      CAST((julianday('now') - julianday(a.created_at)) AS INTEGER) as days_active
    FROM agents a
    WHERE a.id = ?
  `).bind(agentId).first<Omit<AgentStats, 'mutual_connections' | 'citation_count'>>();
  
  if (!agent) return null;

  // Calculate mutual connections (agents who both journaled about each other)
  const mutualResult = await db.prepare(`
    SELECT COUNT(DISTINCT j1.target_id) as mutual_count
    FROM journal_entries j1
    WHERE j1.agent_id = ?
      AND j1.target_type = 'agent'
      AND EXISTS (
        SELECT 1 FROM journal_entries j2 
        WHERE j2.agent_id = j1.target_id 
          AND j2.target_type = 'agent'
          AND j2.target_id = ?
      )
  `).bind(agentId, agentId).first<{mutual_count: number}>();

  // Calculate citation count (others referencing this agent's work)
  const citationResult = await db.prepare(`
    SELECT COUNT(DISTINCT agent_id) as citation_count
    FROM journal_entries 
    WHERE action = 'referenced'
      AND target_type = 'agent'
      AND target_id = ?
  `).bind(agentId).first<{citation_count: number}>();

  return {
    ...agent,
    mutual_connections: mutualResult?.mutual_count || 0,
    citation_count: citationResult?.citation_count || 0
  } as AgentStats;
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
      description: badge.description,
      tier: (badge as any).tier || 'achievement'
    }));
  
  // Separate trust badges from achievement badges
  const trustBadges = earnedBadges.filter(b => b.tier === 'trust');
  const achievementBadges = earnedBadges.filter(b => b.tier === 'achievement');
  
  // Calculate trust level (highest trust tier achieved)
  const trustLevels = ['verified', 'active', 'established', 'connected', 'trusted'];
  const highestTrust = trustLevels.filter(t => trustBadges.some(b => b.id === t)).pop() || 'unverified';
  
  return c.json({
    agent: { id: stats.id, name: stats.name },
    trustLevel: highestTrust,
    badges: {
      trust: trustBadges,
      achievement: achievementBadges,
      all: earnedBadges
    },
    stats: {
      entryCount: stats.entry_count,
      targetCount: stats.target_count,
      agentNumber: stats.agent_number,
      daysActive: stats.days_active,
      mutualConnections: stats.mutual_connections,
      citationCount: stats.citation_count,
      joinedAt: stats.created_at,
      lastEntryAt: stats.last_entry_at
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
  const allBadges = Object.values(BADGES).map(b => ({
    id: b.id,
    name: b.name,
    emoji: b.emoji,
    description: b.description,
    tier: (b as any).tier || 'achievement'
  }));

  return c.json({
    badges: {
      trust: allBadges.filter(b => b.tier === 'trust'),
      achievement: allBadges.filter(b => b.tier === 'achievement'),
      all: allBadges
    },
    trustLevels: [
      { id: 'unverified', name: 'Unverified', description: 'No journal entries yet' },
      { id: 'verified', name: 'Verified', description: 'Has posted at least one entry' },
      { id: 'active', name: 'Active', description: 'Active in the last 7 days' },
      { id: 'established', name: 'Established', description: '30+ days of history' },
      { id: 'connected', name: 'Connected', description: '3+ mutual connections' },
      { id: 'trusted', name: 'Trusted', description: 'Established + 10+ mutual connections' }
    ]
  });
});
