// XPath 1.0 conformance contract for the rule-evaluator's xpath adapter.
//
// app/ruleeval.js assumes its injected adapter obeys XPath 1.0 semantics. The
// parity harness runs over a *different* XPath engine than the browser (the npm
// `xpath` package vs. the DOM's document.evaluate), so these checks pin the
// exact behaviours ruleeval.js relies on — chiefly the number()/NaN coercion
// the `xpath` package gets wrong and the Node adapter patches. They are
// engine-agnostic: they touch only the five adapter primitives, so the same
// checks can verify the browser adapter too (the fixture uses the real `globe`
// namespace, which both adapters resolve).

const GLOBE_NS = "urn:oecd:ties:globe:v2";

export const CONFORMANCE_XML = `<globe:Root xmlns:globe="${GLOBE_NS}">
  <globe:Int>42</globe:Int>
  <globe:Zero>0</globe:Zero>
  <globe:Empty/>
  <globe:Text>abc</globe:Text>
  <globe:Date>2023-04-05</globe:Date>
  <globe:Item>first</globe:Item>
  <globe:Item>second</globe:Item>
</globe:Root>`;

// A stand-in so NaN can be compared by value equality (NaN !== NaN otherwise).
const NAN = "NaN";

// Return the contract as a list of named checks against context node `ctx`,
// each carrying the adapter's `actual` result and the spec-required `expected`.
// The caller asserts every `actual` deep-equals its `expected`.
export function xpathConformanceChecks(xp, ctx) {
  const num = (expr) => {
    const value = xp.number(expr, ctx);
    return Number.isNaN(value) ? NAN : value;
  };

  return [
    { name: "number() of a numeric node -> the number", expected: 42, actual: num("globe:Int") },
    { name: "number() of a '0' node -> 0 (not NaN)", expected: 0, actual: num("globe:Zero") },
    { name: "number() of an empty node -> NaN", expected: NAN, actual: num("globe:Empty") },
    { name: "number() of a non-numeric node -> NaN", expected: NAN, actual: num("globe:Text") },
    { name: "number() of an empty node-set -> NaN", expected: NAN, actual: num("globe:Missing") },
    { name: "boolean() of a non-empty node-set -> true", expected: true, actual: xp.boolean("globe:Int", ctx) },
    { name: "boolean() of an empty node-set -> false", expected: false, actual: xp.boolean("globe:Missing", ctx) },
    { name: "values() of a node-set -> each node's string, in order", expected: ["first", "second"], actual: xp.values("globe:Item", ctx) },
    { name: "values() of a string literal -> the literal", expected: ["lit"], actual: xp.values("'lit'", ctx) },
    { name: "string() of a multi-node set -> the first node's value", expected: "first", actual: xp.string("globe:Item", ctx) },
    { name: "string(local-name()) -> local name without prefix", expected: "Int", actual: xp.string("local-name(globe:Int)", ctx) },
    { name: "translate() strips dashes for date compare", expected: 20230405, actual: num("translate(globe:Date, '-', '')") },
    { name: "substring() takes the leading year", expected: 2023, actual: num("substring(globe:Date, 1, 4)") },
  ];
}
