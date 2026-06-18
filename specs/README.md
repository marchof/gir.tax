# Specs

This directory holds the project's living specifications. A spec is a single
markdown file that describes how a concern of the system *should* work —
independent of any one PR — so that humans and AI assistants can build new
code consistently without re-deriving conventions from scratch each time.

## Index

- [ui-styleguide.md](ui-styleguide.md) — design tokens and component patterns
  for the web app's custom elements and the generated rules page.

More specs will be added over time (e.g. integration test principles).

## Conventions for specs

- One file per concern, named `kebab-case.md`.
- A spec documents the *current* intended state, not a changelog. When the
  intended state changes, edit the spec in place rather than appending notes.
- Where the codebase doesn't yet match the spec, say so explicitly under a
  "Known inconsistencies" section instead of silently describing aspirational
  behavior as if it were already true.
- Specs describe values and patterns; they don't replace reading the code.
  When a spec and the code disagree, that's a bug in one of the two — fix the
  one that's wrong rather than trusting the spec blindly.
