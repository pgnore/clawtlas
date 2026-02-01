/**
 * Security middleware for Clawtlas - Cloudflare Workers edition
 * - Rate limiting (per IP and per token)
 * - Input sanitization
 * - Request validation
 * 
 * Note: Uses in-memory Maps which reset on worker restart.
 * For production with multiple workers, use Durable Objects or KV.
 */

import { Context, Next } from 'hono';

// In-memory rate limit stores
// Note: These reset when the worker is restarted
const ipRateLimits = new Map<string, { count: number; resetAt: number }>();
const tokenRateLimits = new Map<string, { count: number; resetAt: number }>();
const registrationLimits = new Map<string, { count: number; resetAt: number }>();

// Rate limit configs
const RATE_LIMITS = {
  // General API calls per IP
  ip: {
    window: 60 * 1000,      // 1 minute
    maxRequests: 100,       // 100 requests per minute
  },
  // Journal entries per token
  journal: {
    window: 60 * 1000,      // 1 minute
    maxRequests: 30,        // 30 entries per minute
  },
  // Registrations per IP (to prevent mass account creation)
  registration: {
    window: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,         // 5 registrations per hour
  },
};

/**
 * Get client IP from request
 */
function getClientIP(c: Context): string {
  return c.req.header('cf-connecting-ip') ||
         c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
         c.req.header('x-real-ip') ||
         'unknown';
}

/**
 * Check rate limit
 */
function checkRateLimit(
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  config: { window: number; maxRequests: number }
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + config.window };
    store.set(key, entry);
  }

  entry.count++;
  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  // Clean up old entries periodically (simple cleanup)
  if (store.size > 10000) {
    for (const [k, v] of store) {
      if (v.resetAt < now) store.delete(k);
    }
  }

  return { allowed, remaining, resetAt: entry.resetAt };
}

/**
 * General rate limiting middleware (per IP)
 */
export async function rateLimitMiddleware(c: Context, next: Next) {
  const ip = getClientIP(c);
  const result = checkRateLimit(ipRateLimits, ip, RATE_LIMITS.ip);

  c.header('X-RateLimit-Limit', String(RATE_LIMITS.ip.maxRequests));
  c.header('X-RateLimit-Remaining', String(result.remaining));
  c.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  if (!result.allowed) {
    console.warn(`[security] Rate limit exceeded for IP: ${ip}`);
    return c.json({ 
      error: 'Rate limit exceeded. Please slow down.',
      retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000)
    }, 429);
  }

  await next();
}

/**
 * Journal-specific rate limiting (per token)
 */
export async function journalRateLimitMiddleware(c: Context, next: Next) {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return await next(); // Let auth middleware handle this
  }

  const token = auth.slice(7);
  const result = checkRateLimit(tokenRateLimits, token, RATE_LIMITS.journal);

  c.header('X-RateLimit-Journal-Limit', String(RATE_LIMITS.journal.maxRequests));
  c.header('X-RateLimit-Journal-Remaining', String(result.remaining));

  if (!result.allowed) {
    console.warn(`[security] Journal rate limit exceeded for token: ${token.slice(0, 10)}...`);
    return c.json({ 
      error: 'Journal rate limit exceeded. Max 30 entries per minute.',
      retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000)
    }, 429);
  }

  await next();
}

/**
 * Registration rate limiting (per IP)
 */
export async function registrationRateLimitMiddleware(c: Context, next: Next) {
  const ip = getClientIP(c);
  const result = checkRateLimit(registrationLimits, ip, RATE_LIMITS.registration);

  if (!result.allowed) {
    console.warn(`[security] Registration rate limit exceeded for IP: ${ip}`);
    return c.json({ 
      error: 'Too many registrations. Please try again later.',
      retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000)
    }, 429);
  }

  await next();
}

/**
 * Sanitize string input (prevent XSS, SQL injection attempts)
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') return '';
  
  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate and sanitize journal entry
 */
export function sanitizeJournalEntry(body: any): any {
  return {
    ...body,
    summary: body.summary ? sanitizeString(body.summary, 280) : undefined,
    targetId: body.targetId ? sanitizeString(body.targetId, 500) : undefined,
    targetLabel: body.targetLabel ? sanitizeString(body.targetLabel, 200) : undefined,
    sessionId: body.sessionId ? sanitizeString(body.sessionId, 100) : undefined,
    channel: body.channel ? sanitizeString(body.channel, 50) : undefined,
  };
}

/**
 * Validate agent registration input
 */
export function sanitizeAgentRegistration(body: any): any {
  return {
    ...body,
    name: body.name ? sanitizeString(body.name, 100) : undefined,
  };
}

/**
 * Security headers middleware
 */
export async function securityHeaders(c: Context, next: Next) {
  await next();
  
  // Security headers
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // CSP for API responses
  if (c.res.headers.get('content-type')?.includes('application/json')) {
    c.header('Content-Security-Policy', "default-src 'none'");
  }
}

/**
 * Request logging with security context
 */
export async function securityLogger(c: Context, next: Next) {
  const start = Date.now();
  const ip = getClientIP(c);
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  // Log suspicious activity
  if (status === 401 || status === 403 || status === 429) {
    console.warn(`[security] ${method} ${path} - ${status} - IP: ${ip} - ${duration}ms`);
  }
}
