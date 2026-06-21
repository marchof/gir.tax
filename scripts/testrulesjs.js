// Parity harness: proves the JavaScript rule interpreter (app/ruleeval.js)
// reproduces the Python reference (gir-rules/rule_eval.py) exactly.
//
// It evaluates the *generated* app/girrules.js (so scripts/generaterulesjs.js is
// covered too) over the same fixtures the Python suite pins, mirroring its three
// behavioural suites:
//   - positive (ok-*.xml): the rule holds for every matched target;
//   - negative (nok-*.xml): the rule fails for at least one matched target, and
//     the joined messages equal the nok-*-error.txt sidecar verbatim;
//   - complete docs + examples: every rule passes on every matched node.
//
// Run with: node --test scripts/testrulesjs.js (the npm `test` script
// regenerates app/girrules.js first).

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { parse } from "yaml";
import xpath from "xpath";
import { DOMParser } from "@xmldom/xmldom";

import { GIRNAMESPACES, GIRRULES } from "../app/girrules.js";
import { RuleEvaluator } from "../app/ruleeval.js";
import { CONFORMANCE_XML, xpathConformanceChecks } from "./xpathconformance.js";

const repoRoot = path.resolve(import.meta.dirname, "..");
const testdocsDir = path.join(repoRoot, "gir-rules", "testdocs");
const examplesDir = path.join(repoRoot, "examples");
const rulesYamlPath = path.join(repoRoot, "gir-rules", "rules.yaml");

const parser = new DOMParser();
const parseXml = (file) => parser.parseFromString(readFileSync(file, "utf8"), "text/xml");

// Test-only metadata that is intentionally not shipped in girrules.js: fixtures
// where none of the targets are expected to match (an absence scenario).
const rulesYaml = parse(readFileSync(rulesYamlPath, "utf8"));
const noTargetFiles = new Map();
for (const rule of rulesYaml.rules) {
  if (rule.target_does_not_exist_in_test_files) {
    noTargetFiles.set(rule.number, new Set(rule.target_does_not_exist_in_test_files));
  }
}
const skipsHitCheck = (number, fileName) => noTargetFiles.get(number)?.has(fileName) ?? false;

// The five-method xpath adapter over the `xpath` package, matching the browser
// adapter's contract. The package returns 0 (not NaN) for number() of an
// empty-string node value / empty node-set, unlike spec-compliant XPath and
// lxml; this corrects that surgically so _eq and value rendering stay faithful.
const makeNodeXPath = () => {
  const select = xpath.useNamespaces(GIRNAMESPACES);
  const stringValue = (expr, ctx) => select(`string(${expr})`, ctx);
  return {
    nodes(expr, ctx) {
      const result = select(String(expr), ctx);
      return Array.isArray(result) ? result : [];
    },
    number(expr, ctx) {
      const value = select(`number(${expr})`, ctx);
      if (value === 0 && stringValue(expr, ctx).trim() === "") {
        return NaN;
      }
      return value;
    },
    boolean(expr, ctx) {
      return select(`boolean(${expr})`, ctx);
    },
    string(expr, ctx) {
      return stringValue(expr, ctx);
    },
    values(expr, ctx) {
      const result = select(String(expr), ctx);
      if (Array.isArray(result)) {
        return result.map((node) => select("string(.)", node));
      }
      return [stringValue(expr, ctx)];
    },
  };
};

const xp = makeNodeXPath();
const evaluator = new RuleEvaluator(xp, GIRNAMESPACES);

const loadDocs = (dir, pattern) => readdirSync(dir)
  .filter((file) => pattern.test(file))
  .sort()
  .map((file) => ({ name: file, doc: parseXml(path.join(dir, file)) }));

const corpusDocs = [
  ...loadDocs(testdocsDir, /^complete-.*\.xml$/),
  ...loadDocs(examplesDir, /^globe-positive-.*\.xml$/),
];

const fixtureFiles = (ruleDir, prefix) => readdirSync(ruleDir)
  .filter((file) => new RegExp(`^${prefix}-.*\\.xml$`).test(file))
  .sort();

// Pin the XPath 1.0 behaviours ruleeval.js relies on, so a non-spec-compliant
// engine (or a regression in the Node adapter's NaN patch) is caught directly
// rather than as a confusing rule failure.
test("xpath adapter conformance (XPath 1.0 contract)", () => {
  const ctx = parser.parseFromString(CONFORMANCE_XML, "text/xml").documentElement;
  for (const check of xpathConformanceChecks(xp, ctx)) {
    assert.deepEqual(check.actual, check.expected, check.name);
  }
});

for (const rule of GIRRULES) {
  const ruleDir = path.join(testdocsDir, String(rule.number));

  test(`rule ${rule.number}: holds on complete docs and examples`, () => {
    for (const target of rule.targets) {
      for (const { name, doc } of corpusDocs) {
        for (const element of xp.nodes(target, doc)) {
          const result = evaluator.evaluate(rule, element);
          assert.ok(result.ok, `failed on ${name} (target ${target}): ${result.message}`);
        }
      }
    }
  });

  if (!existsSync(ruleDir)) {
    continue;
  }

  for (const fileName of fixtureFiles(ruleDir, "ok")) {
    test(`rule ${rule.number}: positive ${fileName}`, () => {
      const doc = parseXml(path.join(ruleDir, fileName));
      let found = skipsHitCheck(rule.number, fileName);
      for (const target of rule.targets) {
        for (const element of xp.nodes(target, doc)) {
          found = true;
          const result = evaluator.evaluate(rule, element);
          assert.ok(result.ok, `failed for target ${target}: ${result.message}`);
        }
      }
      assert.ok(found, `no elements matched in ${fileName}`);
    });
  }

  for (const fileName of fixtureFiles(ruleDir, "nok")) {
    test(`rule ${rule.number}: negative ${fileName}`, () => {
      const doc = parseXml(path.join(ruleDir, fileName));
      let found = skipsHitCheck(rule.number, fileName);
      const messages = [];
      for (const target of rule.targets) {
        for (const element of xp.nodes(target, doc)) {
          found = true;
          const result = evaluator.evaluate(rule, element);
          if (!result.ok) {
            messages.push(result.message);
          }
        }
      }
      assert.ok(found, `no elements matched in ${fileName}`);
      assert.ok(messages.length > 0, `unexpectedly passed for all targets in ${fileName}`);

      const errorFile = path.join(ruleDir, fileName.replace(/\.xml$/, "-error.txt"));
      assert.ok(existsSync(errorFile), `missing expected-error sidecar for ${fileName}`);
      const expected = readFileSync(errorFile, "utf8").trim();
      assert.equal(messages.join("\n"), expected, `error message mismatch for ${fileName}`);
    });
  }
}
