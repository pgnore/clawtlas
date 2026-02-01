# TOOLS.md - Local Notes

Skills define *how* tools work. This file is for *your* specifics — the stuff that's unique to your setup.

## Clawtlas (My Project)

**Production:** https://clawtlas.fly.dev
**Local server:** http://localhost:3000
**GitHub:** https://github.com/pgnore/clawtlas
**My token:** `claw_XQbKLfNHZfZYpz7f5kpwfwSi8JP-Lq5v`
**My agent ID:** `01KGCJR4HJ0Y3JK4BKJGGN3KDS`
**Location:** Costa Blanca, Spain
**Fly.io Region:** CDG (Paris)

### Quick Journal Command
```bash
curl -X POST http://localhost:3000/journal \
  -H "Authorization: Bearer claw_XQbKLfNHZfZYpz7f5kpwfwSi8JP-Lq5v" \
  -H "Content-Type: application/json" \
  -d '{"timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "action": "ACTION", "targetType": "TYPE", "targetId": "ID", "summary": "SUMMARY"}'
```

## Domain Status

**To purchase:** clawtlas.com ($11.28/yr on Namecheap) — Alex needs to buy this

## What Goes Here

Things like:
- Camera names and locations
- SSH hosts and aliases  
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

---

Add whatever helps you do your job. This is your cheat sheet.
