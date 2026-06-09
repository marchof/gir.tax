import unittest
from pathlib import Path
from parameterized import parameterized

from lxml import etree
import yaml

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


class TestRules(unittest.TestCase):

    @parameterized.expand([ (rule["number"], target) for rule in RULES["rules"] for target in rule["targets"] ])
    def test_target_path_does_exist(self, number, target):
        for doc in COMPLETE_DOCS:
            if doc.xpath(target, namespaces=NAMESPACES):
                return
        self.fail(f"Rule {number} target xpath did not match any nodes in the complete xmls: {target}")

    @parameterized.expand([ (rule["number"], rule.get("test"), rule["targets"]) for rule in RULES["rules"] ])
    def test_rules_on_complete_docs_and_examples(self, number, test, targets):
        if not test:
            self.skipTest(f"Rule {number} has no test defined")
        for target in targets:
            for doc in COMPLETE_DOCS + EXAMPLES_DOCS:
                for element in doc.xpath(target, namespaces=NAMESPACES):
                    self.assertTrue(
                        element.xpath(test, namespaces=NAMESPACES),
                        f"Rule {number} test failed for target {target} in file {doc.getroot().base}",
                    )

    @parameterized.expand([
        (rule["number"], rule.get("test"), rule["targets"], xml_file.name in rule.get("target_does_not_exist_in_test_files", []), xml_file)
        for rule in RULES["rules"]
        if rule.get("test") and rule.get("targets")
        for xml_file in sorted((TESTDOCS_DIR / str(rule["number"])).glob("*.xml"))
    ])
    def test_rules_on_dedicated_test_files(self, number, test, targets, skipHitCheck, xml_file):
        try:
            doc = etree.parse(str(xml_file))
        except etree.XMLSyntaxError as e:
            self.fail(f"Failed to parse {xml_file.name}: {e}")

        found_elements = skipHitCheck
        for target in targets:
            for element in doc.xpath(target, namespaces=NAMESPACES):
                found_elements = True
                test_result = bool(element.xpath(test, namespaces=NAMESPACES))

                if xml_file.name.startswith("ok-"): # positive test case
                    self.assertTrue(
                        test_result,
                        f"Rule {number} failed for target {target} in positive test {xml_file.name}",
                    )
                else:  # negative test case
                    self.assertFalse(
                        test_result,
                        f"Rule {number} unexpectedly passed for target {target} in negative test{xml_file.name}",
                    )

        self.assertTrue(found_elements, f"No elements matched in {xml_file.name} for target {target}")

if __name__ == "__main__":
    unittest.main()
