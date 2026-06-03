import unittest
from pathlib import Path
from parameterized import parameterized

from lxml import etree
import yaml

REPO_ROOT_DIR = Path(__file__).resolve().parents[2]
REFDOCS_DIR = REPO_ROOT_DIR / "gir-validation" / "test" / "refdocs"
SCHEMA_FILE = REPO_ROOT_DIR / "schemas" / "gir" / "globexml_v1.0.xsd"
RULES_FILE = REPO_ROOT_DIR / "gir-validation" / "rules.yaml"

with RULES_FILE.open("r", encoding="utf-8") as f:
    RULES = yaml.safe_load(f)

POSITIVE_DOC = etree.parse(str(REFDOCS_DIR / "positive.xml"))
NAMESPACES = RULES['xmlnamespaces']



class TestGirXmlValidation(unittest.TestCase):

    def test_positive_xml_is_valid_against_globexml_schema(self):
        xml_schema = etree.XMLSchema(etree.parse(str(SCHEMA_FILE)))
        is_valid = xml_schema.validate(POSITIVE_DOC)
        error_log = "\n".join(str(err) for err in xml_schema.error_log)
        self.assertTrue(is_valid, f"XML failed schema validation:\n{error_log}")

    @parameterized.expand([
        (rule["number"], target)
        for rule in RULES["rules"]
        for target in rule.get("targets", [])
    ])
    def test_target_does_exist(self, number, target):
        if ":" not in target:
            self.skipTest(f"Rule {number} target xpath is marked as IGNORE: {target}")
        matches = POSITIVE_DOC.xpath(target, namespaces=NAMESPACES)
        self.assertTrue(matches, f"Rule {number} target xpath did not match any nodes in positive.xml: {target}")

    @parameterized.expand([
        (rule["number"], rule.get("test"), rule["targets"])
        for rule in RULES["rules"]
    ])
    def test_rules_succeed(self, number, test, targets):
        if not test:
            self.skipTest(f"Rule {number} has no test defined")
        for target in targets:
            for element in POSITIVE_DOC.xpath(target, namespaces=NAMESPACES):
                serialized_element = etree.tostring(element, encoding="unicode")
                self.assertTrue(
                    element.xpath(test, namespaces=NAMESPACES),
                    f"Rule {number} test failed for element:\n{serialized_element}",
                )

    @parameterized.expand([
        (rule["number"], rule.get("test"), rule["targets"], xml_file)
        for rule in RULES["rules"]
        if rule.get("test") and rule.get("targets")
        for xml_file in sorted((REFDOCS_DIR / str(rule["number"])).glob("*.xml"))
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
