# GIR Validation

This is an attempt to formalize the specified validation rules as defined in [^1] so that it can be processed autimatically. Each rule is evaluated as follows:

1. Select all elements that are selected by the `targets` XPaths.
2. For each element execute the `test` XPath expression and expect `true` as the return value.


## References

[^1]: OECD (2025), GloBE Information Return (Pillar Two) Status Message XML Schema: User Guide for Tax Administrations,
OECD Publishing, Paris, https://doi.org/10.1787/449e3cc3-en.