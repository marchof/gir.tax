"""Interpreter for the GIR structured rule vocabulary.

Pure evaluation logic for the rule operators documented in
``gir-rules/README.md``. It has no test dependencies so it can be
reused in production (e.g. validating uploaded GIR documents), not only by
``test.py``.

A rule's check is expressed with the structured vocabulary:

    when: <xpath boolean>     # optional guard; if false the rule is vacuous
    <operator>: <operands>    # one of ASSERTION_OPS, at the rule top level

Operands are plain XPath 1.0 expressions evaluated against the target node;
the operator is applied here in Python so we get rounding tolerance and
uniqueness without XPath-2.0 features.
"""

from math import isnan

ASSERTION_OPS = (
    "equals", "notEquals", "almostEquals", "in", "notIn",
    "atMost", "atLeast", "lessThan", "greaterThan",
    "present", "absent", "isTrue", "distinct", "allOf", "anyOf",
)

# GIR boolean flags are encoded as xsd:boolean, so both lexical forms of true
# are accepted ("true"/"1"); anything else (incl. "false"/"0"/missing) is false.
TRUE_VALUES = ("true", "1")

# Ordering comparators: operator name -> (human phrase, comparison function).
COMPARATORS = {
    "atMost": ("at most", lambda actual, limit: actual <= limit),
    "atLeast": ("at least", lambda actual, limit: actual >= limit),
    "lessThan": ("less than", lambda actual, limit: actual < limit),
    "greaterThan": ("greater than", lambda actual, limit: actual > limit),
}

# OECD calculation rules tolerate a 1% margin of error (numbers rounded to a
# maximum of four decimals) before a calculation rule is reported as failed.
# This margin is fixed by the OECD specification, so it is not configurable
# per rule.
CALCULATION_TOLERANCE = 0.01


def rule_assertion(rule):
    """Return the assertion mapping for a rule, or None if it has no check.

    Assumes each rule carries at most one operator key (enforced at build time
    by the rules.yaml tests); if several were present the first in
    ``ASSERTION_OPS`` order would win.
    """
    for op in ASSERTION_OPS:
        if op in rule:
            return {op: rule[op]}
    return None


def rule_is_active(rule):
    """True if the rule has an executable check."""
    return rule_assertion(rule) is not None


class Result:
    """Outcome of evaluating an assertion against one target node.

    Truthy when the rule holds, so callers can keep writing
    ``if not evaluator.evaluate(...)``. On failure, ``message`` carries a
    specific, expected-vs-actual explanation for the filer.
    """

    __slots__ = ("ok", "message")

    def __init__(self, ok, message=None):
        self.ok = ok
        self.message = message

    def __bool__(self):
        return self.ok

    def __repr__(self):
        return f"Result(ok={self.ok!r}, message={self.message!r})"


_PASS = Result(True)


class RuleEvaluator:
    """Evaluates structured rules against XML nodes for a set of namespaces."""

    def __init__(self, namespaces):
        self.namespaces = namespaces

    def evaluate(self, rule, ctx):
        """Evaluate a rule against a single target (context) node."""
        when = rule.get("when")
        if when is not None and not self._guard_holds(when, ctx):
            return _PASS  # guard false -> vacuously satisfied
        return self.eval_assertion(rule_assertion(rule), ctx)

    def _guard_holds(self, when, ctx):
        """A `when:` guard is either a raw XPath boolean (the common, compound
        case) or one structured assertion reused from the operator vocabulary
        (e.g. isTrue); only its truthiness matters, the message is discarded."""
        if isinstance(when, dict):
            return self.eval_assertion(when, ctx).ok
        return bool(self._xp(when, ctx))

    def eval_assertion(self, node, ctx):
        (op, arg), = node.items()

        if op == "present":
            if self._xp(arg, ctx):
                return _PASS
            return Result(False, f"Expected {self._strip_ns(arg)} to be present, but it is missing")

        if op == "absent":
            if not self._xp(arg, ctx):
                return _PASS
            return Result(False, f"Expected {self._label(arg, ctx)} to be absent, but it is present")

        if op == "isTrue":
            if any(v in TRUE_VALUES for v in self._values(arg, ctx)):
                return _PASS
            return Result(False, f"Expected {self._label(arg, ctx)} to be true but was {self._value_str(arg, ctx)}")

        if op in ("equals", "notEquals"):
            want_equal = op == "equals"
            if isinstance(arg, dict):
                actual_expr, expected_expr = arg.get("actual", "."), arg["expected"]
                if "type" in arg or "offset" in arg:  # typed: numeric year/date compare
                    actual_num, expected_num, actual_disp, expected_disp, label = self._scalar(arg, ctx)
                    ok = actual_num == expected_num
                else:  # untyped: same numeric-or-string semantics as the list form
                    ok = self._eq(actual_expr, expected_expr, ctx)
                    actual_disp = self._value_str(actual_expr, ctx)
                    expected_disp = self._value_str(expected_expr, ctx)
                    label = self._label(actual_expr, ctx)
            else:
                a, b = arg
                ok = self._eq(a, b, ctx)
                actual_disp, expected_disp = self._value_str(a, ctx), self._value_str(b, ctx)
                label = self._label(a, ctx)
            if ok == want_equal:
                return _PASS
            join = "to equal" if want_equal else "not to equal"
            return Result(False, f"Expected {label} {join} {expected_disp} but was {actual_disp}")

        if op in COMPARATORS:
            phrase, compare = COMPARATORS[op]
            actual_num, expected_num, actual_disp, expected_disp, label = self._scalar(arg, ctx)
            if compare(actual_num, expected_num):
                return _PASS
            return Result(False, f"Expected {label} to be {phrase} {expected_disp} but was {actual_disp}")

        if op == "almostEquals":
            actual_expr = arg.get("actual", ".")
            actual = round(self._as_number(actual_expr, ctx), 4)
            expected = round(self._as_number(arg["expected"], ctx), 4)
            margin = CALCULATION_TOLERANCE * max(abs(actual), abs(expected))
            if abs(actual - expected) <= margin:
                return _PASS
            return Result(False, (
                f"Expected {self._label(actual_expr, ctx)} to be {_fmt_num(expected)} "
                f"(within 1%) but was {_fmt_num(actual)}"
            ))

        if op in ("in", "notIn"):
            want_in = op == "in"
            candidates = self._membership_values(arg, ctx)
            actuals = self._values(".", ctx)
            if bool(set(actuals) & set(candidates)) == want_in:
                return _PASS
            join = "to be one of" if want_in else "not to be one of"
            return Result(False, (
                f"Expected {self._label('.', ctx)} {join} [{', '.join(candidates)}] "
                f"but was {self._value_str('.', ctx)}"
            ))

        if op == "distinct":
            dup = _first_duplicate(self._values(arg, ctx))
            if dup is None:
                return _PASS
            return Result(False, (
                f"Expected all {self._label(arg, ctx)} values to be unique, "
                f"but '{dup}' occurs more than once"
            ))

        if op == "allOf":
            for a in arg:
                result = self.eval_assertion(a, ctx)
                if not result.ok:
                    return result
            return _PASS

        if op == "anyOf":
            messages = []
            for a in arg:
                result = self.eval_assertion(a, ctx)
                if result.ok:
                    return _PASS
                messages.append(result.message)
            return Result(False, "None of the expected conditions held: " + "; ".join(messages))

        raise ValueError(f"Unknown assertion operator: {op}")

    # -- XPath helpers --------------------------------------------------

    def _xp(self, expr, ctx):
        # Operands may be numeric YAML literals (e.g. `expected: 0`); XPath
        # needs a string, and `str(0)` -> "0" is a valid XPath number.
        return ctx.xpath(str(expr), namespaces=self.namespaces)

    def _as_number(self, expr, ctx):
        return float(ctx.xpath(f"number({expr})", namespaces=self.namespaces))

    def _values(self, expr, ctx):
        res = self._xp(expr, ctx)
        if isinstance(res, list):
            return [_node_value(n) for n in res]
        return [str(res)]

    def _eq(self, a, b, ctx):
        """XPath-style equality: numeric if both are numbers, otherwise true
        when any value of the two node-sets matches (any-hit, like ``a = b``)."""
        na, nb = self._as_number(a, ctx), self._as_number(b, ctx)
        if not isnan(na) and not isnan(nb):  # both numeric -> numeric comparison
            return na == nb
        return bool(set(self._values(a, ctx)) & set(self._values(b, ctx)))

    def _membership_values(self, exprs, ctx):
        """Candidate values for `in`/`notIn`: the union of the values of each
        XPath expression in the list (each may be a string literal or a path)."""
        values = []
        for expr in exprs:
            values.extend(self._values(expr, ctx))
        return values

    # -- typed scalar comparison (compare ops + typed equals) ----------

    def _scalar(self, arg, ctx):
        """Resolve an {actual, expected, type?, offset?} operand to comparable
        numbers plus display strings and a label for the actual value.

        ``actual`` defaults to the target node (``.``). ``type`` normalizes
        both operands: ``date`` strips ``-`` from ``YYYY-MM-DD`` to a
        comparable integer; ``year`` takes the leading 4-digit year; numeric
        is the default. ``offset`` (an integer in the unit of ``type``) is
        added to the expected value after normalization.
        """
        typ = arg.get("type")
        offset = arg.get("offset", 0)
        actual, expected = arg.get("actual", "."), arg["expected"]

        actual_num = self._typed_number(actual, typ, ctx)
        expected_num = self._typed_number(expected, typ, ctx) + offset

        return (
            actual_num, expected_num,
            self._typed_disp(actual, typ, ctx, actual_num),
            self._expected_disp(expected, typ, offset, ctx, expected_num),
            self._label(actual, ctx),
        )

    def _typed_number(self, expr, typ, ctx):
        if typ == "date":
            return self._as_number(f"translate({expr}, '-', '')", ctx)
        if typ == "year":
            return self._as_number(f"substring({expr}, 1, 4)", ctx)
        return self._as_number(expr, ctx)

    def _typed_disp(self, expr, typ, ctx, num):
        if typ == "date":
            vals = self._values(expr, ctx)
            return vals[0] if vals else "(missing)"
        if typ == "year":
            return str(int(num))
        return _fmt_num(num)

    def _expected_disp(self, expr, typ, offset, ctx, expected_num):
        if typ == "date" and not offset:
            vals = self._values(expr, ctx)
            base = vals[0] if vals else "(missing)"
        elif typ == "year":
            base = str(int(expected_num))
        else:
            base = _fmt_num(expected_num)
        if offset:
            unit = " year" if typ == "year" else ""
            sign = "-" if offset < 0 else "+"
            base += f" ({self._label(expr, ctx)}{unit} {sign} {abs(offset)})"
        return base

    # -- message rendering ---------------------------------------------

    def _strip_ns(self, expr):
        """Drop namespace prefixes so paths read like the spec (globe:X -> X)."""
        for prefix in self.namespaces:
            expr = expr.replace(f"{prefix}:", "")
        return expr.strip()

    def _label(self, expr, ctx):
        """A short human label for an operand: the element it refers to."""
        expr = str(expr).strip()
        if expr == ".":
            return ctx.xpath("local-name(.)")
        step = self._strip_ns(expr).split("/")[-1]
        step = step.split("::")[-1].split("[")[0]
        return step.strip()

    def _value_str(self, expr, ctx):
        """Render an operand's value for a message: number, 'string', or (missing)."""
        vals = self._values(expr, ctx)
        if not vals:
            return "(missing)"
        number = self._as_number(expr, ctx)
        if not isnan(number):
            return _fmt_num(number)
        return f"'{vals[0]}'"


def _node_value(node):
    return node if isinstance(node, str) else node.xpath("string(.)")


def _first_duplicate(values):
    seen = set()
    for value in values:
        if value in seen:
            return value
        seen.add(value)
    return None


def _fmt_num(number):
    """Compact number formatting: 115.0 -> '115', 0.875 -> '0.875'."""
    return f"{number:.4f}".rstrip("0").rstrip(".")
