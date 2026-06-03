import unittest
from pathlib import Path

from lxml import etree

REPO_ROOT_DIR = Path(__file__).resolve().parents[2]
REFDOCS_DIR = REPO_ROOT_DIR / "gir-validation" / "test" / "refdocs"
SCHEMA_FILE = REPO_ROOT_DIR / "schemas" / "gir" / "globexml_v1.0.xsd"

class TestGirXmlValidation(unittest.TestCase):

	def test_positive_xml_is_valid_against_globexml_schema(self):

		xml_schema = etree.XMLSchema(etree.parse(str(SCHEMA_FILE)))
		xml_doc = etree.parse(str(REFDOCS_DIR / "positive.xml"))

		is_valid = xml_schema.validate(xml_doc)
		error_log = "\n".join(str(err) for err in xml_schema.error_log)
		self.assertTrue(is_valid, f"XML failed schema validation:\n{error_log}")


if __name__ == "__main__":
	unittest.main()
