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

print(NAMESPACES)


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
        matches = POSITIVE_DOC.xpath(target, namespaces=NAMESPACES)
        self.assertTrue(matches, f"Rule {number} target xpath did not match any nodes in positive.xml: {target}")

if __name__ == "__main__":
    unittest.main()
