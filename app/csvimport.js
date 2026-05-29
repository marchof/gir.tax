function parseCsvRow(line) {
  const cols = line.split(";");
  if (cols.length < 5) {
    throw new Error(`Not enough columns in this line: ${line}`);
  }

  return {
    id: cols[0],
    parentId: cols[1],
    namespace: cols[2],
    type: cols[3],
    name: cols[4],
    value: cols.length > 5 ? cols[5] : "",
  };
}

function parseRows(csvText) {
  return csvText
    .split(/\r?\n/)
    .slice(1) // skip header
    .map(line => line.trim())
    .filter(Boolean)
    .map(parseCsvRow);
}

export function csvToXml(csvText) {
  const rows = parseRows(csvText);
  const xmlDocument = document.implementation.createDocument(null, "", null);
  const nodes = new Map();
  nodes.set("", xmlDocument);

  for (const row of rows) {
    const parent = nodes.get(row.parentId);
    if (!parent) {
      throw new Error(`Unknown parent id: ${row.parentId}`);
    }

    let node;

    if (row.type === "Element") {
      const namespace = row.namespace || null;
      const element = xmlDocument.createElementNS(namespace, row.name);
      parent.appendChild(element);
      node = element;
    } else if (row.type === "Attribute") {
      if (parent.nodeType !== Node.ELEMENT_NODE) {
        throw new Error(`Parent for attribute ${row.id} must be an element`);
      }
      const attribute = xmlDocument.createAttribute(row.name);
      parent.attributes.setNamedItem(attribute);
      node = attribute;
    } else {
      throw new Error(`Unsupported row type: ${row.type}`);
    }

    node.textContent = row.value;

    if (nodes.has(row.id)) {
      throw new Error(`Duplicate id: ${row.id}`);
    }

    nodes.set(row.id, node);
  }

  return new XMLSerializer().serializeToString(xmlDocument);
}

export function looksLikeCsvFile(file) {
  const name = file?.name?.toLowerCase() || "";
  const type = file?.type?.toLowerCase() || "";
  return name.endsWith(".csv") || type.includes("csv");
}

export function toXmlFileName(fileName) {
  if (!fileName) {
    return "input.xml";
  }

  if (fileName.toLowerCase().endsWith(".csv")) {
    return `${fileName.slice(0, -4)}.xml`;
  }

  return `${fileName}.xml`;
}
