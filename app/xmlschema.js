import { validateXML } from "xmllint-wasm";

function parseXml(text, fileName) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error(`Failed to parse schema ${fileName}: ${parserError.textContent || "Unknown XML parser error"}`);
  }
  return doc;
}

function resolveSchemaLocation(fileName, schemaLocation) {
  return new URL(schemaLocation, `https://schema.local/${fileName}`).pathname.slice(1);
}

async function fetchSchemaText(basePath, fileName) {
  const response = await fetch(`${basePath}/${fileName}`);
  if (!response.ok) {
    throw new Error(`Failed to load schema ${fileName} (${response.status})`);
  }
  return response.text();
}

function collectSchemaLocations(schemaDoc) {
  const locations = [];
  const nodes = schemaDoc.getElementsByTagName("*");

  for (const node of nodes) {
    if (["import", "include", "redefine"].includes(node.localName)) {
      const schemaLocation = node.getAttribute("schemaLocation");
      if (schemaLocation) {
        locations.push(schemaLocation);
      }
    }
  }

  return locations;
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

export class XMLSchema {
  constructor(basePath, mainSchema) {
    this.basePath = basePath;
    this.mainSchema = mainSchema;
    this.schemaBundlePromise = null;
    this.schemaMetadataPromise = null;
  }

  async #loadSchemaGraph(entryFile = this.mainSchema) {
    const loaded = new Map();

    const load = async fileName => {
      if (loaded.has(fileName)) {
        return loaded.get(fileName);
      }

      const schemaPromise = (async () => {
        const contents = await fetchSchemaText(this.basePath, fileName);
        const schemaDoc = parseXml(contents, fileName);

        for (const schemaLocation of collectSchemaLocations(schemaDoc)) {
          const resolvedLocation = resolveSchemaLocation(fileName, schemaLocation);
          await load(resolvedLocation);
        }

        return { fileName, contents, schemaDoc };
      })();

      loaded.set(fileName, schemaPromise);
      return schemaPromise;
    };

    await load(entryFile);
    return Promise.all(loaded.values());
  }

  async #getSchemaBundle() {
    if (!this.schemaBundlePromise) {
      this.schemaBundlePromise = this.#loadSchemaGraph();
    }

    return this.schemaBundlePromise;
  }

  async getSchemaMetadata() {
    if (!this.schemaMetadataPromise) {
      this.schemaMetadataPromise = this.#getSchemaBundle().then(extractSchemaMetadata);
    }

    return this.schemaMetadataPromise;
  }

  async validate(xmlText, fileName = "input.xml") {
    const schemas = await this.#getSchemaBundle();
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
}