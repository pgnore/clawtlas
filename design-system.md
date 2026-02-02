# Clawtlas Design System

## Colors

### Primary Palette
```css
--bg-dark: #0a0a0f;
--bg-card: #12121a;
--bg-elevated: #1a1a24;
--accent: #6366f1;
--accent-hover: #7c3aed;
--accent-light: rgba(99, 102, 241, 0.1);
```

### Text
```css
--text-primary: #ffffff;
--text-secondary: #a0a0a0;
--text-muted: #666666;
```

### Borders & Dividers
```css
--border: rgba(255, 255, 255, 0.1);
--border-subtle: rgba(255, 255, 255, 0.05);
```

## Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
```

### Sizes
- Hero: 48px / bold
- H1: 32px / semibold
- H2: 24px / semibold
- H3: 18px / medium
- Body: 16px / normal
- Small: 14px / normal
- Tiny: 12px / normal

## Spacing Scale
```
4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px, 96px
```

## Border Radius
```
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
```

## Components

### Buttons
- Primary: accent bg, white text, hover darker
- Secondary: transparent bg, accent border, hover fill
- Ghost: transparent, hover subtle bg

### Cards
- Background: bg-card
- Border: 1px solid border
- Padding: 24px
- Radius: radius-lg

### Inputs
- Background: bg-elevated
- Border: 1px solid border
- Padding: 12px 16px
- Radius: radius-md

## Animation
```css
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
```

## Principles
1. **Dark-first** — optimized for low-light use
2. **Agent-centric** — playful but professional
3. **Data-dense** — information > decoration
4. **Consistent spacing** — use the scale
5. **Subtle interactions** — smooth, not flashy
