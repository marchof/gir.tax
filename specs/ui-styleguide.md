# UI Styleguide

Scope: the web app's custom elements (`app/components/*.js`) and the
statically generated rules page (`scripts/generateruleshtml.js` →
`dist/rules/index.html`). Both render plain HTML/CSS (no framework, no CSS
preprocessor), so this spec is the catalog of design tokens and component
patterns components should reuse.

The color, radius, font, and shadow tokens below are defined once in
`scripts/styleTokens.js` — that file is the source of truth for their
*values*; this document only records what each token means and where it's
used, so the two never need to be kept in sync by hand. The tokens are
injected as a `:root` block into both `index.html` (via `scripts/build.js`)
and the generated rules page (via `scripts/generateruleshtml.js`), so
`var(--color-ink)` etc. resolve identically on both pages. Custom-element
shadow roots inherit these variables automatically since custom-property
inheritance pierces shadow DOM boundaries — components reference
`var(--color-ink)` directly, with no fallback value, since the token is
always defined by the time any component renders.

## Color tokens

Values live in `scripts/styleTokens.js` (the single source of truth) — this
table only documents what each one is *for*, so the two never drift apart:

| Token | Use |
|---|---|
| `color-ink` | Primary text |
| `color-ink-soft` | Secondary/muted text, labels |
| `color-line` | Default borders |
| `color-line-strong` | Borders on frame/header chrome (AppTabs, rules-page frame) |
| `color-surface` | Card/panel background |
| `color-surface-muted` | Subtle gradient end, code block background |
| `color-accent` | Teal accent (rule badges) |
| `color-accent-soft` | Accent badge background |
| `color-success` | "Accepted" status |
| `color-danger` | "Rejected" status |
| `color-danger-soft-bg` | Issue/error code chip background |
| `color-danger-soft-border` | Issue/error code chip border |
| `color-error-chip` | Tab error-count chip background |

These are the tokens already used by `AppTabs.js`, `ValidationStatus.js`,
`buttonBaseStyle.js`, `FileDrop.js`, `XMLOutline.js`, `CorporateStructureGraph.js`,
and `generateruleshtml.js`. Use `var(--color-*)` verbatim in new components
rather than picking a nearby shade or a new hex value.

## Spacing & radii

There is no strict 4px/8px grid in the existing code, but new components
should round to one of the radius tokens in `scripts/styleTokens.js`:

| Radius | Use |
|---|---|
| `radius-sm` | Small chips/badges (issue-code, xml-tag) |
| `radius-md` | Buttons, summary-item boxes, tab buttons |
| `radius-lg` | Outer frame containers (AppTabs `.tabs`, rules-page `.frame`, rule-card, issue-card) |

Spacing: prefer `4px`, `8px`, `12px`, `14px`, `16px` (`1rem`) for padding and
gaps. `14px` is the standard horizontal gutter inside a frame's panel
(`AppTabs .panels`, rules-page `.panel`) — components rendered inside that
panel (e.g. `ValidationStatus`) should not add their own horizontal padding
on top of it, to keep left/right alignment consistent across pages.

## Shadows

| Token | Use |
|---|---|
| `shadow-card` | Cards (rule-card, issue-card) |
| `shadow-focus` | `:focus-visible` ring on buttons |

Values live in `scripts/styleTokens.js`. Frame containers (the outer
bordered box) use a border only, no shadow — the shadow is reserved for
cards *inside* a frame.

## Borders

| Token | Use |
|---|---|
| `border-card` | Card/box border (`1px solid var(--color-line)`) |
| `border-frame` | Frame/chrome border (`1px solid var(--color-line-strong)`) |

Values live in `scripts/styleTokens.js` (the single source of truth) — this
table only documents what each one is *for*. Use `border: var(--border-card)`
directly in new components rather than repeating the literal border
declaration.

## Typography

- UI font stack: `--font-ui`. This is the preferred stack for any new
  component or page content.
- Monospace stack (code, XPath expressions, error codes): `--font-mono`.
- Both are defined in `scripts/styleTokens.js` alongside the color/radius/
  shadow tokens and already wired into `index.html` and the rules page —
  use `font-family: var(--font-ui)` / `var(--font-mono)` in new components
  rather than repeating the literal stack.
- Base size/line-height: `1rem` / `1.5`.
- Uppercase labels (`summary-label`, `meta-label`): `0.78rem`, `text-transform:
  uppercase`, `letter-spacing: 0.03em`, color `color-ink-soft`.
- **Unit for `font-size`: use `rem`.** `rem` is always relative to the root
  `<html>` font-size, so it can't compound unexpectedly no matter how deep an
  element is nested — and it still respects a user's browser-level "larger
  text" accessibility preference, unlike `px`.
  - **Never use `em` for `font-size` on a selector whose elements can
    recursively contain another element matching the same selector.**
    `XMLOutline.js`'s `div.xml-code` hit exactly this bug: each nested XML
    element re-wraps its children in another `.xml-code`, so an `em`-based
    `font-size` there compounds multiplicatively at every nesting depth,
    shrinking (or growing) text the deeper the XML tree goes. It's fixed
    with `rem` now — don't reintroduce `em` there or on anything with
    similar recursive structure.
  - `em` is still fine for a property that's deliberately meant to scale
    with its *own* element's font-size (e.g. an icon-like glyph sized
    relative to the adjacent text), as long as that element isn't itself
    recursively nested.
  - `px` is acceptable for fixed chrome that isn't meant to scale with text
    preferences (tab buttons, button labels, graph node labels) — this is
    already the existing convention in `AppTabs.js`, `buttonBaseStyle.js`,
    and `CorporateStructureGraph.js`. `rem` would be the stricter,
    more-accessible choice even here; treat existing `px` chrome as
    acceptable, not as something to actively migrate.
- Headings inside a page must form a single, unbroken hierarchy (`h1` → `h2`
  → `h3`, no skipped levels) — see the rules page's per-rule heading
  (`h2.rule-title`) as the reference example.

## Component patterns

### Frame (chrome) pattern

Used by `AppTabs.js` (`.tabs`) and the rules page (`.frame`): a rounded
(`radius-lg`), bordered (`color-line-strong`) container with `overflow:
hidden`, containing:
- a header bar (`linear-gradient(180deg, #f7f9fb 0%, #eef2f6 100%)`
  background, bottom border, flex row, `8px` padding) holding
  navigation/tabs and a right-aligned title, and
- a panel (`color-surface`, `14px` padding) holding the actual content.

Any new top-level page or full-height component should reuse this pattern
rather than inventing a new outer chrome.

### Card pattern

Used by `summary-item`, `rule-card`, and `issue-card`: a bordered
(`color-line`), rounded box for grouping a small set of related fields.
Two variants exist:
- **Summary box** (`radius-md`, light gradient background, label-over-value):
  for compact key/value facts (`summary-label` + `summary-value`).
- **Content card** (`radius-lg`, `color-surface`, `shadow-card`): for larger
  repeated entries (one rule, one validation issue).

### Button pattern

All buttons should use the shared `BUTTON_BASE_CSS` from
`app/components/buttonBaseStyle.js` (`.button-base`), imported via template
literal interpolation — don't redefine button styles locally. This is the
one place in the codebase where a style is already centralized in code, not
just documented; treat it as the model to follow when promoting other tokens
out of this document later.

### Badge / chip pattern

Small pill or rounded-rect label for a short status word or number
(`rule-badge`, `tab-chip`, `issue-code`). Always paired with a soft
background + matching border/text color from the color tokens above (accent,
danger, or error-chip), never a bespoke color.

### Hint / callout pattern

A pale, bordered banner (see `.rules-hint` in `ValidationStatus.js`) for a
single contextual notice with an optional link. Light blue background
gradient (`#eaf3ff` → `#f6faff`), border `#bcd6f5`.

### Interactive surface pattern

For non-button elements with hover/active interaction states (see
`.drop-zone` in `FileDrop.js`), use this state progression rather than
generic grays:
- **Idle**: border `color-line-strong`, text `color-ink-soft`.
- **Hover**: border and text shift toward `color-accent` / `color-ink` to
  signal interactivity without implying a completed action.
- **Active/engaged** (e.g. a drag actually over the drop zone): background
  `color-accent-soft`, border `color-accent`, text `color-ink`. This is the
  same accent pairing used by the badge pattern, reused here to mean "this
  surface is currently receiving input" rather than "this is a category
  label" — the token pairing is shared, the meaning is contextual.

### Postit / floating tooltip pattern

Used by the validation-error tooltip in `XMLOutline.js` (`.validation-tooltip`).
This is a deliberate exception to the chrome color tokens above, not an
inconsistency to fix: a floating, attention-grabbing overlay that reads as a
physical sticky note rather than as part of the app's chrome.

| Property | Value |
|---|---|
| Background | `#fff3cd` (warning yellow, not a chrome token) |
| Border | `1px solid #c1b899` |
| Shadow | `0 4px 12px rgba(0, 0, 0, 0.25)` — flat black, heavier than `shadow-card`, for a "lifted paper" feel |
| Title / code color | `#c92a2a` |
| Divider | `1px solid rgba(255, 107, 107, 0.2)` |
| Body text | `#5c5c5c` |
| Radius | `6px` (`radius-sm`) |

Use this exact palette only for transient, hover-triggered overlays that
need to visually pop out from the surrounding content — it intentionally
breaks from the rest of the chrome system for that reason. Don't reuse it
for persistent UI (banners, cards, frames); use the Hint/callout or Card
patterns for those instead.

## Web component conventions

- Each component is a plain `HTMLElement` subclass using
  `attachShadow({ mode: "open" })`. No framework, no build-time templating.
- `render()` sets `shadowRoot.innerHTML` to a template literal containing one
  `<style>` block followed by markup. Re-render on state changes by calling
  `render()` again from property setters.
- `:host` must at minimum declare `display: block`.
- Any text derived from user input or parsed XML must go through an
  `_escapeHtml` helper before being interpolated into `innerHTML` (see the
  existing helper in `ValidationStatus.js` / `generateruleshtml.js`).
- Shared CSS used by more than one component belongs in its own module
  (following `buttonBaseStyle.js`), not copy-pasted.

## Known inconsistencies

None currently. Don't copy patterns from outside this spec into new code; if
a component is found that doesn't match it, add an actionable item here
(and remove it once fixed).

## How to use this spec

`scripts/styleTokens.js` defines the `--font-*`/`--color-*`/`--radius-*`/
`--shadow-*` custom properties; this document is the catalog of what they
mean, not a second copy of their values. When writing or reviewing a new
component:

1. Use `var(--color-ink)` etc. directly, with no literal fallback — every
   page that hosts a component already injects the `:root` token block, so
   a fallback would just reintroduce the duplication this spec is meant to
   avoid.
2. If a value you need isn't a token yet but matches an existing one, add
   `var(--token-name)`; if it's genuinely new, add it to
   `scripts/styleTokens.js` first and document it in the relevant table
   above.
3. If a new pattern doesn't fit "Frame", "Card", "Button", "Badge", or
   "Hint", consider whether it should — and if it doesn't, add a new pattern
   section here so the next component can reuse it too.
4. Shared *class* fragments (not just variables), like `buttonBaseStyle.js`,
   should stay as their own exported module once a pattern repeats across a
   third component — update this document to point at that module.
