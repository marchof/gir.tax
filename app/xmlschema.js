import { validateXML } from "xmllint-wasm";

const SCHEMA_BASE_PATH = "schemas";
const SCHEMA_ENTRY_FILE = "globexml_v1.0.xsd";

let schemaBundlePromise;
let schemaMetadataPromise;

function parseXml(text, fileName) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error(`Failed to parse schema ${fileName}: ${parserError.textContent || "Unknown XML parser error"}`);
  }
  return doc;
}

async function fetchSchemaText(fileName) {
  const response = await fetch(`${SCHEMA_BASE_PATH}/${fileName}`);
  if (!response.ok) {
    throw new Error(`Failed to load schema ${fileName} (${response.status})`);
  }
  return response.text();
}

function collectSchemaLocations(schemaDoc) {
  const locations = [];
  const nodes = schemaDoc.getElementsByTagName("*");

  for (const node of nodes) {
    if (!node.localName || !["import", "include", "redefine"].includes(node.localName)) {
      continue;
    }

    const schemaLocation = node.getAttribute("schemaLocation");
    if (schemaLocation) {
      locations.push(schemaLocation);
    }
  }

  return locations;
}

async function loadSchemaGraph(entryFile) {
  const loaded = new Map();

  async function load(fileName) {
    if (loaded.has(fileName)) {
      return;
    }

    const contents = await fetchSchemaText(fileName);
    const schemaDoc = parseXml(contents, fileName);
    loaded.set(fileName, { fileName, contents, schemaDoc });

    const schemaLocations = collectSchemaLocations(schemaDoc);
    for (const schemaLocation of schemaLocations) {
      await load(schemaLocation);
    }
  }

  await load(entryFile);
  return [...loaded.values()];
}

function extractDocumentationNodeText(node) {
  for (const child of node.children) {
    if (child.localName !== "annotation") {
      continue;
    }

    for (const annotationChild of child.children) {
      if (annotationChild.localName !== "documentation") {
        continue;
      }

      const text = annotationChild.textContent?.trim();
      if (text) {
        return text;
      }
    }
  }

  return "";
}

function extractSchemaMetadata(schemaItems) {
  const enumDescriptions = new Map();
  const tagDescriptions = new Map();

  for (const { schemaDoc } of schemaItems) {
    const nodes = schemaDoc.getElementsByTagName("*");

    for (const node of nodes) {
      if (node.localName === "enumeration") {
        const value = node.getAttribute("value");
        const description = extractDocumentationNodeText(node);
        if (value && description && !enumDescriptions.has(value)) {
          enumDescriptions.set(value, description);
        }
        continue;
      }

      if (node.localName === "element") {
        const name = node.getAttribute("name");
        const description = extractDocumentationNodeText(node);
        if (name && description && !tagDescriptions.has(name)) {
          tagDescriptions.set(name, description);
        }
      }
    }
  }

  return { enumDescriptions, tagDescriptions };
}

async function getSchemaBundle() {
  if (!schemaBundlePromise) {
    schemaBundlePromise = loadSchemaGraph(SCHEMA_ENTRY_FILE);
  }

  return schemaBundlePromise;
}

export async function getSchemaMetadata() {
  if (!schemaMetadataPromise) {
    schemaMetadataPromise = getSchemaBundle().then(extractSchemaMetadata);
  }

  return schemaMetadataPromise;
}

export async function validate(xmlText, fileName = "input.xml") {
  const schemas = await getSchemaBundle();
  const [mainSchema, ...preloadSchemas] = schemas;

  return validateXML({
    xml: [{ fileName, contents: xmlText }],
    schema: [{ fileName: mainSchema.fileName, contents: mainSchema.contents }],
    preload: preloadSchemas.map(schema => ({
      fileName: schema.fileName,
      contents: schema.contents,
    })),
  });
}