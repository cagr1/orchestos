# Interactive Components Specification

Production-ready component rules for Apple España e-commerce storefront.

---

## Button

Primary interaction element for all actions (submit, navigate, toggle).

### Sizes

| Size | Height | Padding | Font | Use |
|------|--------|---------|------|-----|
| **xs** | 2rem | 0.75rem 1rem | sm (0.875rem) | Tertiary, compact |
| **sm** | 2.5rem | 1rem 1.25rem | base (1rem) | Secondary actions |
| **md** | 2.75rem | 1rem 1.5rem | base (1rem) | Primary buttons |
| **lg** | 3.25rem | 1.25rem 2rem | lg (1.125rem) | Hero CTAs |

### Variants

#### Primary
- **Background:** `accent-600` → accent-500 (hover) → accent-700 (active)
- **Text:** white (neutral-50) on light mode, always accessible
- **Border:** none
- **Shadow:** none at rest, xs on hover
- **Min width:** 48px (touch target)

```css
button.primary {
  background-color: var(--color-accent-600);
  color: white;
  padding: 1rem 1.5rem;
  height: 2.75rem;
  border-radius: var(--radius-base);
  font-weight: 600;
  transition: background-color 150ms var(--easing-easeOut),
              box-shadow 150ms var(--easing-easeOut);
}

button.primary:hover:not(:disabled) {
  background-color: var(--color-accent-500);
  box-shadow: var(--shadow-xs);
}

button.primary:active:not(:disabled) {
  background-color: var(--color-accent-700);
}

button.primary:focus {
  outline: 2px solid var(--color-accent-700);
  outline-offset: 2px;
}

button.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

#### Secondary
- **Background:** neutral-100 (neutral-200 hover)
- **Text:** neutral-900
- **Border:** 1px solid neutral-300
- **Shadow:** none

#### Tertiary (Ghost)
- **Background:** transparent
- **Text:** accent-600
- **Border:** 1px solid accent-600
- **Shadow:** none

#### Danger
- **Background:** error-600 (error-500 hover, error-700 active)
- **Text:** white
- **Use:** Destructive actions (delete, clear)

### States

- **Hover:** Lighten 1 ramp step (600 → 500), add xs shadow
- **Active:** Darken 1 ramp step (600 → 700), remove shadow
- **Focus:** 2px solid outline, 2px offset from edge
- **Disabled:** 50% opacity, cursor not-allowed
- **Loading:** Icon spinner, width locked, text hidden but in DOM

---

## Input (Text, Email, Password, Search)

### Structure

```html
<div class="input-group">
  <label for="input-1">Label</label>
  <input id="input-1" type="text" placeholder="Placeholder text" />
  <div class="input-error" role="alert">Error message</div>
</div>
```

### Sizing

| Size | Height | Padding | Font |
|------|--------|---------|------|
| **sm** | 2.25rem | 0.75rem 1rem | sm |
| **md** | 2.75rem | 1rem 1rem | base |
| **lg** | 3.25rem | 1rem 1.5rem | base |

Default: **md** (2.75rem).

### Base Styles

```css
input[type="text"],
input[type="email"],
input[type="password"],
input[type="search"] {
  width: 100%;
  height: var(--input-height, 2.75rem);
  padding: 1rem;
  font-family: var(--font-body);
  font-size: 1rem;
  line-height: 1.5;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-base);
  background-color: var(--color-surface);
  color: var(--color-text);
  transition: border-color 150ms var(--easing-easeOut),
              box-shadow 150ms var(--easing-easeOut),
              background-color 150ms var(--easing-easeOut);
}

input:hover:not(:disabled, :focus) {
  border-color: var(--color-border);
  background-color: var(--color-surfaceVariant);
}

input:focus {
  outline: 2px solid var(--color-accent);
  outline-offset: -1px;
  border-color: var(--color-accent);
  box-shadow: inset 0 0 0 1px var(--color-accent);
}

input:disabled {
  background-color: var(--color-neutral-100);
  border-color: var(--color-border-subtle);
  color: var(--color-text-tertiary);
  cursor: not-allowed;
}

input::placeholder {
  color: var(--color-text-tertiary);
}

input[type="search"]::-webkit-search-cancel-button {
  cursor: pointer;
}
```

### Validation

#### Error State
- **Border:** 1px solid error-600
- **Icon:** ✕ icon in right slot
- **Message:** Below input, error-600 text, font-sm
- **Announce:** `role="alert"` on error message div

#### Success State
- **Border:** 1px solid success-600
- **Icon:** ✓ icon in right slot (no text change)

#### Loading State
- **Border:** accent-300
- **Icon:** Spinner in right slot
- **Disabled:** true (prevent submission during load)

---

## Select / Combobox

### Rule: Never more than ~20 options without search

If options > 20: **use combobox with filter**, not native `<select>`.

### Native Select (≤ 20 options)

```html
<div class="select-group">
  <label for="select-1">Choose an option</label>
  <select id="select-1">
    <option value="">Select...</option>
    <option value="a">Option A</option>
  </select>
</div>
```

**Styling:** Same height/padding as text input (2.75rem). Icon indicator (chevron-down) in right slot, rotates on open (20ms ease-out).

### Combobox (> 20 options)

```html
<div class="combobox-group" role="combobox" aria-expanded="false">
  <label for="combo-1">Search products...</label>
  <input
    id="combo-1"
    type="text"
    role="searchbox"
    autocomplete="off"
    placeholder="Start typing..."
  />
  <ul role="listbox" class="options-list">
    <li role="option" aria-selected="false">Product A</li>
    <li role="option" aria-selected="false">Product B</li>
  </ul>
</div>
```

**Behavior:**
- Filters options as user types (client-side or server debounced)
- Dropdown opens on focus or first keystroke
- Arrow keys navigate; Enter selects
- Escape closes dropdown
- Selected option highlighted with accent-100 background
- Lazy-load options if > 100 items (virtualize list)

**Focus management:**
- Focus remains on input
- `aria-activedescendant` points to highlighted option
- List items never receive focus (only arrow keys navigate)

---

## Checkbox & Radio Group

### Checkbox

```html
<div class="checkbox-group">
  <input id="check-1" type="checkbox" />
  <label for="check-1">I agree to terms</label>
</div>
```

**Sizing:** 20px × 20px (use `accent` scale or `accent-base` class).

**States:**
- **Unchecked:** Border accent-600, bg transparent
- **Checked:** Bg accent-600, white checkmark (✓)
- **Indeterminate:** Accent-600 bg, white dash (−)
- **Hover (unchecked):** Bg neutral-100
- **Focus:** 2px outline, 2px offset
- **Disabled:** 50% opacity, cursor not-allowed

### Radio Group

```html
<fieldset>
  <legend>Choose one</legend>
  <div class="radio-group">
    <input id="radio-1" type="radio" name="group" value="a" />
    <label for="radio-1">Option A</label>
  </div>
  <div class="radio-group">
    <input id="radio-2" type="radio" name="group" value="b" />
    <label for="radio-2">Option B</label>
  </div>
</fieldset>
```

**Sizing:** 20px × 20px circle.

**States:**
- **Unselected:** Border accent-600, bg transparent
- **Selected:** Outer ring accent-600 (2px), inner dot accent-600 (8px)
- **Focus:** 2px outline on ring
- **Disabled:** 50% opacity

---

## Toggle Switch

```html
<div class="toggle-group">
  <label for="toggle-1">Notifications</label>
  <input id="toggle-1" type="checkbox" class="toggle" />
</div>
```

**Sizing:** 44px × 24px (width × height).

```css
input.toggle {
  appearance: none;
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background-color: var(--color-neutral-400);
  border: none;
  cursor: pointer;
  transition: background-color 150ms var(--easing-easeOut);
  position: relative;
}

input.toggle::after {
  content: "";
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 10px;
  background-color: white;
  top: 2px;
  left: 2px;
  transition: left 150ms var(--easing-easeOut);
}

input.toggle:checked {
  background-color: var(--color-accent-600);
}

input.toggle:checked::after {
  left: 22px;
}

input.toggle:focus {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

---

## Dropdown Menu

```html
<div class="dropdown">
  <button class="dropdown-trigger">Menu</button>
  <ul class="dropdown-menu" role="menu">
    <li role="menuitem"><a href="#">Item 1</a></li>
    <li role="menuitem"><a href="#">Item 2</a></li>
    <li role="separator"></li>
    <li role="menuitem"><a href="#">Delete</a></li>
  </ul>
</div>
```

**Behavior:**
- Trigger opens/closes on click
- Escape closes menu
- Arrow keys navigate (↑/↓)
- Enter/Space activates item
- First item autofocus on open
- Menu closes on item select
- Focus returns to trigger on close

**Positioning:** Use `<Popover>` or `position: absolute` with `z-index: 100` (dropdown). Min-width 160px, max-width 280px.

**Styling:**
- Background: surface-50 (neutral-100)
- Border: 1px neutral-300
- Shadow: md
- Radius: md
- Item padding: 0.75rem 1rem
- Item hover: neutral-200 bg
- Item active: accent-100 bg

---

## Popover / Tooltip

### Popover (Content-rich, persistent)

Larger container (≥ 160px width) that remains open until dismissed.

```html
<div class="popover" role="dialog">
  <button class="popover-close" aria-label="Close">&times;</button>
  <h3>Title</h3>
  <p>Content here.</p>
</div>
```

**Styling:**
- Background: surface
- Border: 1px neutral-300
- Shadow: lg
- Radius: lg
- Padding: 1.5rem
- Min-width: 240px
- Max-width: 480px
- z-index: 500

### Tooltip (Text-only, ephemeral)

Label that appears on hover/focus, disappears after 2s or on blur.

```html
<button
  aria-label="Save"
  data-tooltip="Save changes (Cmd+S)"
>
  💾
</button>
```

**Styling:**
- Background: neutral-900 (dark) or neutral-800 in dark mode
- Text: white
- Font: xs (0.75rem)
- Padding: 0.5rem 0.75rem
- Radius: sm
- Shadow: md
- z-index: 700
- Arrow pointer (CSS clip-path or SVG)

---

## Modal

```html
<div class="modal-backdrop" role="presentation">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <button class="modal-close" aria-label="Close">&times;</button>
    <h2 id="modal-title">Confirm Delete</h2>
    <p>This action cannot be undone.</p>
    <div class="modal-actions">
      <button class="secondary">Cancel</button>
      <button class="primary danger">Delete</button>
    </div>
  </div>
</div>
```

**Styling:**
- Backdrop: rgba(0, 0, 0, 0.5), z-index 400
- Modal: bg surface, shadow xl, radius lg
- Padding: 2rem
- Max-width: 480px (default)
- Min-width: 280px (mobile)

**Behavior:**
- Closes on backdrop click, Escape key, or close button
- Focus trapped inside modal (Tab cycles)
- Scroll locked on document.body
- Enters with fadeSlide animation (150ms)
- Exits with dismissSlide animation (150ms)

---

## Pagination

```html
<nav aria-label="Pagination" class="pagination">
  <button aria-label="Previous page" disabled>&laquo;</button>
  <button class="active" aria-current="page">1</button>
  <button>2</button>
  <button>3</button>
  <span class="ellipsis">…</span>
  <button>12</button>
  <button aria-label="Next page">&raquo;</button>
</nav>
```

**Styling:**
- Button: 40px × 40px, radius base
- Active page: accent-600 bg, white text
- Inactive: neutral-200 bg, neutral-900 text
- Hover: neutral-300 bg
- Disabled: 50% opacity

**Rules:**
- Show max 7 pages
- Ellipsis for gaps > 1
- Always show first/last page
- Keyboard accessible (Tab, Arrow keys)

---

## Product Card (E-commerce)

```html
<article class="product-card">
  <figure class="product-image">
    <img src="product.jpg" alt="Product name" />
    <figcaption class="product-overlay">
      <button class="btn-wishlist" aria-label="Add to wishlist">♡</button>
    </figcaption>
  </figure>
  <div class="product-info">
    <span class="badge">New</span>
    <h3>Product Name</h3>
    <p class="price">€89.00</p>
    <p class="rating">★★★★★ (234)</p>
    <button class="btn-add-cart">Add to Cart</button>
  </div>
</article>
```

**Sizing:**
- Grid: `repeat(auto-fit, minmax(280px, 1fr))`
- Card: 280px min width
- Image: 1:1 aspect ratio, object-fit cover
- Padding: 1rem (mobile), 1.5rem (desktop)

**States:**
- **Hover:** Image scales 1.05 (200ms ease-out), overlay fades in
- **Wishlist:** Heart toggles empty → full, accent color
- **Loading:** Skeleton (neutral-300 pulse animation)

---

## Form Validation Summary

Display errors grouped at form top or field-level.

```html
<div class="validation-summary" role="alert">
  <h3>Please fix these errors:</h3>
  <ul>
    <li><a href="#field-1">Email is invalid</a></li>
    <li><a href="#field-2">Password too short</a></li>
  </ul>
</div>
```

**Styling:**
- Background: error-100 (error-50 in dark)
- Border: 1px error-300
- Text: error-900
- Icon: ✕ error-600
- Padding: 1rem
- Radius: md

**Behavior:**
- Appears on submit with invalid fields
- Each error links to field with focus ring
- Announced with `role="alert"` for screen readers

---

## Implementation Checklist

- [ ] All button variants tested at 4.5:1 contrast
- [ ] Inputs have associated labels (not placeholder as label)
- [ ] Select dropdowns virtualize > 20 items
- [ ] Combobox filters and keyboard-navigates
- [ ] Focus indicators visible on all interactive elements
- [ ] Disabled states are clearly distinct
- [ ] Modals trap focus and lock scroll
- [ ] Error messages use role="alert"
- [ ] Touch targets ≥ 44px × 44px on mobile
- [ ] Animations respect prefers-reduced-motion
- [ ] Dark mode tested for all component variants
