# GIR Validation

This is an attempt to [formalize](rules.yaml) the specified validation rules as defined in [^1] so that they can be processed automatically with the following objectives:

* Keep the definitions comprehensible and as close as possible to the specification format.
* Provide maintainable test suites for automated testing.
* Enforce consistency with the schema definition.
* Allow the generation of specific error messages like "expected value in element Total is 150000 but was 120000".
* Use standard technologies which are available on different platforms (like YAML and XPath).
* Allow generation of test executors for different runtimes (JavaScript, Java, C#, Go, etc.).

The conventions for *authoring* rules and their tests — which operator to
reach for, the `implementation_notes` discipline, and how to cover every
branch — live in [specs/gir-rule-authoring.md](../specs/gir-rule-authoring.md).
This document is the reference for the rule format itself.

## Implementation approach

Each rule keeps **one target context** and expresses its check with **plain
XPath 1.0 operands** combined by a named **operator**. The operands stay
portable XPath (no XPath 2.0 features), so they remain "standard technologies";
the operator is a small fixed keyword that an interpreter applies in the host
language. That interpreter is the only layer that needs porting, and it is the
only place that can offer rounding tolerance, uniqueness checks, and rich
"expected X but was Y" error messages.

A rule is evaluated as follows:

1. Select all elements matched by the `targets` XPaths.
2. For each element, evaluate the rule's `when:` guard (if any); if it does not
   hold, the rule is vacuously satisfied for that element.
3. Otherwise apply the rule's single operator to the operands, evaluated
   relative to the target element (`.`), and expect it to pass.

The reference interpreter is [rule_eval.py](rule_eval.py) (`RuleEvaluator`,
plus `rule_is_active`) — a dependency-free module reused both by the tests and
in production. [test.py](test.py) only drives it over the fixtures.

A rule is **active** (automatically enforced) once it carries an operator key.
Many rules in [rules.yaml](rules.yaml) only carry `rule`/`description` text and
no operator yet — these describe logic that is not (or cannot be) expressed as a
local per-element check (e.g. cross-record arithmetic, cross-message checks,
matching against historical data). They are skipped by the logic tests but
still contribute to the target-path existence check.

## Rule shape

All rules live in a single list under `rules:` in `rules.yaml`, ordered by
`number`. Namespaces used in XPath expressions are declared once at the top of
the file under `xmlnamespaces:` (`globe`, `iso`, `stf`) and reused by every rule
and by the test runner.

```yaml
- number: 60024
  targets:
    - /globe:GLOBE_OECD/globe:GLOBEBody/globe:Summary
  when: globe:SafeHarbour or globe:ETRRange or ...   # optional guard
  present: globe:JurWithTaxingRights/globe:JurisdictionName
  rule: ...          # OECD wording, unchanged
  description: ...   # OECD error text, unchanged
```

### Fields

| Field | Required | Purpose |
|---|---|---|
| `number` | yes | The OECD rule number, used as the stable identifier everywhere (test folders, UI, etc.). |
| `targets` | yes | One or more absolute XPath expressions selecting the element(s) the rule applies to. Each target node becomes the context (`.`) for the assertion. |
| `when` | no | A guard; if it does not hold the rule is vacuously satisfied for that target. Normally a boolean XPath string (the common, compound case), but may instead be a single structured assertion whose truthiness is the guard (the message is discarded) — use that form only where an operator reads better than the XPath, e.g. `when: { isTrue: "@unknown" }`. |
| *operator* | no | Exactly one assertion operator key (see [Operators](#operators)) written at the rule top level. Its presence makes the rule active. |
| `rule` | yes | The rule text, copied/paraphrased as closely as possible from the OECD specification. Never edited to match implementation details. |
| `description` | yes | The explanatory/error message text from the OECD wording, copied as-is. |
| `implementation_notes` | no | Notes about the *implementation only* — never a restatement of the rule. |
| `element` | no | The schema element name the rule is conceptually about. Transitional scaffolding present only while a rule has no operator. |
| `references` | no | Dotted, schema-relative paths to other elements the rule's logic depends on. Transitional scaffolding present only while a rule has no operator. |
| `target_does_not_exist_in_test_files` | no | List of fixture file names where none of the `targets` are expected to match, to suppress the "no elements matched" assertion for tests of an absence scenario. |

## Operators

All operands are XPath 1.0 expressions evaluated against the target node (`.`).
The operand being checked is named `actual` and the reference is `expected`,
consistently across operators. `actual` defaults to `.` (the target node), so
it can be omitted and only the `expected` reference written. (`in`/`notIn`
always check the target `.` against their candidate list.)

| Operator | Operands | Passes when |
|---|---|---|
| `equals` / `notEquals` | `[a, b]` or `{actual?, expected, type?, offset?}` | the two operands are equal / not equal — numeric if both are numbers, else node-set string match. The `{…}` form behaves the same when untyped (with `actual` defaulting to `.`), and adds `type`/`offset` (see comparisons). |
| `almostEquals` | `{actual?, expected}` | within the calculation margin (see below). |
| `atMost` / `atLeast` / `lessThan` / `greaterThan` | `{actual?, expected, type?, offset?}` | `actual` is ≤ / ≥ / < / > `expected` (see comparisons). |
| `in` / `notIn` | `[<xpath>, …]` | the target (`.`) value is / is not among the values of the listed XPath expressions (each a quoted literal or a path). |
| `present` | xpath (node-set) | the node-set is non-empty. |
| `absent` | xpath (node-set) | the node-set is empty. |
| `isTrue` | xpath | the value is an xsd:boolean true (`'true'` or `'1'`); `'false'`/`'0'`/missing are false. For GIR boolean flags, often an attribute (e.g. `@unknown`). |
| `distinct` | xpath (node-set) | all selected node values are unique. |
| `allOf` | list of assertions | every nested assertion passes. |
| `anyOf` | list of assertions | at least one nested assertion passes. |

Write rules in **block YAML style** — do not use the flow (one-line) forms
`{ … }` / `[ … ]`. The `{actual?, expected, …}` and `[a, b]` notation in the
operands column above is just shorthand for "these fields" / "a list"; the rule
itself is always written expanded:

```yaml
# yes
notEquals:
  expected: "'OECD1'"

# no
notEquals: { expected: "'OECD1'" }
```

### Literals vs. XPath in operands

Every operand is an XPath expression, so a bare word is a *node test* (e.g.
`expected: ReportingPeriod` selects child `ReportingPeriod` elements), not the
string `"ReportingPeriod"`. To compare against a **string constant**, write an
XPath string literal — and quote it so YAML keeps XPath's own quotes:

```yaml
# YAML "..." preserves the XPath '...' literal
notEquals:
  expected: "'OECD1'"
# candidate literals; paths and literals mix freely
in:
  - "'OECD1'"
  - "'OECD2'"
  - ancestor::…/ResCountryCode
```

`"'OECD1'"` round-trips through YAML to the XPath expression `'OECD1'`, matching
the single-quote style used in `when:` clauses. Numbers need no quoting
(`expected: 0` is already a valid XPath number). This one rule holds everywhere —
there is no field with a separate "bare = literal" convention.

### `almostEquals` and the calculation margin

OECD allows, for any rule reflecting a GIR calculation, numbers rounded to a
maximum of four decimals plus a **1% margin of error** before the rule is
reported as failed. `almostEquals` therefore:

1. rounds `actual` and `expected` to 4 decimals, then
2. passes when `|actual − expected| ≤ 0.01 × max(|actual|, |expected|)`.

The 1% margin is fixed by the OECD specification and is **not** configurable per
rule. Because the margin is relative, write the calculation in `expected` as
ordinary XPath arithmetic — XPath coerces `+`/`−`/`*` operands to numbers
automatically, so no `number(...)` wrapping is needed:

```yaml
almostEquals:
  expected: ../globe:QualOwnerIntentBalance + ../globe:Additions - ../globe:Reductions
```

### Ordering comparisons and `type` / `offset`

`atMost` (≤), `atLeast` (≥), `lessThan` (<) and `greaterThan` (>) compare an
`actual` value against an `expected` value. Both are XPath expressions; two
optional fields handle the GIR date/year shapes so the rule author doesn't
hand-roll `translate()`/`substring()`:

* `type: date` — operands are `YYYY-MM-DD`; compared as `YYYYMMDD` integers and
  shown as the original date in messages.
* `type: year` — operands' leading 4-digit year is compared and shown.
* `offset` — an integer (in the unit of `type`) added to `expected` after
  normalization, for "N years/days before" windows. The message spells the
  offset out, e.g. `(End year - 3)`.

```yaml
# 70071: Year must be >= Period End year - 3 (actual defaults to the target .)
atLeast:
  expected: ancestor::globe:GLOBEBody/globe:FilingInfo/globe:Period/globe:End
  type: year
  offset: -3
# -> Expected Year to be at least 2021 (End year - 3) but was 2020
```

The same `{actual, expected, type, offset}` form is accepted by `equals` for
exact year/date arithmetic (e.g. rule 70095, "the fifth preceding Fiscal Year",
`type: year, offset: -5`). A plain `equals: [a, b]` stays available for the
untyped case.

A numeric (default, no `type`) comparison just compares the numbers, so sign
checks read directly:

```yaml
# 70073: EndAmount must not be negative
atLeast:
  expected: 0
# -> Expected EndAmount to be at least 0 but was -1
```

### `distinct` and scoping

`distinct` collects a node-set **relative to the target** and checks its values
are unique, so uniqueness scope is expressed by the target rather than by axis
tricks. For message-wide uniqueness, target the message root:

```yaml
targets:
  - /globe:GLOBE_OECD
distinct: //stf:CorrDocRefId
```

For "unique per ETR", target each `…/ETR` and select the repeated child — the
node-set is then naturally confined to that ETR.

## Error messages

When a rule fails, `RuleEvaluator.evaluate` returns a `Result` whose `message`
explains the failure for the filer. `evaluate` is still truthy/falsy (callers
can write `if not evaluate(...)`); the message is what surfaces in the UI and in
exchange Status Messages.

Messages are **specific and expected-vs-actual**: name the element at fault,
state what was expected, then what was actually found. Each operator renders its
own message:

| Operator | Message template |
|---|---|
| `present` | `Expected <path> to be present, but it is missing` |
| `absent` | `Expected <element> to be absent, but it is present` (the element label, not the full path, so a union/predicate operand stays readable) |
| `isTrue` | `Expected <element> to be true but was <actual>` |
| `equals` / `notEquals` | `Expected <element> to equal/not to equal <expected> but was <actual>` |
| `almostEquals` | `Expected <element> to be <expected> (within 1%) but was <actual>` |
| `atMost` / `atLeast` / `lessThan` / `greaterThan` | `Expected <element> to be at most/at least/less than/greater than <expected> but was <actual>` |
| `in` / `notIn` | `Expected <element> to be one of/not to be one of [<a>, <b>, …] but was <actual>` |
| `distinct` | `Expected all <element> values to be unique, but '<dup>' occurs more than once` |
| `anyOf` | `None of the expected conditions held: <msg>; <msg>` |
| `allOf` | the message of the first failing operand |

Rendering conventions, so messages stay consistent and stable enough to assert
on:

* **Strip namespace prefixes** from any path or element name (`globe:Total` →
  `Total`) — the filer thinks in spec terms, not XPath.
* **Element label** is the operand's own element: `.` renders as the target's
  local name; a path renders as its last step.
* **Numbers** are compact (`115.0` → `115`, `0.875` → `0.875`, max 4 decimals);
  **strings** are single-quoted; a missing node renders as `(missing)`.

## Testing approach

The rules are automatically tested against three tiers of XML fixtures, all
under [testdocs/](testdocs/) plus the shared [`../examples/`](../examples/)
directory. [test.py](test.py) is the single source of truth for how rules are
executed; it is a `unittest` suite run via `parameterized.expand` so every
rule/target/file combination shows up as its own test case.

1. **Positive examples** — `../examples/globe-positive-*.xml`. Full, realistic
   GIR filings. Every active rule must pass against every target match found in
   these documents.
2. **Complete reference documents** — `testdocs/complete-*.xml`. Full documents
   used to (a) validate against the XSD schema
   (`schemas/gir/globexml_v1.0.xsd`) so the fixtures themselves stay
   schema-valid, and (b) prove that every rule's `targets` XPath matches at
   least one node somewhere in the corpus (catches typos/renames in target
   paths even for rules with no operator).
3. **Rule-specific fragments** — `testdocs/<number>/ok-<nn>.xml` and
   `testdocs/<number>/nok-<nn>.xml`, one folder per active rule number. These
   are the primary correctness tests for the rule's logic. To stay selective,
   each fragment must match at least one of the rule's `targets` and contain
   only the elements relevant to that rule. Every `nok-<nn>.xml` has a required
   sibling `nok-<nn>-error.txt` pinning the exact failure message(s) — one line
   per failing target node, in document order — so wording changes are
   deliberate and a fixture can't silently stop being checked.

The suite's checks:

* `TestReferenceDocuments` — schema-validates the `complete-*.xml` and example
  docs, and checks every fragment file only contains paths known from those
  references (no typos or invented elements; not full XSD validation).
* `TestRuleSyntax.test_rule_has_at_most_one_operator` — a rule with two operator
  keys would have one check silently dropped, so it is rejected at build time.
* `TestRules.test_target_path_does_exist` — for every rule, asserts at least one
  `complete-*.xml` document has a node matching one of its `targets`.
* `TestRules.test_rules_on_complete_docs_and_examples` — for active rules,
  evaluates the assertion against every matching node in the complete + example
  documents and asserts it passes (these are all valid filings).
* `TestRules.test_positive_rules_on_dedicated_test_files` — runs every
  `testdocs/<number>/ok-*.xml` and asserts the rule holds for **every** matched
  target node (a valid document must satisfy the rule everywhere). Unless the
  file is listed under `target_does_not_exist_in_test_files`, at least one
  target match must be found.
* `TestRules.test_negative_rules_on_dedicated_test_files` — runs every
  `testdocs/<number>/nok-*.xml` and asserts the rule fails for **at least one**
  matched target node (an invalid document need only violate the rule
  somewhere). It also asserts the joined failure messages equal the required
  `nok-*-error.txt` sidecar verbatim, so a missing or stale sidecar fails the
  test.

Run the suite from the repo root with the project's virtualenv (see
[setup_venv.sh](setup_venv.sh) / [requirements.txt](requirements.txt)):

```sh
cd gir-rules && python -m unittest test.py -v
```

## References

[^1]: OECD (2025), GloBE Information Return (Pillar Two) Status Message XML Schema: User Guide for Tax Administrations, OECD Publishing, Paris, https://doi.org/10.1787/449e3cc3-en.

[^2]: OECD (2026), Tax Challenges Arising from the Digitalisation of the Economy – Guidance on the Use of the GIR XML Schema and Validation Rules for First GIR Filings and Exchanges: Inclusive Framework on BEPS, OECD, https://www.oecd.org/content/dam/oecd/en/topics/policy-sub-issues/global-minimum-tax/guidance-on-the-use-of-globe-information-return-xml-schema-june-2026.pdf
