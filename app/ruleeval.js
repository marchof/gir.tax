// Interpreter for the GIR structured rule vocabulary.
//
// A JavaScript port of gir-rules/rule_eval.py: the same operators, `when`
// guards, typed scalar comparisons, and expected-vs-actual messages. It is pure
// and host-agnostic — it reaches XPath only through an injected adapter, so the
// same logic runs in the browser (over xmlDocument.evaluate) and in the Node
// parity harness (over @xmldom/xmldom + xpath). The rule format itself is
// documented in gir-rules/README.md.
//
// The adapter passed to RuleEvaluator provides five primitives, each evaluating
// `expr` relative to the context node `ctx`:
//   nodes(expr, ctx)   -> array of matched nodes
//   number(expr, ctx)  -> number(expr) as a JS number (NaN if not numeric)
//   boolean(expr, ctx) -> boolean(expr) as a JS boolean
//   string(expr, ctx)  -> string(expr) as a JS string
//   values(expr, ctx)  -> for a node-set, the string value of each node in
//                         document order; otherwise the scalar's XPath string

export const ASSERTION_OPS = [
  "equals", "notEquals", "almostEquals", "in", "notIn",
  "atMost", "atLeast", "lessThan", "greaterThan",
  "present", "absent", "isTrue", "matches", "distinct", "allOf", "anyOf",
];

// GIR boolean flags are encoded as xsd:boolean, so both lexical forms of true
// are accepted ("true"/"1"); anything else (incl. "false"/"0"/missing) is false.
const TRUE_VALUES = ["true", "1"];

// Ordering comparators: operator name -> [human phrase, comparison function].
const COMPARATORS = {
  atMost: ["at most", (actual, limit) => actual <= limit],
  atLeast: ["at least", (actual, limit) => actual >= limit],
  lessThan: ["less than", (actual, limit) => actual < limit],
  greaterThan: ["greater than", (actual, limit) => actual > limit],
};

// OECD calculation rules tolerate a 1% margin of error (numbers rounded to a
// maximum of four decimals) before a calculation rule is reported as failed.
// This margin is fixed by the OECD specification, so it is not configurable.
const CALCULATION_TOLERANCE = 0.01;

// Return the single assertion mapping for a rule, or null if it has no check.
// Assumes each rule carries at most one operator key (enforced at build time);
// if several were present the first in ASSERTION_OPS order would win.
export function ruleAssertion(rule) {
  for (const op of ASSERTION_OPS) {
    if (op in rule) {
      return { [op]: rule[op] };
    }
  }
  return null;
}

// True if the rule has an executable check.
export function ruleIsActive(rule) {
  return ruleAssertion(rule) !== null;
}

// Outcome of evaluating an assertion against one target node. On failure,
// `message` carries a specific, expected-vs-actual explanation for the filer.
export class Result {
  constructor(ok, message = null) {
    this.ok = ok;
    this.message = message;
  }
}

const PASS = new Result(true);

export class RuleEvaluator {
  // `xpath` is the five-method adapter (see file header); `namespaces` is the
  // prefix -> uri map, used only to strip prefixes from message labels.
  constructor(xpath, namespaces) {
    this.xpath = xpath;
    this.namespaces = namespaces;
  }

  // Evaluate a rule against a single target (context) node.
  evaluate(rule, ctx) {
    return this.evalAssertion(rule, ctx);
  }

  // A `when:` guard is either a raw XPath boolean (the common, compound case)
  // or one structured assertion reused from the operator vocabulary (e.g.
  // isTrue); only its truthiness matters, the message is discarded.
  _guardHolds(when, ctx) {
    if (typeof when === "object") {
      return this.evalAssertion(when, ctx).ok;
    }
    return this.xpath.boolean(when, ctx);
  }

  evalAssertion(node, ctx) {
    // A `when:` guard may sit on any assertion node, not just the rule top
    // level: nested children of allOf/anyOf can carry their own guard, so one
    // rule can hold several checks with different conditions. A node is thus its
    // operator key plus optional metadata (when, and on the rule itself
    // number/rule/description/...); ruleAssertion picks the operator.
    const when = node.when;
    if (when !== undefined && when !== null && !this._guardHolds(when, ctx)) {
      return PASS; // guard false -> vacuously satisfied
    }
    const assertion = ruleAssertion(node);
    const op = Object.keys(assertion)[0];
    const arg = assertion[op];

    if (op === "present") {
      if (this.xpath.boolean(arg, ctx)) {
        return PASS;
      }
      return new Result(false, `Expected ${this._stripNs(arg)} to be present, but it is missing`);
    }

    if (op === "absent") {
      if (!this.xpath.boolean(arg, ctx)) {
        return PASS;
      }
      return new Result(false, `Expected ${this._label(arg, ctx)} to be absent, but it is present`);
    }

    if (op === "isTrue") {
      if (this.xpath.values(arg, ctx).some(v => TRUE_VALUES.includes(v))) {
        return PASS;
      }
      return new Result(false, `Expected ${this._label(arg, ctx)} to be true but was ${this._valueStr(arg, ctx)}`);
    }

    if (op === "matches") {
      // The operand stays plain XPath: `actual` (default `.`) selects the
      // value, `expected` is an XPath string literal carrying the regex. The
      // regex is applied here in the host language (like almostEquals'
      // tolerance), so the operand layer keeps no XPath-2.0 matches()
      // dependency. The pattern supplies its own anchors (^…$).
      const actualExpr = "actual" in arg ? arg.actual : ".";
      const pattern = this.xpath.values(arg.expected, ctx)[0] ?? "";
      const value = this.xpath.values(actualExpr, ctx)[0] ?? "";
      if (new RegExp(pattern).test(value)) {
        return PASS;
      }
      return new Result(false, (
        `Expected ${this._label(actualExpr, ctx)} to match the required `
        + `format but was ${this._valueStr(actualExpr, ctx)}`
      ));
    }

    if (op === "equals" || op === "notEquals") {
      const wantEqual = op === "equals";
      let ok, actualDisp, expectedDisp, label;
      if (!Array.isArray(arg)) {
        const actualExpr = "actual" in arg ? arg.actual : ".";
        const expectedExpr = arg.expected;
        if ("type" in arg || "offset" in arg) { // typed: numeric year/date compare
          const s = this._scalar(arg, ctx);
          ok = s.actualNum === s.expectedNum;
          actualDisp = s.actualDisp;
          expectedDisp = s.expectedDisp;
          label = s.label;
        } else { // untyped: same numeric-or-string semantics as the list form
          ok = this._eq(actualExpr, expectedExpr, ctx);
          actualDisp = this._valueStr(actualExpr, ctx);
          expectedDisp = this._valueStr(expectedExpr, ctx);
          label = this._label(actualExpr, ctx);
        }
      } else {
        const [a, b] = arg;
        ok = this._eq(a, b, ctx);
        actualDisp = this._valueStr(a, ctx);
        expectedDisp = this._valueStr(b, ctx);
        label = this._label(a, ctx);
      }
      if (ok === wantEqual) {
        return PASS;
      }
      const join = wantEqual ? "to equal" : "not to equal";
      return new Result(false, `Expected ${label} ${join} ${expectedDisp} but was ${actualDisp}`);
    }

    if (op in COMPARATORS) {
      const [phrase, compare] = COMPARATORS[op];
      const s = this._scalar(arg, ctx);
      if (compare(s.actualNum, s.expectedNum)) {
        return PASS;
      }
      return new Result(false, `Expected ${s.label} to be ${phrase} ${s.expectedDisp} but was ${s.actualDisp}`);
    }

    if (op === "almostEquals") {
      const actualExpr = "actual" in arg ? arg.actual : ".";
      const actual = round4(this.xpath.number(actualExpr, ctx));
      const expected = round4(this.xpath.number(arg.expected, ctx));
      const margin = CALCULATION_TOLERANCE * Math.max(Math.abs(actual), Math.abs(expected));
      if (Math.abs(actual - expected) <= margin) {
        return PASS;
      }
      return new Result(false, (
        `Expected ${this._label(actualExpr, ctx)} to be ${fmtNum(expected)} `
        + `(within 1%) but was ${fmtNum(actual)}`
      ));
    }

    if (op === "in" || op === "notIn") {
      const wantIn = op === "in";
      const candidates = this._membershipValues(arg, ctx);
      const candidateSet = new Set(candidates);
      const hit = this.xpath.values(".", ctx).some(v => candidateSet.has(v));
      if (hit === wantIn) {
        return PASS;
      }
      const join = wantIn ? "to be one of" : "not to be one of";
      return new Result(false, (
        `Expected ${this._label(".", ctx)} ${join} [${candidates.join(", ")}] `
        + `but was ${this._valueStr(".", ctx)}`
      ));
    }

    if (op === "distinct") {
      const dup = firstDuplicate(this.xpath.values(arg, ctx));
      if (dup === null) {
        return PASS;
      }
      return new Result(false, (
        `Expected all ${this._label(arg, ctx)} values to be unique, `
        + `but '${dup}' occurs more than once`
      ));
    }

    if (op === "allOf") {
      for (const a of arg) {
        const result = this.evalAssertion(a, ctx);
        if (!result.ok) {
          return result;
        }
      }
      return PASS;
    }

    if (op === "anyOf") {
      const messages = [];
      for (const a of arg) {
        const result = this.evalAssertion(a, ctx);
        if (result.ok) {
          return PASS;
        }
        messages.push(result.message);
      }
      return new Result(false, "None of the expected conditions held: " + messages.join("; "));
    }

    throw new Error(`Unknown assertion operator: ${op}`);
  }

  // -- helpers -------------------------------------------------------

  _eq(a, b, ctx) {
    // XPath-style equality: numeric if both are numbers, otherwise true when
    // any value of the two node-sets matches (any-hit, like `a = b`).
    const na = this.xpath.number(a, ctx);
    const nb = this.xpath.number(b, ctx);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) { // both numeric -> numeric comparison
      return na === nb;
    }
    const setB = new Set(this.xpath.values(b, ctx));
    return this.xpath.values(a, ctx).some(v => setB.has(v));
  }

  // Candidate values for `in`/`notIn`: the union of the values of each XPath
  // expression in the list (each may be a string literal or a path).
  _membershipValues(exprs, ctx) {
    const values = [];
    for (const expr of exprs) {
      values.push(...this.xpath.values(expr, ctx));
    }
    return values;
  }

  // -- typed scalar comparison (compare ops + typed equals) ----------

  // Resolve an {actual, expected, type?, offset?} operand to comparable numbers
  // plus display strings and a label for the actual value. `actual` defaults to
  // the target node (`.`). `type` normalizes both operands: `date` strips `-`
  // from YYYY-MM-DD to a comparable integer; `year` takes the leading 4-digit
  // year; numeric is the default. `offset` (an integer in the unit of `type`)
  // is added to the expected value after normalization.
  _scalar(arg, ctx) {
    const typ = arg.type;
    const offset = "offset" in arg ? arg.offset : 0;
    const actual = "actual" in arg ? arg.actual : ".";
    const expected = arg.expected;

    const actualNum = this._typedNumber(actual, typ, ctx);
    const expectedNum = this._typedNumber(expected, typ, ctx) + offset;

    return {
      actualNum,
      expectedNum,
      actualDisp: this._typedDisp(actual, typ, ctx, actualNum),
      expectedDisp: this._expectedDisp(expected, typ, offset, ctx, expectedNum),
      label: this._label(actual, ctx),
    };
  }

  _typedNumber(expr, typ, ctx) {
    if (typ === "date") {
      return this.xpath.number(`translate(${expr}, '-', '')`, ctx);
    }
    if (typ === "year") {
      return this.xpath.number(`substring(${expr}, 1, 4)`, ctx);
    }
    return this.xpath.number(expr, ctx);
  }

  _typedDisp(expr, typ, ctx, num) {
    if (typ === "date") {
      const vals = this.xpath.values(expr, ctx);
      return vals.length ? vals[0] : "(missing)";
    }
    if (typ === "year") {
      return String(Math.trunc(num));
    }
    return fmtNum(num);
  }

  _expectedDisp(expr, typ, offset, ctx, expectedNum) {
    let base;
    if (typ === "date" && !offset) {
      const vals = this.xpath.values(expr, ctx);
      base = vals.length ? vals[0] : "(missing)";
    } else if (typ === "year") {
      base = String(Math.trunc(expectedNum));
    } else {
      base = fmtNum(expectedNum);
    }
    if (offset) {
      const unit = typ === "year" ? " year" : "";
      const sign = offset < 0 ? "-" : "+";
      base += ` (${this._label(expr, ctx)}${unit} ${sign} ${Math.abs(offset)})`;
    }
    return base;
  }

  // -- message rendering ---------------------------------------------

  // Drop namespace prefixes so paths read like the spec (globe:X -> X).
  _stripNs(expr) {
    let result = String(expr);
    for (const prefix of Object.keys(this.namespaces)) {
      result = result.replaceAll(`${prefix}:`, "");
    }
    return result.trim();
  }

  // A short human label for an operand: the element it refers to.
  _label(expr, ctx) {
    const e = String(expr).trim();
    if (e === ".") {
      return this.xpath.string("local-name(.)", ctx);
    }
    let step = this._stripNs(e).split("/").pop();
    step = step.split("::").pop().split("[")[0];
    // Aggregate/arithmetic operands (e.g. `sum(.../Total)`) leave a trailing
    // paren on the last step; strip wrapping parens so the label stays clean.
    return step.trim().replace(/^\(+|\)+$/g, "");
  }

  // Render an operand's value for a message: number, 'string', or (missing).
  _valueStr(expr, ctx) {
    const vals = this.xpath.values(expr, ctx);
    if (vals.length === 0) {
      return "(missing)";
    }
    const number = this.xpath.number(expr, ctx);
    if (!Number.isNaN(number)) {
      return fmtNum(number);
    }
    return `'${vals[0]}'`;
  }
}

function firstDuplicate(values) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      return value;
    }
    seen.add(value);
  }
  return null;
}

// round() to 4 decimals, matching the reference interpreter's rounding tolerance.
function round4(number) {
  return Math.round(number * 1e4) / 1e4;
}

// Compact number formatting: 115.0 -> "115", 0.875 -> "0.875", max 4 decimals.
function fmtNum(number) {
  return number.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}
