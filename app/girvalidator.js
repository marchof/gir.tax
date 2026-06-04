import { GIRNAMESPACES, GIRRULES } from "./girrules.js";

function evaluateNodes(xmlDocument, contextNode, expression, namespaceResolver) {
  const result = xmlDocument.evaluate(
    expression,
    contextNode,
    namespaceResolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null,
  );
  const nodes = [];
  for (let i = 0; i < result.snapshotLength; i += 1) {
    nodes.push(result.snapshotItem(i));
  }
  return nodes;
}

function evaluateBoolean(xmlDocument, contextNode, expression, namespaceResolver) {
  return xmlDocument.evaluate(
    expression,
    contextNode,
    namespaceResolver,
    XPathResult.BOOLEAN_TYPE,
    null,
  ).booleanValue;
}

function extractNearestDocRefId(xmlDocument, contextNode) {
  const expr = "string((ancestor-or-self::*[local-name()='DocSpec'][1]/*[local-name()='DocRefId'])[1])";
  const value = xmlDocument.evaluate(expr, contextNode, null, XPathResult.STRING_TYPE, null).stringValue;
  return value ? value.trim() : "";
}

function elementSegment(node) {
  const name = node.localName;
  const parent = node.parentNode;

  if (!parent || parent.nodeType !== Node.ELEMENT_NODE) {
    return `${name}[1]`;
  }

  const siblings = Array.from(parent.childNodes).filter(sibling => (
    sibling.nodeType === Node.ELEMENT_NODE
    && sibling.localName === node.localName
    && sibling.namespaceURI === node.namespaceURI
  ));

  const index = siblings.indexOf(node) + 1;
  return `${name}[${index}]`;
}

function nodeXPath(node) {
  if (!node) {
    return "";
  }

  if (node.nodeType === Node.ATTRIBUTE_NODE) {
    const ownerPath = nodeXPath(node.ownerElement);
    return `${ownerPath}/@${node.localName}`;
  }

  if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
    const parent = node.parentNode;
    const parentPath = nodeXPath(parent);
    const textSiblings = Array.from(parent?.childNodes || []).filter(sibling => (
      sibling.nodeType === Node.TEXT_NODE || sibling.nodeType === Node.CDATA_SECTION_NODE
    ));
    const index = textSiblings.indexOf(node) + 1;
    return `${parentPath}/text()[${index}]`;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const segments = [];
  let current = node;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    segments.unshift(elementSegment(current));
    current = current.parentNode;
  }

  return `/${segments.join("/")}`;
}

export function validateGirRules(xmlDocument, statusMessage) {
  if (!xmlDocument || !statusMessage) {
    return;
  }

  const namespaceResolver = prefix => GIRNAMESPACES[prefix];

  for (const rule of GIRRULES) {
    const ruleCode = rule.number;
    const ruleMessage = rule.description;
    const targets = rule.targets;

    for (const target of targets) {
      let targetNodes;
      try {
        targetNodes = evaluateNodes(xmlDocument, xmlDocument, target, namespaceResolver);
      } catch (error) {
        statusMessage.addValidationError({
          scope: "file",
          code: ruleCode,
          details: `Invalid target XPath for rule ${ruleCode}: ${error.message}`,
        });
        continue;
      }

      for (const targetNode of targetNodes) {
        let passed;
        try {
          passed = evaluateBoolean(xmlDocument, targetNode, rule.test, namespaceResolver);
        } catch (error) {
          statusMessage.addValidationError({
            scope: "file",
            code: ruleCode,
            details: `Invalid test XPath for rule ${ruleCode}: ${error.message}`,
          });
          continue;
        }

        if (passed) {
          continue;
        }

        const docRefId = extractNearestDocRefId(xmlDocument, targetNode);
        const matchedPath = nodeXPath(targetNode) || target;
        statusMessage.addValidationError({
          scope: "record",
          code: ruleCode,
          details: ruleMessage,
          docRefIds: docRefId ? [docRefId] : [],
          fieldPaths: [matchedPath],
        });
      }
    }
  }
}