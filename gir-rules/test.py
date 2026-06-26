import unittest
from pathlib import Path
from parameterized import parameterized

from lxml import etree
import yaml

from rule_eval import ASSERTION_OPS, RuleEvaluator, rule_is_active

REPO_ROOT_DIR = Path(__file__).resolve().parents[1]
EXAMPLES_DIR = REPO_ROOT_DIR / "examples"
TESTDOCS_DIR = REPO_ROOT_DIR / "gir-rules" / "testdocs"
SCHEMA_FILE = REPO_ROOT_DIR / "schemas" / "gir" / "globexml_v1.0.xsd"
RULES_FILE = REPO_ROOT_DIR / "gir-rules" / "rules.yaml"

with RULES_FILE.open("r", encoding="utf-8") as f:
    RULES = yaml.safe_load(f)

COMPLETE_DOCS = [etree.parse(str(f)) for f in TESTDOCS_DIR.glob("complete-*.xml")]
EXAMPLES_DOCS = [etree.parse(str(f)) for f in EXAMPLES_DIR.glob("globe-positive-*.xml")]

NAMESPACES = RULES['xmlnamespaces']

EVALUATOR = RuleEvaluator(NAMESPACES)


class TestReferenceDocuments(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.all_paths = TestReferenceDocuments.extract_all_paths(COMPLETE_DOCS + EXAMPLES_DOCS)

    @parameterized.expand([(xml,) for xml in COMPLETE_DOCS + EXAMPLES_DOCS])
    def test_complete_reference_doc_has_valid_globexml_schema(self, xml):
        xml_schema = etree.XMLSchema(etree.parse(str(SCHEMA_FILE)))
        is_valid = xml_schema.validate(xml)
        error_log = "\n".join(str(err) for err in xml_schema.error_log)
        self.assertTrue(is_valid, error_log)

    @parameterized.expand([(xmlfile,) for xmlfile in TESTDOCS_DIR.glob("*/*.xml")])
    def test_fragment_reference_doc_should_only_contain_known_paths(self, xmlfile):
        paths = TestReferenceDocuments.extract_all_paths([etree.parse(str(xmlfile))])
        unknown_paths = paths - self.all_paths
        self.assertFalse(unknown_paths, f"Unknown paths found in {xmlfile}")
    
    @staticmethod
    def extract_all_paths(docs):

        def iterate(element, path, result):
            path = path + (element.tag,)
            result.add(path)
            for child in element:
                if isinstance(child.tag, str):
                    iterate(child, path, result)

        result = set()
        for doc in docs:
            iterate(doc.getroot(), (), result)
        return result


class TestRuleSyntax(unittest.TestCase):

    @parameterized.expand([(rule["number"], rule) for rule in RULES["rules"]])
    def test_rule_has_at_most_one_operator(self, number, rule):
        # The evaluator picks the first operator in ASSERTION_OPS order and
        # silently ignores any others, so a rule with two operator keys would
        # have one of its checks dropped. Catch that at build time here.
        operators = [op for op in ASSERTION_OPS if op in rule]
        self.assertLessEqual(
            len(operators), 1,
            f"Rule {number} has multiple assertion operators: {operators}",
        )

    @parameterized.expand([(rule["number"], rule) for rule in RULES["rules"]])
    def test_active_rule_has_an_operator(self, number, rule):
        # `disabled: true` is the single switch that excludes a rule. Any rule
        # that is not disabled must carry exactly one operator so it can be
        # evaluated and code-generated; a rule that cannot be a local per-element
        # check must be marked `disabled: true` (with a user-facing
        # implementation_notes) instead of being left operator-less.
        if rule_is_active(rule):
            operators = [op for op in ASSERTION_OPS if op in rule]
            self.assertEqual(
                len(operators), 1,
                f"Active rule {number} must carry exactly one operator, or be "
                f"marked disabled: true; found {operators}",
            )


class TestRules(unittest.TestCase):

    @parameterized.expand([ (rule["number"], target) for rule in RULES["rules"] if rule_is_active(rule) for target in rule["targets"] ])
    def test_target_path_does_exist(self, number, target):
        for doc in COMPLETE_DOCS:
            if doc.xpath(target, namespaces=NAMESPACES):
                return
        self.fail(f"Rule {number} target xpath did not match any nodes in the complete xmls: {target}")

    @parameterized.expand([ (rule["number"], rule) for rule in RULES["rules"] ])
    def test_rules_on_complete_docs_and_examples(self, number, rule):
        if not rule_is_active(rule):
            self.skipTest(f"Rule {number} is disabled")
        for target in rule["targets"]:
            for doc in COMPLETE_DOCS + EXAMPLES_DOCS:
                for element in doc.xpath(target, namespaces=NAMESPACES):
                    self.assertTrue(
                        EVALUATOR.evaluate(rule, element),
                        f"Rule {number} test failed for target {target} in file {doc.getroot().base}",
                    )

    def _parse_test_doc(self, xml_file):
        try:
            return etree.parse(str(xml_file))
        except etree.XMLSyntaxError as e:
            self.fail(f"Failed to parse {xml_file.name}: {e}")

    @parameterized.expand([
        (rule["number"], rule, xml_file.name in rule.get("target_does_not_exist_in_test_files", []), xml_file)
        for rule in RULES["rules"]
        if rule_is_active(rule) and rule.get("targets")
        for xml_file in sorted((TESTDOCS_DIR / str(rule["number"])).glob("ok-*.xml"))
    ])
    def test_positive_rules_on_dedicated_test_files(self, number, rule, skipHitCheck, xml_file):
        # A positive (ok-*) document is valid, so the rule must hold for *every*
        # matched target node.
        doc = self._parse_test_doc(xml_file)

        found_elements = skipHitCheck
        for target in rule["targets"]:
            for element in doc.xpath(target, namespaces=NAMESPACES):
                found_elements = True
                self.assertTrue(
                    EVALUATOR.evaluate(rule, element),
                    f"Rule {number} failed for target {target} in positive test {xml_file.name}",
                )

        self.assertTrue(found_elements, f"No elements matched in {xml_file.name}")

    @parameterized.expand([
        (rule["number"], rule, xml_file.name in rule.get("target_does_not_exist_in_test_files", []), xml_file)
        for rule in RULES["rules"]
        if rule_is_active(rule) and rule.get("targets")
        for xml_file in sorted((TESTDOCS_DIR / str(rule["number"])).glob("nok-*.xml"))
    ])
    def test_negative_rules_on_dedicated_test_files(self, number, rule, skipHitCheck, xml_file):
        # A negative (nok-*) document is invalid, so the rule must fail for at
        # least one matched target node (not necessarily all of them). The exact
        # failure message(s) are pinned by a mandatory sibling nok-NN-error.txt
        # (one line per failing target, in document order) so wording changes
        # are deliberate and a fixture can't silently stop being checked.
        doc = self._parse_test_doc(xml_file)

        found_elements = skipHitCheck
        messages = []
        for target in rule["targets"]:
            for element in doc.xpath(target, namespaces=NAMESPACES):
                found_elements = True
                result = EVALUATOR.evaluate(rule, element)
                if not result.ok:
                    messages.append(result.message)

        self.assertTrue(found_elements, f"No elements matched in {xml_file.name}")
        self.assertTrue(
            messages,
            f"Rule {number} unexpectedly passed for all targets in negative test {xml_file.name}",
        )

        error_file = xml_file.with_name(f"{xml_file.stem}-error.txt")
        self.assertTrue(
            error_file.exists(),
            f"Missing expected-error sidecar {error_file.name} for negative test {xml_file.name}",
        )
        actual = "\n".join(messages)
        expected = error_file.read_text(encoding="utf-8").strip()
        self.assertEqual(
            actual, expected,
            f"Rule {number} error message mismatch for {xml_file.name}",
        )

if __name__ == "__main__":
    unittest.main()
