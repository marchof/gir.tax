# UI Styleguide

Scope: the web app's custom elements (`app/components/*.js`) and the
statically generated rules page (`scripts/generateruleshtml.js` →
`dist/rules/index.html`). Both render plain HTML/CSS (no framework, no CSS
preprocessor), so this spec is the single source of truth for the values
components should reuse — there is currently no shared CSS-variables module
enforcing it in code (see "How to use this spec" below).

## Color tokens

| Token | Value | Use |
|---|---|---|
| `color-ink` | `#1c2b3f` | Primary text |
| `color-ink-soft` | `#4f6075` | Secondary/muted text, labels |
| `color-line` | `#d9e1ea` | Default borders |
| `color-line-strong` | `#d9dee3` | Borders on frame/header chrome (AppTabs, rules-page frame) |
| `color-surface` | `#ffffff` | Card/panel background |
| `color-surface-muted` | `#f7fafd` / `#f6f9fc` | Subtle gradient end, code block background |
| `color-accent` | `#0f7c6b` | Teal accent (rule badges) |
| `color-accent-soft` | `#dff4ef` | Accent badge background |
| `color-success` | `#0c7a38` | "Accepted" status |
| `color-danger` | `#ad2b10` | "Rejected" status |
| `color-danger-soft-bg` | `#ffaaaa` | Issue/error code chip background |
| `color-danger-soft-border` | `#cc6666` | Issue/error code chip border |
| `color-error-chip` | `#cf3f2e` | Tab error-count chip background |

These are the values already used by `AppTabs.js`, `ValidationStatus.js`,
`VersionInfo.js`, `buttonBaseStyle.js`, and `generateruleshtml.js`. Use them
verbatim in new components rather than picking a nearby shade.

## Spacing & radii

There is no strict 4px/8px grid in the existing code, but new components
should round to one of these:

| Radius | Value | Use |
|---|---|---|
| `radius-sm` | `6px` | Small chips/badges (issue-code, xml-tag) |
| `radius-md` | `9–10px` | Buttons, summary-item boxes, tab buttons |
| `radius-lg` | `12px` | Outer frame containers (AppTabs `.tabs`, rules-page `.frame`) |
| `radius-xl` | `14px` | Content cards (rule-card, issue-card) |

Spacing: prefer `4px`, `8px`, `12px`, `14px`, `16px` (`1rem`) for padding and
gaps. `14px` is the standard horizontal gutter inside a frame's panel
(`AppTabs .panels`, rules-page `.panel`) — components rendered inside that
panel (e.g. `ValidationStatus`) should not add their own horizontal padding
on top of it, to keep left/right alignment consistent across pages.

## Shadows

| Token | Value | Use |
|---|---|---|
| `shadow-card` | `0 5px 18px rgba(17, 37, 62, 0.05)` | Cards (rule-card, issue-card) |
| `shadow-focus` | `0 0 0 3px rgba(125, 176, 226, 0.35)` | `:focus-visible` ring on buttons |

Frame containers (the outer bordered box) use a border only, no shadow — the
shadow is reserved for cards *inside* a frame.

## Typography

- UI font stack: `"Avenir Next", "Segoe UI", sans-serif`. This is the
  preferred stack for any new component or page content.
- Monospace stack (code, XPath expressions, error codes):
  `ui-monospace, SFMono-Regular, Menlo, monospace`.
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
- a panel (white background, `14px` padding) holding the actual content.

Any new top-level page or full-height component should reuse this pattern
rather than inventing a new outer chrome.

### Card pattern

Used by `summary-item`, `rule-card`, and `issue-card`: a bordered
(`color-line`), rounded box for grouping a small set of related fields.
Two variants exist:
- **Summary box** (`radius-md`, light gradient background, label-over-value):
  for compact key/value facts (`summary-label` + `summary-value`).
- **Content card** (`radius-xl`, white background, `shadow-card`): for larger
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

There is no shared CSS-variables file yet — every component currently
hardcodes these hex values independently, so this document is the
enforcement mechanism for now. When writing or reviewing a new component:

1. Reuse the literal values from the tables above instead of approximating.
2. If a new pattern doesn't fit "Frame", "Card", "Button", "Badge", or
   "Hint", consider whether it should — and if it doesn't, add a new pattern
   section here so the next component can reuse it too.
3. If you find yourself repeating the same set of values across a third
   component, that's the signal to extract them into a shared module (e.g. a
   `tokens.js` exporting a CSS string of `:root` custom properties, following
   the precedent of `buttonBaseStyle.js`) — update this document to point at
   that module once it exists, rather than leaving two sources of truth.
