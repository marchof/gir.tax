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


class TestGirXmlValidation(unittest.TestCase):

    @parameterized.expand([
        (rule["number"], target)
        for rule in RULES["rules"]
        for target in rule.get("targets", [])
    ])
    def test_target_does_exist(self, number, target):
        for doc in COMPLETE_DOCS:
            if doc.xpath(target, namespaces=NAMESPACES):
                return
        self.fail(f"Rule {number} target xpath did not match any nodes in the complete xmls: {target}")

    @parameterized.expand([
        (rule["number"], rule.get("test"), rule["targets"])
        for rule in RULES["rules"]
    ])
    def test_rules_succeed_on_complete_docs_and_examples(self, number, test, targets):
        if not test:
            self.skipTest(f"Rule {number} has no test defined")
        for target in targets:
            for doc in COMPLETE_DOCS + EXAMPLES_DOCS:
                for element in doc.xpath(target, namespaces=NAMESPACES):
                    serialized_element = etree.tostring(element, encoding="unicode")
                    self.assertTrue(
                        element.xpath(test, namespaces=NAMESPACES),
                        f"Rule {number} test failed for element:\n{serialized_element}",
                    )

    @parameterized.expand([
        (rule["number"], rule.get("test"), rule["targets"], xml_file)
        for rule in RULES["rules"]
        if rule.get("test") and rule.get("targets")
        for xml_file in sorted((TESTDOCS_DIR / str(rule["number"])).glob("*.xml"))
        if (xml_file.name.startswith("ok-") or xml_file.name.startswith("nok-"))
    ])
    def test_rules_against_dedicated_test_files(self, number, test, targets, xml_file):
        """Evaluate rule test expressions against dedicated test XML files.
    
        Files named ok-*.xml should pass the test; nok-*.xml should fail.
        """
        try:
            doc = etree.parse(str(xml_file))
        except etree.XMLSyntaxError as e:
            self.fail(f"Failed to parse {xml_file.name}: {e}")

        is_positive = xml_file.name.startswith("ok-")
        is_negative = xml_file.name.startswith("nok-")

        found_elements = False
        for target in targets:
            for element in doc.xpath(target, namespaces=NAMESPACES):
                found_elements = True
                test_result = bool(element.xpath(test, namespaces=NAMESPACES))
                serialized = etree.tostring(element, encoding="unicode")

                if is_positive:
                    self.assertTrue(
                        test_result,
                        f"Rule {number} (ok-* test) failed for element in {xml_file.name}:\n{serialized}",
                    )
                else:  # is_negative
                    self.assertFalse(
                        test_result,
                        f"Rule {number} (nok-* test) unexpectedly passed for element in {xml_file.name}:\n{serialized}",
                    )

        if not found_elements:
            self.skipTest(f"No elements matched targets in {xml_file.name}")

if __name__ == "__main__":
    unittest.main()
