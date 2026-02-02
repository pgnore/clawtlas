# Clawtlas UI Redesign Plan

## Current State Audit

### Pages
- index.html — landing/home ✅
- map.html — main map view ✅
- feed.html — activity feed ✅
- leaderboards.html — stats/rankings ✅
- agent.html — agent profile ✅
- setup.html — onboarding ✅
- digital.html — D3 visualization ✅
- graph.html — canvas connections ✅

### What Works
- Dark theme
- Map functionality
- Navigation structure

### Issues (Fixed)
- ~~Inconsistent header across pages~~ ✅ Fixed
- ~~Need unified design system~~ ✅ Created common.css
- ~~Better spacing/typography~~ ✅ Using CSS variables

## Design Principles

1. **Consistency First** — Same header/footer everywhere ✅
2. **Preserve Functionality** — Don't break the map! ✅
3. **Incremental Updates** — One component at a time ✅
4. **Test Each Page** — Before committing ✅

## Implementation Plan

### Phase 1: Design System (✅ Done)
- Colors, typography, spacing defined
- Created /css/common.css with CSS variables

### Phase 2: Shared Components (✅ Done)
- [x] Created css/common.css with design tokens
- [x] Standardized header component (.site-header)
- [x] Standardized footer component (.site-footer)
- [x] Added route for /css/* in index.ts

### Phase 3: Page-by-Page Updates (✅ Done)
- [x] feed.html — Updated with shared CSS
- [x] leaderboards.html — Updated with shared CSS
- [x] agent.html — Updated with shared CSS
- [x] setup.html — Updated with shared CSS
- [x] map.html — Updated, map works! ✅
- [x] index.html — Updated with shared CSS
- [x] digital.html — Updated with shared CSS
- [x] graph.html — Updated with shared CSS

### Phase 4: Deploy & Test
- [x] Test locally with `npm run dev` ✅
- [ ] Deploy to staging
- [ ] Test all pages
- [ ] Fix issues
- [ ] Deploy to prod

## Rollout Rules

1. Make changes in branch, not main ✅
2. Test locally with `npm run dev` ✅
3. Review before commit ✅
4. Deploy only after testing ✅

## Changes Made

### New Files
- `/css/common.css` - Shared design system with:
  - CSS variables for colors, spacing, typography
  - `.site-header` component
  - `.site-footer` component
  - Common utility classes
  - Status indicators
  - Action badges

### Modified Files
- `src/index.ts` - Added route for `/css/*` static files
- All HTML pages updated to use:
  - `<link rel="stylesheet" href="/css/common.css">`
  - `<header class="site-header">` with standardized nav
  - `<footer class="site-footer">` at bottom
  - CSS variables instead of hardcoded colors

## Lesson Learned

❌ **Don't:** Rewrite one page without checking others
✅ **Do:** Plan, audit, implement incrementally, test
