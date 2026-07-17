# Apple España Design System

A production-grade e-commerce design system inspired by Apple's minimalist philosophy adapted for Spanish market sensibilities.

## Scene & Strategy

**Scene:** A Madrid-based customer browsing a premium product storefront on a sunny afternoon—desktop or mobile, natural light. They seek confidence in quality and ease in navigation. Warmth and clarity matter equally.

**Color Strategy:** Restrained—tinted neutrals + warm copper accent at ~8% surface. Warmth arrives via accent color (inspired by Spanish architectural details), typography hierarchy, and imagery, not a tinted background. This maintains Apple's clarity while adding Iberian personality.

---

## Philosophy

1. **Content First** — Typography and imagery lead. Whitespace is structure, not decoration.
2. **Precision at Scale** — Every token works at every breakpoint. No breakpoint-specific hacks.
3. **Warmth Without Decoration** — Copper accent replaces cold steel. Spacing and type do the work.
4. **Accessibility as Foundation** — WCAG AAA contrast on all interactive elements. No "accessible version" mode—accessibility is the product.
5. **Motion as Feedback** — Animations reveal state, never gate content. Exit animations complete in <200ms.

---

## Color Palette

### Neutral Ramp (50–900)

Nine stops from off-white to near-black. Used for backgrounds, text, and borders. All values desaturated (< 0.01% OKLCH saturation).

- **50–100**: Surfaces above background (cards, modals)
- **200–300**: Borders, dividers
- **400–500**: Tertiary text, disabled states
- **600–700**: Secondary text, placeholders
- **800–900**: Body text (min 800 for ≥4.5:1 contrast)

**Dark mode shifts:** Surface hues invert (light → dark), text lightens, border contrast preserved.

### Accent Color (50–900)

Warm copper, OKLCH hue ~46°. Primary interaction color for:
- Buttons, links, selection states
- Product highlights
- Call-to-action elements

**Usage rule:** Never below 600 for interactive elements (≥4.5:1 AA contrast). Hover: shift one ramp step lighter (e.g., 600 → 500). Focus: one step darker + thin outline.

**Dark mode accent:** Lightens 1–2 steps to maintain readability.

### Semantic Colors

- **Success** (OKLCH 65.2% sat, hue 142°): Form validation, completed states
- **Warning** (75.4%, hue 70°): Alerts, caution messages
- **Error** (63.8%, hue 12°): Validation errors, destructive actions
- **Info** (68.2%, hue 230°): Informational messages

All semantic colors checked at 4.5:1 contrast against surfaces.

---

## Typography

### Font Stack

```css
-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif
```

Falls back to Apple's San Francisco on macOS/iOS; Windows gets Segoe UI; Linux uses generic sans-serif. Mono: Monaco or Menlo; fallback Ubuntu Mono.

### Scale

**Display (Heroes & Landing)**
- **lg:** 3.75rem / 1.1 line / weight 700 / -0.04em letter
- **md:** 3rem / 1.15 line / weight 700 / -0.04em letter
- **sm:** 2.25rem / 1.2 line / weight 600 / -0.02em letter

**Heading (Section Markers)**
- **h1:** 1.875rem / 1.2 line / weight 600 / -0.02em letter
- **h2:** 1.5rem / 1.375 line / weight 600 / -0.02em letter
- **h3:** 1.25rem / 1.5 line / weight 600 / 0em letter
- **h4:** 1.125rem / 1.5 line / weight 600 / 0em letter

**Body (Product & Prose)**
- **lg:** 1.125rem / 1.625 line / weight 400 / 0em letter
- **base:** 1rem / 1.5 line / weight 400 / 0em letter
- **sm:** 0.875rem / 1.5 line / weight 400 / 0em letter
- **xs:** 0.75rem / 1.5 line / weight 400 / 0em letter

### Rules

- **Line length:** Body text capped at 65–75ch; prose expands to ~80ch on desktop.
- **Display letter-spacing:** Tighter is better (≥ -0.04em). Looser display feels cheap.
- **Line height:** Increase with display text (1.1–1.15 for large headings), decrease body (1.5 minimum).
- **Weight:** No light (< 400) for body. Bold (700) reserved for emphasis, not default headings.
- **Text wrapping:** 
  - `text-wrap: balance` on h1–h3 (centers widow words)
  - `text-wrap: pretty` on paragraphs >40ch (improves orphans)
  - Never `text-wrap: wrap` (greedy breaking)

---

## Spacing

Modular scale 1 : 1.25 (minor third). Base unit: 0.25rem (4px).

| Slot | Value | Usage |
|------|-------|-------|
| 1 | 0.25rem | Micro gaps, icon spacing |
| 2 | 0.5rem | Tight component padding |
| 3 | 0.75rem | Input/button internal padding |
| 4 | 1rem | Standard component padding |
| 6 | 1.5rem | Card internal padding |
| 8 | 2rem | Section padding (mobile) |
| 12 | 3rem | Section padding (desktop) |
| 16 | 4rem | Page gutters (desktop) |
| 24 | 6rem | Section separation (desktop) |

**Consistency rule:** No arbitrary spacings (e.g., 11px, 37px). All spacing is a token. Exception: CSS nested grids where the gap is already a token.

---

## Borders & Radius

### Border Radius

- **none:** 0 (no radius; use sparingly)
- **xs:** 0.25rem (form inputs, compact elements)
- **sm:** 0.375rem (subtle, rarely visible)
- **base:** 0.5rem (buttons, cards, most components)
- **md:** 0.75rem (larger cards, modals)
- **lg:** 1rem (hero sections, prominent containers)
- **full:** 9999px (pills, avatars, badges)

**Constraint:** Never use radius ≥ 32px on cards; cap at 1rem. Pill radius (full) reserved for tags, badges, and search inputs.

### Borders

- **Thickness:** 1px always. Never 2px or variable.
- **Color:** `border` (neutral-300) or `borderSubtle` (neutral-200) for secondary dividers.
- **Never use:** Side-stripe borders (border-left/right > 1px as accent). Use full borders or background tints instead.

---

## Shadows

Shadows ground depth. No multiple blurs or complex spreads—keep it simple.

| Elevation | CSS | Use |
|-----------|-----|-----|
| **xs** | 0 1px 2px 0 rgba(0,0,0,0.05) | Hover states, subtle lift |
| **sm** | 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04) | Cards, popovers |
| **base** | 0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.06) | Dropdown menus |
| **md** | 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.05) | Modals, tooltips |
| **lg** | 0 20px 25px -5px rgba(0,0,0,0.08), 0 10px 10px rgba(0,0,0,0.04) | Sticky headers |
| **xl** | 0 25px 50px -12px rgba(0,0,0,0.12) | Full-page modals |

**Dark mode:** Shadows darken slightly (0.16–0.2 opacity) for readability.

---

## Motion & Animation

### Principles

- **Easing:** Cubic-Bezier ease-out (`0.16, 1, 0.3, 1`) for most interactions. Never bounce or elastic.
- **Duration:** 
  - **fast:** 100ms (micro-interactions, hovers)
  - **base:** 150ms (state transitions, focus indicators)
  - **slow:** 200ms (full-page transitions, dismissals)
- **Prefers Reduced:** All animations respect `prefers-reduced-motion: reduce`. Accessibility first.

### Animation Types

**Reveal:** Content slides in from direction of entry (fade-in + 8px y-translate).

```css
animation: fadeSlide 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
@keyframes fadeSlide {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Dismiss:** Content fades and slides out top (reverse of reveal).

```css
animation: dismissSlide 150ms cubic-bezier(0.4, 0, 1, 1) forwards;
@keyframes dismissSlide {
  to { opacity: 0; transform: translateY(-8px); }
}
```

**Focus Ring:** Thin outline + inset shadow on keyboard focus.

```css
outline: 2px solid var(--color-accent);
outline-offset: 2px;
box-shadow: inset 0 0 0 2px var(--color-surface);
```

**No motion-gating:** Never hide or show content based solely on animation classes. Use `visibility: hidden` + animation for backwards compat.

---

## Responsive Design

### Breakpoints

```
xs: 320px   (mobile small)
sm: 640px   (mobile large)
md: 768px   (tablet)
lg: 1024px  (laptop)
xl: 1280px  (desktop)
2xl: 1536px (4K)
```

### Grid Layout

Prefer `repeat(auto-fit, minmax(280px, 1fr))` for product grids (no media queries). Adjust min-width per content type:

- **Product cards:** 280px
- **Blog posts:** 300px
- **Testimonials:** 250px

**No Flexbox for 2D:** Only grid for product layouts. Flex for 1D (navigation, toolbars).

---

## Contrast & Accessibility

### WCAG AA Minimums

All foreground/background pairs must achieve:

- **Normal text (< 18px):** 4.5:1 contrast ratio
- **Large text (≥ 18px bold or ≥ 24px):** 3:1 contrast ratio
- **Placeholders:** 4.5:1 (same as body text)

**Verification:** Use WebAIM Contrast Checker or `color-contrast()` CSS function.

### Color Alone

Never use color as the only indicator of state (error, success, disabled). Pair with:

- Icon or symbol
- Text label
- Thickness change (border weight)
- Position shift (if density permits)

---

## Dark Mode

Automatic via `prefers-color-scheme: dark`. Swaps:

- **Surfaces:** Light→Dark (neutral-100 → neutral-800)
- **Text:** Dark→Light (neutral-900 → neutral-50)
- **Accent:** Consistent hue, lightened 1–2 steps (e.g., accent-600 → accent-500)
- **Shadows:** Darkened slightly for readability

**No separate designs.** Dark mode is the same system with inverted color ramps.

---

## Component Density

| Density | Use Case | Padding | Gap |
|---------|----------|---------|-----|
| **Compact** | Dashboard, data tables | 3–4 (0.75–1rem) | 2–3 (0.5–0.75rem) |
| **Normal** | E-commerce, marketing | 4–6 (1–1.5rem) | 4 (1rem) |
| **Spacious** | Mobile, onboarding | 6–8 (1.5–2rem) | 6–8 (1.5–2rem) |

E-commerce defaults to **Normal** density on all screens.

---

## Implementation Checklist

- [ ] All colors from `TOKENS.json`; no hardcoded hex
- [ ] Typography uses named scales from `DESIGN_SYSTEM.md`
- [ ] Spacing is a multiple of 4px; no arbitrary values
- [ ] Borders are 1px, radius capped at 1rem
- [ ] All interactive elements test ≥4.5:1 contrast
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Focus states use outline + inset shadow
- [ ] Dark mode inverts surfaces and lightens accent
- [ ] Mobile first: no min-width media queries
- [ ] Responsive grid uses `auto-fit` + `minmax()`

---

## References

- **OKLCH Color:** [OKLch Color Space](https://oklab.org/)
- **WCAG 2.1 AA:** [Web Content Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- **Text Wrap:** [CSS Text Level 3 - text-wrap](https://drafts.csswg.org/css-text-3/#text-wrap)
- **Prefers Reduced Motion:** [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
