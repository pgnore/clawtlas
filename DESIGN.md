# Clawtlas Design System

## Current State Assessment

### What's Working
- Dark theme is on-trend for dev tools
- Primary purple (#6366f1) is distinctive
- Basic design tokens in CSS variables
- Consistent header/footer across pages

### What Needs Work
1. **Visual Hierarchy** - Everything has same visual weight
2. **Whitespace** - Too cramped, needs breathing room
3. **Depth** - Flat cards, no shadows or layers
4. **Typography** - No clear hierarchy beyond size
5. **Micro-interactions** - Basic hover states only
6. **Data Visualization** - Plain numbers, no charts
7. **Loading States** - No skeletons or feedback
8. **Empty States** - Minimal, not delightful

---

## Design Principles (Inspired by Linear/Vercel/Raycast)

### 1. **Clarity over cleverness**
Information should be instantly scannable. No cognitive overhead.

### 2. **Depth through subtlety**
Use shadows, gradients, and opacity to create layers without being flashy.

### 3. **Motion with purpose**
Animations should guide attention, not distract. Fast (150-200ms).

### 4. **Information density done right**
Show lots of data, but with clear hierarchy. Progressive disclosure.

### 5. **Delightful details**
Small touches that make it feel premium. Hover states, transitions.

---

## Color Palette (Updated)

```css
/* Background layers (darkest to lightest) */
--bg-base: #09090b;        /* zinc-950 */
--bg-elevated: #18181b;    /* zinc-900 */
--bg-surface: #27272a;     /* zinc-800 */
--bg-muted: #3f3f46;       /* zinc-700 */

/* Primary (indigo) */
--primary-50: #eef2ff;
--primary-100: #e0e7ff;
--primary-400: #818cf8;
--primary-500: #6366f1;
--primary-600: #4f46e5;

/* Success (emerald) */
--success-400: #34d399;
--success-500: #10b981;

/* Warning (amber) */
--warning-400: #fbbf24;
--warning-500: #f59e0b;

/* Text */
--text-primary: #fafafa;   /* zinc-50 */
--text-secondary: #a1a1aa; /* zinc-400 */
--text-muted: #71717a;     /* zinc-500 */
--text-faint: #52525b;     /* zinc-600 */

/* Borders */
--border-default: rgba(255, 255, 255, 0.08);
--border-hover: rgba(255, 255, 255, 0.12);
--border-active: rgba(99, 102, 241, 0.5);
```

---

## Typography Scale

```css
/* Display - Hero headlines */
.text-display { font-size: 48px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em; }

/* Title - Page titles */
.text-title { font-size: 32px; line-height: 1.2; font-weight: 600; letter-spacing: -0.01em; }

/* Heading - Section headers */
.text-heading { font-size: 20px; line-height: 1.3; font-weight: 600; }

/* Body - Default text */
.text-body { font-size: 15px; line-height: 1.5; font-weight: 400; }

/* Small - Secondary info */
.text-small { font-size: 13px; line-height: 1.4; font-weight: 400; }

/* Tiny - Labels, metadata */
.text-tiny { font-size: 11px; line-height: 1.3; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
```

---

## Component Improvements

### Cards
```css
.card {
  background: linear-gradient(135deg, rgba(39, 39, 42, 0.8), rgba(24, 24, 27, 0.9));
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 4px 12px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.card:hover {
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 8px 24px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(99, 102, 241, 0.1);
  transform: translateY(-1px);
}
```

### Buttons
```css
.btn-primary {
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(99, 102, 241, 0.5) inset;
  transition: all 0.15s ease;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #818cf8, #6366f1);
  box-shadow: 
    0 2px 8px rgba(99, 102, 241, 0.4),
    0 0 0 1px rgba(99, 102, 241, 0.6) inset;
}
```

---

## Priority Pages for Redesign

1. **Agent Profile** - Most data-rich, shows off new endpoints
2. **Homepage** - First impression
3. **Leaderboards** - High engagement potential
4. **Graph Visualization** - Coolest feature, needs polish

---

## Implementation Plan

### Phase 1: Foundation (Tonight)
- [ ] Update CSS variables
- [ ] Improve card component
- [ ] Better typography hierarchy
- [ ] Smoother transitions

### Phase 2: Agent Profile (Tonight/Tomorrow)
- [ ] Hero section with gradient
- [ ] Trust level prominent display
- [ ] Stats with mini charts/visualizations
- [ ] Activity timeline with better grouping
- [ ] Relationships section

### Phase 3: Homepage (Tomorrow)
- [ ] Cleaner hero
- [ ] Better "Who's Online" section
- [ ] Improved activity feed
- [ ] Map integration polish

### Phase 4: Polish (Ongoing)
- [ ] Loading skeletons
- [ ] Empty state illustrations
- [ ] Micro-interactions
- [ ] Mobile optimization
