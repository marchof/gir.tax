# GIR Rule Authoring

This spec describes the conventions for *writing* GIR validation rules in
[gir-rules/rules.yaml](../gir-rules/rules.yaml) and for building the test
fixtures that pin their behaviour. The rule format itself — the operator
vocabulary, operand syntax, and error-message rendering — is documented in
[gir-rules/README.md](../gir-rules/README.md); this document is about the
judgement calls on top of it: which operator to reach for, what belongs in
`implementation_notes`, and how to make a fixture set actually catch a wrong or
incomplete implementation.

## Provenance of the OECD fields

`rule` and `description` are the OECD's own wording. They are extracted from the
specification document and left untouched — never edited to match implementation
details.

`targets` starts from the element path the spec cites, adapted twice to become
an executable selector:

* Each step is prefixed with the exact namespace alias (`globe:`, `stf:`,
  `iso:`), since XPath evaluation needs it to resolve elements and the spec path
  doesn't carry namespaces.
* Where the spec's literal path doesn't give a usable evaluation context (e.g.
  the rule correlates elements that aren't in a strict ancestor/descendant
  relationship), the path is shortened to a common ancestor so the assertion has
  a single, well-defined context node — documented via `implementation_notes`
  (see rule `70027`).

## Transitional fields: `element` and `references`

`element` and `references` record, in human-readable plain/dotted form, what the
spec said a rule is about and depends on, before that knowledge is encoded as an
operator and XPath operands. They are scaffolding for rules that are not yet
formalized.

Once a rule gains an operator, that knowledge lives in the operands themselves,
and `element`/`references` add no further value. Remove them from the entry as
part of adding the operator — not before, and not left behind "just in case".

## Choosing an operator

* Prefer the most specific operator that fits (`present`, `in`, `equals`,
  `distinct`, `almostEquals`) — each reads closer to the spec and lets the
  interpreter render a precise message. Avoid expressing as a generic boolean
  what a dedicated operator already captures.
* Put the rule's gating condition in `when:` and keep the operator to the
  *consequence* only. Don't fold the guard into the assertion.
* Reach for `allOf`/`anyOf` only when a rule genuinely combines independent
  consequences; a single condition + single consequence is the norm.
* When one OECD rule states two checks that share a target but apply under
  different conditions, keep it as one rule entry and combine them with `allOf`,
  giving each branch its own `when:` (a guard-false branch passes vacuously).
  Prefer this over inventing a second, suffixed rule number — see the per-branch
  `when` note in
  [gir-rules/README.md](../gir-rules/README.md#per-branch-when-in-allof--anyof).
* Use relative axes (`../`, `ancestor::`, `parent::`) to reach the sibling or
  ancestor data an operand needs, and `*` wildcards for "any election type"
  patterns (e.g. `globe:Election/*/globe:RevocationYear`).
* For year/date arithmetic, use the `type`/`offset` fields on the comparison and
  `equals` operators rather than hand-rolling `translate()`/`substring()` — see
  [gir-rules/README.md](../gir-rules/README.md#ordering-comparisons-and-type--offset).
* For a fixed-layout structured reference (composite TIN, MessageRefId,
  DocRefId), use `matches` with an anchored regex rather than a chain of
  `substring()`/`translate()` checks under `allOf` — see
  [gir-rules/README.md](../gir-rules/README.md#matches-and-structured-reference-formats).
  It checks structure only; correlating a segment to a real value, or its
  uniqueness, stays a separate rule.
* To correlate two sections that share no parent/child relationship (e.g. a
  `Summary` value gating a `JurisdictionSection` element), target the element that
  carries the *consequence*'s context and pin the *match* in `when:` via
  **existential node-set equality** (`A = B` holds when any value of `A` equals
  any value of `B`). This keeps the operand portable XPath 1.0 — no `current()` or
  variables, which the browser XPath engine lacks. One cross-context key fits one
  `=`; a second key needs to ride as a local predicate on one side (see the
  SafeHarbour subgroup-TIN rules 70045/70047–70053).

## Each rule stands on its own

A rule must fully test what its OECD wording specifies *without depending on
another rule being active* — administrations may enable or disable individual
rules, and a disabled neighbour must never silently weaken what a rule enforces.
Concretely, do not narrow an assertion on the assumption that a sibling rule
rules out the unwanted case:

* "Another CE has GIRxxx" is **not** "some CE has GIRxxx" — target the CE
  carrying the trigger and check its *sibling* CEs
  (`(preceding-sibling::globe:CE | following-sibling::globe:CE)/…`), so the
  "different element" requirement is carried by the axes themselves, not by a
  same-CE mutual-exclusion rule (see 70015/70019, which must reject a lone CE
  holding both statuses even if 70014/70018 were off).

This is distinct from *not re-checking* something a rule never claims to enforce:
a value-only rule whose element is optional is vacuously satisfied when the
element is absent, and that is correct — the presence requirement is a separate
rule's job (see 70112/70113 vs 70111). The test is whether disabling the other
rule would let this rule *pass a document its own wording forbids*; if so, the
rule is too weak.

## `implementation_notes`

`implementation_notes` documents the *implementation*, not the rule. The rule
and its intent already live in `rule`/`description`; do not paraphrase or
restate them here. Most rules need no `implementation_notes` at all — a
straightforward assertion that maps directly onto the spec wording should have
none. Add the field only when something about the encoding isn't obvious from
reading the operands, namely:

* **Targets changed for technical reasons** — when `targets` had to be moved to
  a common ancestor, narrowed, or otherwise diverge from the path the spec cites
  so the assertion has a usable context node (see rule `70027`).
* **A non-obvious encoding** — when an operand uses a trick that isn't
  self-evident, e.g. a `translate()`-based character check. Note the technique,
  not the rule it enforces.
* **Assumptions about an unclear rule** — when the spec wording is ambiguous and
  the rule commits to one reading (e.g. interpreting a date field as a year-only
  comparison), record the assumption that was made.

If a note would just re-describe what the rule requires, leave it out.

## Test fixtures

Each active rule is backed by a folder `testdocs/<number>/` of `ok-NN.xml`
(positive, rule must hold) and `nok-NN.xml` (negative, rule must fail) fragments,
numbered from `01`. The three tiers of fixtures and how the suite runs them are
described in [gir-rules/README.md](../gir-rules/README.md#testing-approach);
this section is about writing fragments that are minimal and complete.

### Keep fragments minimal and schema-shaped

* Start from the `<globe:GLOBE_OECD>` root and include only the ancestor/sibling
  elements actually needed to exercise the rule — don't pad fragments with
  unrelated content.
* Declare only the namespace prefixes (`globe`, `stf`, …) actually used in that
  specific fragment. Omit `xmlns:xsi` / `xsi:schemaLocation` (a schema reference
  has no bearing on what a fragment tests) and the `version` attribute (optional
  in the schema, irrelevant to rule logic) unless the rule's
  operands/`targets` actually concern one of them.
* Despite being minimal, every path in a fragment must exist somewhere in the
  complete/example corpus (enforced by
  `test_fragment_reference_doc_should_only_contain_known_paths`) — no typos or
  invented elements.
* Each fragment must match at least one of the rule's `targets`, so the test
  actually exercises the rule rather than vacuously passing. If a fragment is
  intentionally testing an *absence* scenario where no target node exists, list
  that filename under the rule's `target_does_not_exist_in_test_files` instead
  of relying on the "no elements matched" check to fail.

### Covering every branch

A passing rule against one `ok` and one `nok` only proves it fires in two of its
states; the branches in between have repeatedly turned out to be broken or
untested (a missing enumerated value, an unmatched "at least one" candidate).
Treat the list below as a checklist and add a fixture for each item the rule
actually contains — the goal is that *every* operand and branch changes the
outcome of at least one fixture:

* **Every value of an enumerated trigger.** When the condition keys off a set of
  values (e.g. `Role` ∈ {GIR403, GIR404, GIR405}, `DocTypeIndic` ∈ {OECD2,
  OECD3}), exercise *each* listed value, on both sides where it can pass and
  fail — rule `60019` needs a `nok` for GIR403, GIR404 **and** GIR405, not one
  standing in for the rest.
* **The "not triggered" branch.** When a `when:` guard gates the rule, add an
  `ok` where the guard is *false* so the rule passes vacuously — and give it
  consequence-data that is deliberately "wrong" so the fixture would start
  failing if the guard were ever dropped (see rule `60022`'s non-GIR401 `ok`
  whose TIN matches nothing).
* **"At least one of N" / existence.** Provide an `ok` where several candidates
  exist and the matching one is *neither the only one nor first in document
  order* (rule `60022`'s OtherUPE-matches-while-ExcludedUPE-doesn't `ok`), plus
  a `nok` where none match. Matching only ever the first candidate hides
  node-set comparison bugs.
* **Both edges of a comparison.** For `atMost`/`atLeast`/`lessThan`/
  `greaterThan` or a typed `equals` window, put a fixture exactly *on* the
  boundary on the passing side (equal date, `End - 4`, …) and one just past it
  on the failing side. A two-sided window (rule `70071`) needs both the too-low
  and the too-high edge.
* **Guarded / absent branches.** If the rule guards on a possibly-missing
  element, add an `ok` with that element absent so the guard branch is actually
  executed, not just assumed.

### One `nok` per covered element

Treat `targets` and the operator as *implementation details*: the fixture set is
the rule's behavioural spec, and should be complete enough to catch a wrong **or
incomplete** implementation — including a `targets` list that misses an element
the rule is supposed to cover.

So when a rule applies the same condition to several same-kind elements (e.g.
the four `DDTYear-N` of rule `70075`, or each of several listed `DocTypeIndic`
paths), give **each element its own `nok`** with the violation isolated to that
one element. If that element were dropped from `targets`, no matched target
would fail and its `nok` would break — which is exactly the signal we want. A
single shared `nok` would leave the missing-target case undetected, so don't
collapse them even though the assertion is identical for each.

### Why the runner treats `ok` and `nok` asymmetrically

This matches what valid/invalid documents actually mean: a positive (`ok-`) file
must satisfy the rule for *every* matched target node, while a negative (`nok-`)
file only needs *at least one* matched target to fail. A negative fixture is
therefore allowed to contain valid targets alongside the violating one.

### Pinning error messages

Every negative fixture pins its expected message so wording changes are
deliberate, not accidental. Next to every `testdocs/<number>/nok-NN.xml`, add a
sibling `nok-NN-error.txt` containing the exact message(s) the evaluator
produces — one line per failing target node, in document order.
`test_negative_rules_on_dedicated_test_files` asserts the joined messages equal
the file as part of checking the negative case; the sidecar is **required**, so
a missing or stale one fails the test rather than silently dropping the message
check.

## Adding a new rule

1. Add a YAML entry to `rules.yaml` in numeric order with `number`, `targets`,
   `rule`, and `description` copied/paraphrased from the OECD guide. While the
   rule has no operator, `element`/`references` may record what the spec says it
   is about and depends on.
2. If the rule's logic can be expressed as a local per-element check, add the
   appropriate operator (and a `when:` guard for any gating condition), then
   **remove** `element`/`references` — the operands are now the source of truth.
3. Create `testdocs/<number>/` with `ok-`/`nok-` fragments, each a minimal
   schema-shaped fragment hitting one of the rule's `targets`. Work through
   [Covering every branch](#covering-every-branch) and add a fixture for every
   branch that applies; pin negative messages with `nok-NN-error.txt`.
4. Run the suite. If a fragment can't realistically contain a target match (an
   absence scenario), add the filename to `target_does_not_exist_in_test_files`
   instead of forcing an artificial target hit.
5. If the rule cannot be expressed as a simple per-element check (it needs
   cross-message state, history, or heavy cross-record correlation), leave it
   without an operator rather than half-implementing it.
