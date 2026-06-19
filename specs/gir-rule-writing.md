# GIR Rule Writing and Testing

This spec describes how validation rules for the GIR (GloBE Information
Return) XML are defined, implemented, and tested in
[gir-rules/rules.yaml](../gir-rules/rules.yaml). It complements
[gir-rules/README.md](../gir-rules/README.md), which states the project's
goals; this document focuses on the concrete authoring and testing
conventions.

## Goals

* Keep rule definitions comprehensible and as close as possible to the
  original OECD specification wording.
* Provide maintainable, automated test suites per rule.
* Enforce consistency with the GIR XML schema (`schemas/gir/globexml_v1.0.xsd`).
* Use portable technologies (YAML + XPath) so executors can later be
  generated for other runtimes (JavaScript, Java, C#, Go, etc.).

## Rule structure

All rules live in a single list under `rules:` in `rules.yaml`, ordered by
`number` (matching the OECD rule numbering, e.g. `60001`, `70001`). Each rule
is a YAML mapping with the following fields:

| Field | Required | Purpose |
|---|---|---|
| `number` | yes | The OECD rule number, used as the stable identifier everywhere (test folders, UI, etc.). |
| `targets` | yes | One or more absolute XPath expressions selecting the element(s) the rule applies to. |
| `test` | no | An XPath expression, evaluated relative to each target element, that must return a truthy result for the rule to pass. **Only rules with a `test` are automatically enforced.** |
| `element` | no | The schema element name the rule is conceptually about (documentation only, doesn't affect execution). Removed once `test` is implemented — see below. |
| `rule` | yes | The rule text, copied verbatim/paraphrased as closely as possible from the OECD specification. Never edited to match implementation details. |
| `description` | yes | The explanatory/error message text shown to a filer when the rule fails, again copied as-is from the OECD wording. |
| `references` | no | Dotted, schema-relative paths (not XPath) to other elements the rule's logic depends on, extracted from the spec before a `test` existed. Removed once `test` is implemented — see below. |
| `implementation_notes` | no | Notes about the *implementation only* — never a restatement of the rule. See [implementation_notes](#implementation_notes) for what does and does not belong here. |
| `target_does_not_exist_in_test_files` | no | List of test file names (see below) where none of the `targets` are expected to match. Used to suppress the "no elements matched" assertion for negative tests that test absence rather than a target's content. |

Namespaces used in XPath expressions are declared once at the top of the
file under `xmlnamespaces:` (`globe`, `iso`, `stf`) and reused by every rule
and by the test runner.

### Provenance of `targets`, `references`, `element`, `rule`, `description`

These five fields were originally extracted verbatim from the OECD
specification document, one rule at a time, before any `test` logic was
written. `rule` and `description` are left untouched as the OECD's own
wording — they are never edited to match implementation details.

`targets`, however, has been adapted twice on the way from the spec to an
executable rule:

* The plain element paths from the spec were prefixed with the exact
  namespace alias for every step (`globe:`, `stf:`, `iso:`), since XPath
  evaluation requires that to resolve elements correctly — the spec itself
  doesn't carry namespace information.
* Where the spec's literal path didn't give an XPath a usable evaluation
  context (e.g. a condition spans elements that aren't in a strict
  ancestor/descendant relationship to the originally cited path), the path
  was shortened to a common ancestor so the `test` expression has a single,
  well-defined context node to evaluate relative axes from (see rule `70027`
  for an example, documented via `implementation_notes`).

`references` and `element` are transitional scaffolding: they record, in
human-readable dotted/plain form, what the spec said before that knowledge
was encoded as XPath. Once a rule has a working `test` expression, that
knowledge lives in the XPath itself, and `references`/`element` add no
further value — they should be removed from the rule entry as part of
implementing its `test` (not before, and not left behind "just in case").

### Rules without a `test`

Many rules only have `rule`/`description`/`references` and no `test` — these
describe logic that is not yet (or cannot be) expressed as a pure XPath
boolean expression (e.g. cross-record arithmetic, cross-message checks,
matching against historical data). Such rules are skipped by the automated
test that checks rule logic (`test_rules_on_complete_docs_and_examples` /
`test_rules_on_dedicated_test_files` report them as skipped), but they still
contribute to `test_target_path_does_exist`. See
[gir-rules/TODO-RULES.md](../gir-rules/TODO-RULES.md) for the backlog of
rules that are in scope to formalize, organized by category (Conditions,
Calculations, Dates, Unique Values), and an explicit "Out of Scope" section
for rules that require cross-message or heavy cross-record state and are not
planned to be implemented this way.

## Writing a `test` expression

* `targets` selects the node(s) the rule is checked against; `test` is
  evaluated with that node as context (`.`), so write the condition from the
  perspective of being "at" the target element.
* Express the rule as an implication: `not(<condition>) or <consequence>`.
  This is the dominant pattern in the file (e.g. rule `60012`, `60013`,
  `60015`, `60016`, `60017`, `70009`, `70025`, `70026`, `70042`). It reads as
  "if the condition doesn't hold, the rule is vacuously satisfied; otherwise
  the consequence must hold."
* Keep the `test` as close as possible to one target/one condition. If the
  OECD wording genuinely requires correlating multiple elements that don't
  share a clean common target, pick the common ancestor as the single
  target and say so in `implementation_notes` (see rule `70027`) rather than
  silently restructuring the rule without explanation.
* Use relative axes (`../`, `ancestor::`, `parent::`) to reach sibling or
  ancestor data needed for the condition, and `*` wildcards for "any
  election type" patterns (e.g. rule `70054`'s
  `globe:Election/*/globe:RevocationYear`).
* Numeric comparisons should use `number(.)` explicitly rather than relying
  on implicit string-to-number coercion (see rules `70026`, `70028`).
* When a rule is currently believed to be true on all reference/example
  documents but isn't yet wired up as enforced logic, leave `test` absent
  rather than writing a placeholder — absence is the signal that the rule is
  not yet automatically enforced.

## `implementation_notes`

`implementation_notes` documents the *implementation*, not the rule. The rule
and its intent already live in `rule`/`description`; do not paraphrase or
restate them here. Most rules need no `implementation_notes` at all — a
straightforward `test` that maps directly onto the spec wording should have
none. Add the field only when something about the encoding isn't obvious from
reading the `test`, namely:

* **Targets changed for technical reasons** — when `targets` had to be moved to
  a common ancestor, narrowed, or otherwise diverge from the path the spec
  cites, so the `test` has a usable context node (see rule `70027`; or a
  spec-cited reference path that was dropped from `targets` because it is a
  reference, not a thing the rule is checked against).
* **A non-obvious encoding** — when the XPath uses a trick that isn't
  self-evident, e.g. normalising `YYYY-MM-DD` dates to integers because
  XPath 1.0 has no date comparison, or a `translate()`-based character check.
  Note the technique, not the rule it enforces.
* **Assumptions about an unclear rule** — when the spec wording is ambiguous and
  the `test` commits to one reading (e.g. interpreting a date field as a
  year-only comparison), record the assumption that was made.

If a note would just re-describe what the rule requires, leave it out.

## Test documents

Three tiers of XML test fixtures back the rules, all under
[gir-rules/testdocs/](../gir-rules/testdocs/) plus the shared `../examples/`
directory:

1. **Positive examples** — `../examples/globe-positive-*.xml`. Full,
   realistic GIR filings. Every *enforced* rule (`test` present) must pass
   against every target match found in these documents.
2. **Complete reference documents** — `testdocs/complete-*.xml`. Full
   documents used to (a) validate against the XSD schema
   (`schemas/gir/globexml_v1.0.xsd`) so the fixtures themselves stay
   schema-valid, and (b) prove that every rule's `targets` XPath actually
   matches at least one node somewhere in the corpus (catches typos/renames
   in target paths even for rules without a `test`).
3. **Rule-specific fragments** — `testdocs/<number>/ok-<nn>.xml` and
   `testdocs/<number>/nok-<nn>.xml`, one folder per rule number that has a
   `test`. These are the primary correctness tests for the rule's logic.

### Conventions for rule-specific fragment files

* File naming: `ok-NN.xml` for a positive case (rule must pass) and
  `nok-NN.xml` for a negative case (rule must fail), numbered from `01`.
  Provide enough of both to cover the meaningfully distinct branches of the
  rule's logic (e.g. rule `60012` has two `ok` and two `nok` cases covering
  `OECD0`/`OECD1`/`OECD2`/etc.).
* Each fragment is a minimal but schema-shaped document: start from the
  `<globe:GLOBE_OECD>` root and only include the ancestor/sibling elements
  actually needed to exercise the rule — don't pad fragments with unrelated
  content.
* Keep the root element itself minimal too: declare only the namespace
  prefixes (`globe`, `stf`, ...) that are actually used somewhere in that
  specific fragment — don't carry over a fixed boilerplate header. In
  particular, omit `xmlns:xsi` / `xsi:schemaLocation` (a schema reference
  has no bearing on what a fragment is testing) and the `version` attribute
  (optional in the schema, irrelevant to rule logic) unless a rule's
  `test`/`targets` actually concerns one of them.
* Despite being minimal, fragments must still validate as a structurally
  valid *subset* of the schema: only known element names/paths are allowed
  (enforced by `test_fragment_reference_doc_should_only_contain_known_paths`,
  which checks every path in every fragment exists somewhere in the
  complete/example corpus — not full XSD validation, just "no typos or
  invented elements").
* Each fragment must match at least one of the rule's `targets` XPaths, so
  the test actually exercises the rule rather than vacuously passing. If a
  particular file is intentionally testing an *absence* scenario where no
  target node exists, list that filename under the rule's
  `target_does_not_exist_in_test_files` instead of silently relying on the
  "no elements matched" check to fail the test.

## Test execution

[gir-rules/test.py](../gir-rules/test.py) is the single source of truth for
how rules are executed; it is a `unittest` suite run via
`parameterized.expand` so every rule/target/file combination shows up as its
own test case. Three test classes:

* `TestReferenceDocuments` — schema-validates the `complete-*.xml` and
  example docs, and checks every fragment file only contains paths known
  from those references.
* `TestRules.test_target_path_does_exist` — for every rule, asserts at least
  one `complete-*.xml` document has a node matching one of its `targets`.
* `TestRules.test_rules_on_complete_docs_and_examples` — for rules with a
  `test`, evaluates it against every matching node in the complete +
  example documents and asserts it passes (these are all meant to be valid
  filings).
* `TestRules.test_rules_on_dedicated_test_files` — for rules with both
  `test` and `targets`, runs every `testdocs/<number>/*.xml` file: `ok-*`
  files must pass, `nok-*` files must fail, and (unless the file is listed
  under `target_does_not_exist_in_test_files`) at least one target match
  must be found in the file.

Run the suite from the repo root with the project's virtualenv (see
[gir-rules/setup_venv.sh](../gir-rules/setup_venv.sh) /
[gir-rules/requirements.txt](../gir-rules/requirements.txt)):

```sh
cd gir-rules && python -m unittest test.py -v
```

## Adding a new rule

1. Add a YAML entry to `rules.yaml` in numeric order with `number`,
   `targets`, `rule`, and `description` copied/paraphrased from the OECD
   guide.
2. If the rule's logic can be expressed as a boolean XPath check relative to
   a target node, add a `test` expression following the `not(condition) or
   consequence` pattern above.
3. Create `testdocs/<number>/` with at least one `ok-01.xml` and one
   `nok-01.xml`, each a minimal schema-shaped fragment hitting one of the
   rule's `targets`. Add more numbered pairs to cover distinct logical
   branches.
4. While the rule still has no `test`, `references` and `element` may be
   present as a record of what the spec said the rule depends on. As soon as
   a `test` is implemented, remove `references` and `element` from the
   entry — the XPath itself is now the source of truth, and the fields
   would otherwise be stale duplication.
5. Run the test suite; if a fragment can't realistically contain a target
   match (e.g. the rule is about an element's absence), add the filename to
   `target_does_not_exist_in_test_files` instead of forcing an artificial
   target hit.
6. If the rule cannot be expressed as a simple per-element `test` (e.g. it
   needs cross-message state, history, or heavy cross-record correlation),
   leave `test` absent and note it in
   [gir-rules/TODO-RULES.md](../gir-rules/TODO-RULES.md) under "Out of Scope
   for Simple Local Test-Only Approach" rather than half-implementing it.

## Known inconsistencies

* A small number of section headers in `rules.yaml` (e.g.
  `other_record_errors:`, `other_record_errors_continued:`) appear as stray
  mapping keys inside the `rules` sequence rather than as comments — they
  are not used by any code and should eventually be converted to YAML
  comments or removed.
