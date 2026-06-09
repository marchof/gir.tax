# GIR Validation

This is an attempt to [formalize](rules.yaml) the specified validation rules as defined in [^1] so that it can be processed automatically with the following objectives:

* Keep the definitions comprehensible and as close as possible to the specification format.
* Provide maintainable test suites for automated testing.
* Enforce consistency with the schema definition.
* Use standard technologies which are available on different platforms (like YAML and XPath).
* Allow generation of test executors for different runtimes (JavaScript, Java, C#, Go, etc.)

## Current Implementation and Status

Each rule is defined and evaluated as follows:

1. Select all elements that are selected by the `targets` XPaths.
2. For each element execute the `test` XPath expression and expect `true` as the return value.

This is work in progress. Only rules with a `test` expression are active.

## Rule Testing Strategy

The rules are automatically tested against the following set of test documents:

1. The positive [`../examples/`](../examples/) documents to ensure that the examples are valid with respect to all rules.
2. A set of "complete" documents `testdocs/complete-*.xml` which are validated against the schema to ensure that all rule targets do actually exist in the schema.
3. A set of rule specific positive and negative tests for every rule in `testdocs/<number>/[ok|nok]-<nn>.xml`. To ensure selectiveness the test files must match at least one target path. To keep the test documents concise they should only contain elements relevant for the respective rule elements. It is still verified that the documents are a valid subset of the schema (no unknown elements).


## References

[^1]: OECD (2025), GloBE Information Return (Pillar Two) Status Message XML Schema: User Guide for Tax Administrations, OECD Publishing, Paris, https://doi.org/10.1787/449e3cc3-en.

[^2]: OECD (2026), Tax Challenges Arising from the Digitalisation of the Economy – Guidance on the Use of the GIR XML Schema and Validation Rules for First GIR Filings and Exchanges: Inclusive Framework on BEPS, OECD, https://www.oecd.org/content/dam/oecd/en/topics/policy-sub-issues/global-minimum-tax/guidance-on-the-use-of-globe-information-return-xml-schema-june-2026.pdf