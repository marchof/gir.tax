# GIR Validation

This is an attempt to [formalize](rules.yaml) the specified validation rules as defined in [^1] so that it can be processed automatically with the following objectives:

* Keep the definitions comprehensible and as close as possible to the specification format.
* Provide maintainable test suites for automated testing.
* Enforce consistency with the schema definition.
* Use standard technologies which are available on different platforms (like YAML and XPath).
* Allow generation of test executors for different runtimes (JavaScript, Java, C#, Go, etc.)

## Current Implementation and Status

Each rule is defined by two field and evaluated as follows:

1. Select all elements that are selected by the `targets` XPaths.
2. For each element execute the `test` XPath expression and expect `true` as the return value.

This is work in progress. Only rules with a `test` expression are active.

## Rule Testing Strategy

The rules are automatically tested against the following set of test documents:

1. To ensure the `targets` XPaths are valid within the GIR schema they are expected to always have a match in one of the schema-validated `complete-n.xml` documents.
2. For each rule positive (`ok-n.xml`) and negative (`nok-n.xml`) test files are provided and executed. To keep these documents concise they are not validated against the schema and may only contain the relevant elements. To ensure consistency at least one XPath from `targets` must match on every test document.


## References

[^1]: OECD (2025), GloBE Information Return (Pillar Two) Status Message XML Schema: User Guide for Tax Administrations,
OECD Publishing, Paris, https://doi.org/10.1787/449e3cc3-en.