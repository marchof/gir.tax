// Rewrites a GIR document so that the exported XML uses fixed namespace
// prefixes, all declared on the root element. The tax authorities' tooling
// expects exactly these prefixes (as in the OECD examples), whatever prefixes
// (default namespace, ns1, ...) the input used. The output is pretty-printed.
const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";
const EXPORT_PREFIXES = {
  "urn:oecd:ties:globe:v2": "globe",
  "urn:oecd:ties:globestf:v5": "stf",
};
const INDENT = "  ";

function prefixedName(node) {
  const prefix = EXPORT_PREFIXES[node.namespaceURI];
  return prefix ? `${prefix}:${node.localName}` : node.nodeName;
}

function isWhitespaceText(node) {
  return node.nodeType === Node.TEXT_NODE && node.data.trim() === "";
}

// Elements with child elements and no other text get their children indented,
// one per line. Everything else (text values, mixed content) is kept as is.
function isIndentable(source) {
  const children = Array.from(source.childNodes);
  return children.some(child => child.nodeType === Node.ELEMENT_NODE)
    && children.every(child => child.nodeType !== Node.TEXT_NODE || isWhitespaceText(child))
    && children.every(child => child.nodeType !== Node.CDATA_SECTION_NODE);
}

function copyElement(source, target, isRoot, depth) {
  const element = target.createElementNS(source.namespaceURI, prefixedName(source));

  if (isRoot) {
    for (const [uri, prefix] of Object.entries(EXPORT_PREFIXES)) {
      element.setAttributeNS(XMLNS_NAMESPACE, `xmlns:${prefix}`, uri);
    }
  }

  for (const attribute of Array.from(source.attributes)) {
    // Drop the input's own declarations of the fixed namespaces; the root
    // element declares them with the fixed prefixes.
    if (attribute.namespaceURI === XMLNS_NAMESPACE && EXPORT_PREFIXES[attribute.value]) {
      continue;
    }
    element.setAttributeNS(attribute.namespaceURI, prefixedName(attribute), attribute.value);
  }

  if (isIndentable(source)) {
    const childIndent = `\n${INDENT.repeat(depth + 1)}`;
    for (const child of Array.from(source.childNodes).filter(child => !isWhitespaceText(child))) {
      element.appendChild(target.createTextNode(childIndent));
      element.appendChild(copyNode(child, target, false, depth + 1));
    }
    element.appendChild(target.createTextNode(`\n${INDENT.repeat(depth)}`));
  } else {
    for (const child of Array.from(source.childNodes)) {
      element.appendChild(copyNode(child, target, false, depth + 1));
    }
  }

  return element;
}

function copyNode(source, target, isRoot, depth) {
  if (source.nodeType === Node.ELEMENT_NODE) {
    return copyElement(source, target, isRoot, depth);
  }
  return target.importNode(source, false);
}

// Returns the export form of xmlText, or xmlText unchanged if it is not
// well-formed (there is nothing to rewrite then).
export function toExportXml(xmlText) {
  let source;
  try {
    source = new DOMParser().parseFromString(xmlText, "application/xml");
  } catch {
    return xmlText;
  }
  if (!source.documentElement || source.getElementsByTagName("parsererror").length > 0) {
    return xmlText;
  }

  const target = document.implementation.createDocument(null, "", null);
  const serializer = new XMLSerializer();
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
  for (const child of Array.from(source.childNodes)) {
    // The XML declaration is written first. Some parsers (not browsers) also
    // expose it, and the whitespace around it, as document-level nodes.
    const isXmlDeclaration = child.nodeType === Node.PROCESSING_INSTRUCTION_NODE && child.target === "xml";
    const skip = isXmlDeclaration || child.nodeType === Node.TEXT_NODE || child.nodeType === Node.DOCUMENT_TYPE_NODE;
    if (!skip) {
      lines.push(serializer.serializeToString(copyNode(child, target, child === source.documentElement, 0)));
    }
  }

  return `${lines.join("\n")}\n`;
}
