# Accessibility Specification

WCAG 2.1 Level AA compliance by default. Level AAA where practical without degrading UX.

---

## Contrast & Color

### Minimum Contrast Ratios

| Element | Ratio | WCAG Level |
|---------|-------|-----------|
| Body text (< 18px) | 4.5:1 | AA |
| Large text (≥ 18px bold or ≥ 24px regular) | 3:1 | AA |
| UI components (borders, buttons) | 3:1 | AA |
| Placeholders | 4.5:1 | AA (enhanced) |
| Focus indicators | 3:1 | AA |
| **Target: All text** | **7:1** | **AAA** |

**Measurement:** Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) or CSS `color-contrast()` function.

### Color Use Rules

**Never use color as the sole differentiator of state.** Pair with:

- **Icon** (✓, ✕, warning symbol)
- **Text label** ("Required", "Optional", "Error")
- **Pattern** (hatching, gradient, or texture)
- **Position** (bold vs. light weight, size increase)
- **Aria-label** (screen-reader announcement)

#### Example: Error Field

❌ **Wrong:** Red border only
```html
<input style="border: 2px solid red;" />
```

✓ **Right:** Red border + icon + message
```html
<input 
  aria-invalid="true"
  aria-describedby="error-1"
  style="border: 2px solid var(--color-error-600);"
/>
<div id="error-1" role="alert" class="error-message">
  ✕ Email is invalid
</div>
```

---

## Semantic HTML

### Structure

**Always use semantic elements first; ARIA as augmentation only.**

| Element | Use |
|---------|-----|
| `<header>` | Page header or section header |
| `<nav>` | Navigation menu |
| `<main>` | Primary content |
| `<article>` | Self-contained content (product, blog post) |
| `<section>` | Thematic grouping with heading |
| `<aside>` | Supplementary content (sidebar, related items) |
| `<footer>` | Footer or end-matter |
| `<form>` | Form container |
| `<fieldset>` | Related form fields (radio group, checkbox group) |
| `<legend>` | Fieldset label |
| `<label>` | Input label (not placeholder) |
| `<button>` | Interactive button (not `<div onclick>`) |
| `<a>` | Navigation link (not `<div>` with click handler) |

### Never Use

- `<div onclick="...">` for buttons → Use `<button>`
- `<div>` as link → Use `<a href>`
- Placeholder as form label → Use `<label>`
- `<table>` for layout → Use CSS grid/flexbox
- Decorative `<img>` without `alt=""` → Use CSS background-image or `alt=""` + `role="presentation"`

---

## Labels & Descriptions

### Form Labels

```html
<!-- ✓ Correct: explicit label -->
<label for="email">Email Address</label>
<input id="email" type="email" />

<!-- ✗ Wrong: placeholder as label -->
<input type="email" placeholder="Email Address" />

<!-- ✓ Acceptable: hidden label (label exists, visually hidden) -->
<label for="search" class="sr-only">Search products</label>
<input id="search" type="search" />
```

### Helper Text & Errors

```html
<div class="form-group">
  <label for="password">Password</label>
  <input id="password" type="password" aria-describedby="pwd-hint" />
  <div id="pwd-hint" class="hint-text">Min. 8 characters</div>
</div>

<div class="form-group">
  <label for="email">Email</label>
  <input 
    id="email" 
    type="email" 
    aria-invalid="true"
    aria-describedby="email-error"
  />
  <div id="email-error" role="alert" class="error-message">
    Please enter a valid email
  </div>
</div>
```

### ARIA Descriptions

```html
<!-- Button with tooltip -->
<button aria-label="Save changes" aria-describedby="save-tooltip">
  💾
</button>
<div id="save-tooltip" class="tooltip" role="tooltip">
  Ctrl+S
</div>

<!-- Links with context -->
<a href="/product/123" aria-label="View Retro Camera Pro – €299.00">
  Retro Camera Pro
</a>
```

---

## Focus Management

### Visible Focus Indicators

All interactive elements must have a visible focus state. Never remove `outline`.

```css
/* Remove default outline only if adding custom one */
*:focus {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  /* Never: outline: none; */
}

/* Alternative: focus-ring class */
.focus-ring:focus {
  box-shadow: 0 0 0 3px var(--color-accent-100),
              0 0 0 5px var(--color-accent-600);
}
```

### Tab Order

- Tab order follows visual/logical flow (top→bottom, left→right)
- Use `tabindex` sparingly; prefer HTML source order
- Never use `tabindex > 0` (raises reflow issues)
- Hidden elements: `tabindex="-1"` or `display: none`

```html
<!-- ✓ Good: natural tab order -->
<input id="email" />
<input id="password" />
<button>Sign In</button>

<!-- ✗ Wrong: tabindex > 0 -->
<button tabindex="10">Don't do this</button>
```

### Focus Trapping (Modals)

When a modal opens, focus must remain inside until dismissed.

```javascript
// Pseudo-code
modal.open = () => {
  this.previousFocus = document.activeElement; // Save
  focusFirstElement(modal); // Move focus into modal
  modal.addEventListener("keydown", this.handleEscape);
};

modal.close = () => {
  this.previousFocus?.focus(); // Restore focus
  modal.removeEventListener("keydown", this.handleEscape);
};

handleEscape = (e) => {
  if (e.key === "Escape") this.close();
};
```

---

## Keyboard Navigation

### Supported Keys

| Key | Action |
|-----|--------|
| **Tab** / **Shift+Tab** | Move focus forward/backward |
| **Enter** | Activate button, submit form |
| **Space** | Toggle checkbox/radio, activate button |
| **Escape** | Close modal, popover, dropdown |
| **Arrow Up/Down** | Navigate menu, select options, adjust slider |
| **Arrow Left/Right** | Navigate tabs, carousel |
| **Home/End** | Jump to first/last item in list |

### No Keyboard Traps

Ensure users can move focus away from any element.

```css
/* ✗ Wrong: Focus can't escape */
input:focus {
  outline: none; /* No focus indicator */
  /* Never: pointer-events: none; */
}

/* ✓ Correct: Always provide escape */
input:focus {
  outline: 2px solid var(--color-accent);
}
```

---

## ARIA Attributes

### Use ARIA for Dynamic State

ARIA enhances semantics when HTML alone is insufficient.

#### Live Regions

Announce dynamic updates to screen readers without page reload.

```html
<!-- Results count updates -->
<div aria-live="polite" aria-atomic="true">
  Showing 24 products
</div>

<!-- Cart updates -->
<div class="cart-badge" aria-live="assertive">
  3 items
</div>

<!-- Search loading -->
<div aria-busy="true" role="status">
  Searching...
</div>
```

#### ARIA Roles

| Role | Use | Example |
|------|-----|---------|
| `alert` | Urgent message | "Error: Payment failed" |
| `status` | Status message (non-urgent) | "Saving..." |
| `progressbar` | Upload/download progress | File upload indicator |
| `tab` | Tab in tablist | Product tabs (Details, Reviews) |
| `tablist` | Container for tabs | Tab bar |
| `tabpanel` | Content for active tab | Product details pane |
| `dialog` | Modal dialog | Confirmation modal |
| `listbox` | List of options | Dropdown menu (unrolled) |
| `option` | Item in listbox | Dropdown menu item |
| `combobox` | Text input + listbox | Autocomplete search |

#### ARIA Attributes

```html
<!-- ARIA states -->
<button aria-pressed="false">Mute</button>
<input aria-invalid="true" />
<div aria-hidden="true">Decorative icon</div>

<!-- ARIA properties -->
<h2 id="modal-title">Confirm Delete</h2>
<div role="dialog" aria-labelledby="modal-title">...</div>

<input aria-describedby="hint-text" />
<div id="hint-text">Min. 8 characters</div>

<!-- ARIA labels -->
<button aria-label="Close menu">×</button>
<img src="logo.png" alt="Company Logo" />

<!-- Expanded state -->
<button aria-expanded="false" aria-controls="menu-id">Menu</button>
<nav id="menu-id" hidden>...</nav>
```

### Common Patterns

**Combobox with filtering:**
```html
<div role="combobox" aria-expanded="false" aria-owns="listbox-1">
  <input type="text" aria-autocomplete="list" />
</div>
<ul id="listbox-1" role="listbox" hidden>
  <li role="option" aria-selected="false">Option 1</li>
</ul>
```

**Pagination:**
```html
<nav aria-label="Pagination">
  <button aria-current="page">1</button>
  <button>2</button>
</nav>
```

**Breadcrumbs:**
```html
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/products">Products</a></li>
    <li aria-current="page">Cameras</li>
  </ol>
</nav>
```

---

## Images & Icons

### Alternative Text

```html
<!-- Informative image: describe content -->
<img src="product.jpg" alt="Red Retro Camera Pro with manual" />

<!-- Decorative image: empty alt -->
<img src="divider.png" alt="" role="presentation" />

<!-- Icon as button label -->
<button aria-label="Add to cart">🛒</button>

<!-- Icon with text label (text is sufficient) -->
<button>
  🛒 Add to Cart
  <!-- alt not needed; button text describes action -->
</button>

<!-- SVG icon -->
<svg aria-label="Close" role="img">
  <path d="..." />
</svg>

<!-- SVG with title -->
<svg role="img" aria-label="Close">
  <title>Close menu</title>
  <path d="..." />
</svg>
```

### Icon Fonts

Never use icon fonts alone without text. Icon fonts fail when fonts don't load.

```css
/* ✗ Wrong: Icon font only */
.icon-close::before {
  content: "\e123"; /* Invisible if font fails */
}

/* ✓ Better: Use SVG or unicode with fallback text */
<button aria-label="Close">
  <svg>...</svg>
</button>
```

---

## Motion & Animations

### Respect Prefers Reduced Motion

**All animations must stop when `prefers-reduced-motion: reduce`.**

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Alternative:** Define animation styles in a mixin, skip in reduced motion.

```css
/* Normal */
.fade-in {
  animation: fadeSlide 150ms var(--easing-easeOut);
}

/* Reduced motion: show without animation */
@media (prefers-reduced-motion: reduce) {
  .fade-in {
    animation: none;
    opacity: 1;
  }
}
```

### No Content Gated on Animation

Never hide content if animation doesn't play.

```css
/* ✗ Wrong: Content hidden until animation completes */
.dropdown {
  opacity: 0;
  animation: fadeIn 150ms;
  /* If animation is disabled: invisible forever */
}

/* ✓ Correct: Content visible regardless */
.dropdown {
  opacity: 0;
  animation: fadeIn 150ms;
}

@media (prefers-reduced-motion: reduce) {
  .dropdown {
    opacity: 1;
    animation: none;
  }
}
```

---

## Text & Readability

### Font Size

Minimum 16px for body text (prevents zoom-to-16px auto-zoom on iOS).

```css
body {
  font-size: 1rem; /* 16px */
  line-height: 1.5; /* 24px */
}
```

### Line Length

65–75ch (characters) for body text; max 80ch for prose.

```css
p {
  max-width: 75ch;
}
```

### Text Spacing

Allow users to override spacing in a11y preferences.

```css
/* WCAG 2.1 Success Criterion 1.4.12 */
p {
  line-height: 1.5;
  word-spacing: 0.16em;
  letter-spacing: 0.12em;
}

/* DO NOT use !important to override */
/* Let browser defaults + user preferences apply */
```

### Language Declaration

```html
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>...</title>
  </head>
  <body>
    <!-- Whole page in Spanish -->
  </body>
</html>

<!-- Change language for specific content -->
<p>Visit our <a lang="en" href="...">English site</a>.</p>
```

---

## Forms

### Required Fields

```html
<!-- Semantic: always use required attribute -->
<input type="email" required aria-required="true" />

<!-- Label indicates requirement -->
<label for="email">
  Email <span aria-label="required">*</span>
</label>

<!-- Abbreviation explained -->
<abbr title="Required">*</abbr>
```

### Error Recovery

1. **Announce errors immediately** (on blur or submit)
2. **Link errors to fields** (aria-describedby)
3. **Auto-focus first error** (on submit)
4. **Allow correction** (don't clear field)

```html
<form>
  <div id="error-summary" role="alert" hidden>
    <h2>Please fix these errors:</h2>
    <ul>
      <li><a href="#email-field">Email is invalid</a></li>
    </ul>
  </div>

  <div class="form-group">
    <label for="email-field">Email</label>
    <input 
      id="email-field"
      type="email"
      aria-invalid="true"
      aria-describedby="email-error"
    />
    <div id="email-error" role="alert">Please enter a valid email</div>
  </div>

  <button type="submit">Sign Up</button>
</form>

<script>
  form.addEventListener("submit", (e) => {
    const errors = validate(form);
    if (errors.length) {
      e.preventDefault();
      errorSummary.hidden = false;
      errorSummary.focus(); // Announce to screen reader
      errors[0].field.focus(); // Focus first error
    }
  });
</script>
```

---

## Testing Checklist

### Automated Tools
- [ ] **axe DevTools** (browser extension) — no critical/serious violations
- [ ] **WAVE** — no errors
- [ ] **Lighthouse (Chrome)** — ≥ 90 accessibility score
- [ ] **Sass a11y linter** — color contrast ≥ AA

### Manual Testing
- [ ] **Keyboard only** — Tab through entire page, no traps
- [ ] **Screen reader** (NVDA, JAWS, VoiceOver)
  - [ ] Page structure read correctly (headings, landmarks)
  - [ ] Form labels announced with inputs
  - [ ] Error messages announced (role="alert")
  - [ ] Live updates announced (aria-live)
- [ ] **Zoom** — 200% zoom, no layout breaks
- [ ] **High contrast mode** — text readable
- [ ] **Prefers reduced motion** — animations pause/skip
- [ ] **Color blind** — no color-only information
  - [ ] Deuteranopia (red-green, most common)
  - [ ] Protanopia (red-blind)
  - [ ] Tritanopia (blue-yellow)

### Device Testing
- [ ] **Touch** — 44px+ touch targets
- [ ] **Mobile screen reader** (TalkBack, VoiceOver)
- [ ] **Landscape/portrait** — responsive tested

---

## Browser & Assistive Technology Support

### Target Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | Latest 2 | AA required |
| Firefox | Latest 2 | AA required |
| Safari | Latest 2 | AA required |
| Edge | Latest 2 | AA required |

### Screen Reader Testing

| Tool | Platform | Priority |
|------|----------|----------|
| **NVDA** | Windows | High (free) |
| **JAWS** | Windows | High (standard) |
| **VoiceOver** | macOS, iOS | Medium |
| **TalkBack** | Android | Medium |

### Known Gaps to Document

If a pattern cannot meet AA, document the limitation and workaround:

```markdown
## Known Accessibility Issue

### Pattern: Inline editable table cell
- **Status:** Does not meet WCAG 2.1 AA
- **Reason:** Dynamic role changes during edit mode confuse screen readers
- **Workaround:** Users can edit via a modal form instead
- **Issue:** [Link to GitHub issue](...)
- **Target Fix:** Version X.Y
```

---

## References

- **WCAG 2.1 Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA Authoring Practices:** https://www.w3.org/WAI/ARIA/apg/
- **WebAIM:** https://webaim.org/
- **Deque Axe:** https://www.deque.com/axe/devtools/
- **Color Contrast Checker:** https://webaim.org/resources/contrastchecker/

---

## Implementation Checklist

- [ ] No color used as sole differentiator
- [ ] All text ≥ 4.5:1 contrast (body), ≥ 3:1 (large)
- [ ] Form labels associated with inputs (not placeholder)
- [ ] Error messages use `role="alert"`
- [ ] Focus indicators visible on all interactive elements
- [ ] No keyboard traps; Tab order logical
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Images have meaningful `alt` text (or empty for decorative)
- [ ] ARIA only supplements, not replaces HTML semantics
- [ ] Modal traps focus and announces title
- [ ] Tested with screen reader and keyboard only
