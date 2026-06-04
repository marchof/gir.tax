# GIR Validation

This is an attempt to [formalize](rules.yaml) the specified validation rules as defined in [^1] so that it can be processed automatically. Each rule is evaluated as follows:

1. Select all elements that are selected by the `targets` XPaths.
2. For each element execute the `test` XPath expression and expect `true` as the return value.

## Rule Testing Strategy

The rules are automatically tested with the following fixture:

1. To ensure the `targets` XPaths are valid within the GIR schema they are expected to always have a match in one of the schema-validated `complete-n.xml` documents.
2. For each rule positive (`ok-n.xml`) and negative (`nok-n.xml`) test files are provided and executed. To keep these documents concise they are not validated against the schema and may only contain the relevant elements. To ensure consistency at least one XPath from `targets` must match on every test document.

## Status

This is work in progress. Only rules with a `test` expression are active.

## References

[^1]: OECD (2025), GloBE Information Return (Pillar Two) Status Message XML Schema: User Guide for Tax Administrations,
OECD Publishing, Paris, https://doi.org/10.1787/449e3cc3-en.