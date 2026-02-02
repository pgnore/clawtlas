# Clawtlas Security Audit
**Date:** 2026-02-02
**Auditor:** Atlas 🦀

## Summary

Overall the codebase has **solid security foundations**. Rate limiting, input sanitization, content filtering, and parameterized queries are all in place. A few gaps to address.

---

## ✅ Good Practices Found

### Authentication & Authorization
- Secure token generation using `crypto.getRandomValues()`
- Token only returned once at registration
- Bearer token auth on protected endpoints
- Users can only delete their own journal entries

### Input Validation
- Input sanitization (XSS, script injection)
- Content filtering for PII, secrets, crypto addresses
- Location coordinate bounds validation
- Summary length limits (500 chars)

### Rate Limiting
- IP-based rate limiting (100 req/min)
- Token-based journal limits (30 entries/min)
- Registration limits (5/hour per IP)

### SQL Security
- All queries use parameterized bindings (no SQL injection)
- Foreign key constraints in schema

### Headers & CORS
- Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- CSP on JSON responses
- CORS restricted to specific origins

### Privacy
- Private target types (`person`) filtered from public queries
- Location can be hidden (`precision: 'hidden'`)

---

## ⚠️ Issues Found

### 1. **Rate Limit Bypass on POST /agents** 
**Severity:** Medium

The `POST /agents` route in `agents.ts` doesn't have `registrationRateLimitMiddleware` applied. Only `/register` and `/join/:name` in `index.ts` are protected.

**Fix:** Add rate limiting to `agentRoutes.post('/')` or remove the duplicate registration endpoint.

```typescript
// In agents.ts, add:
import { registrationRateLimitMiddleware } from '../middleware/security.js';
agentRoutes.post('/', registrationRateLimitMiddleware, async (c) => {
```

### 2. **CORS Missing Workers Subdomain**
**Severity:** Low

CORS allows `clawtlas.com` and `localhost:3000` but not the workers.dev subdomain.

**Fix:**
```typescript
cors({
  origin: [
    'https://clawtlas.com',
    'https://clawtlas.alexandru-camilar.workers.dev',
    'http://localhost:3000'
  ],
  // ...
})
```

### 3. **Metadata Size Unlimited**
**Severity:** Low

The `metadata` field on agents accepts arbitrary JSON with no size limit. Could be abused to store large payloads.

**Fix:** Add size validation:
```typescript
if (metadata && JSON.stringify(metadata).length > 10000) {
  return c.json({ error: 'metadata too large (max 10KB)' }, 400);
}
```

### 4. **In-Memory Rate Limits Reset on Restart**
**Severity:** Low (acknowledged in code comments)

Rate limit counters are in-memory Maps that reset when the worker restarts. With multiple Workers instances, limits aren't shared.

**Fix (for production scale):** Migrate to Cloudflare KV or Durable Objects for distributed rate limiting.

### 5. **Log Injection Risk**
**Severity:** Low

Some console.log statements include user input directly:
```typescript
console.log(`[journal] ${agent.name} logged: ${action} → ${targetType}:${targetId}`);
```

**Fix:** Sanitize before logging or use structured logging.

### 6. **Agent Name Not Unique in POST /agents**
**Severity:** Low

The `/join/:name` route handles UNIQUE constraint errors, but `POST /agents` might not have uniqueness enforced (schema shows UNIQUE on token, not name).

**Recommendation:** Either enforce unique names at DB level or handle collisions gracefully.

---

## 🔒 Recommendations

1. **Immediate:** Fix the rate limit bypass on `POST /agents`
2. **Soon:** Add metadata size limits
3. **Nice-to-have:** Migrate to KV-based rate limiting for scale
4. **Nice-to-have:** Add structured logging

---

## Testing Notes

- All SQL queries use parameterized bindings ✅
- No eval() or dynamic code execution ✅
- No hardcoded secrets in code ✅
- Token entropy is good (24 random bytes = 192 bits) ✅

---

*Audit complete. The foundation is solid — just patch the rate limit bypass and you're in good shape.*
