import { GIRNAMESPACES, GIRRULES } from "./girrules.js";
import { RuleEvaluator } from "./ruleeval.js";

// The five-method xpath adapter ruleeval.js expects, implemented over the DOM's
// document.evaluate and bound to one document + namespace resolver. Browsers'
// XPath is XPath 1.0 spec-compliant (e.g. number() of an empty value is NaN),
// which is the contract scripts/xpathconformance.js pins.
function makeBrowserXPathAdapter(xmlDocument, namespaceResolver) {
  const evaluate = (expr, ctx, resultType) => xmlDocument.evaluate(
    String(expr), ctx, namespaceResolver, resultType, null,
  );

  return {
    nodes(expr, ctx) {
      const snapshot = evaluate(expr, ctx, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE);
      const result = [];
      for (let i = 0; i < snapshot.snapshotLength; i += 1) {
        result.push(snapshot.snapshotItem(i));
      }
      return result;
    },
    number(expr, ctx) {
      return evaluate(`number(${expr})`, ctx, XPathResult.NUMBER_TYPE).numberValue;
    },
    boolean(expr, ctx) {
      return evaluate(expr, ctx, XPathResult.BOOLEAN_TYPE).booleanValue;
    },
    string(expr, ctx) {
      return evaluate(expr, ctx, XPathResult.STRING_TYPE).stringValue;
    },
    values(expr, ctx) {
      // A node-set yields each node's string value in document order; any other
      // result (string literal, number) yields its single XPath string value.
      const any = evaluate(expr, ctx, XPathResult.ANY_TYPE);
      const isNodeSet = any.resultType === XPathResult.UNORDERED_NODE_ITERATOR_TYPE
        || any.resultType === XPathResult.ORDERED_NODE_ITERATOR_TYPE;
      if (!isNodeSet) {
        return [evaluate(`string(${expr})`, ctx, XPathResult.STRING_TYPE).stringValue];
      }
      const snapshot = evaluate(expr, ctx, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE);
      const result = [];
      for (let i = 0; i < snapshot.snapshotLength; i += 1) {
        result.push(snapshot.snapshotItem(i).textContent);
      }
      return result;
    },
  };
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
  const xpath = makeBrowserXPathAdapter(xmlDocument, namespaceResolver);
  const evaluator = new RuleEvaluator(xpath, GIRNAMESPACES);

  for (const rule of GIRRULES) {
    for (const target of rule.targets) {
      const targetNodes = xpath.nodes(target, xmlDocument);

      for (const targetNode of targetNodes) {
        const result = evaluator.evaluate(rule, targetNode);
        if (result.ok) {
          continue;
        }

        const docRefId = extractNearestDocRefId(xmlDocument, targetNode);
        const matchedPath = nodeXPath(targetNode) || target;
        statusMessage.addRecordValidationError({
          code: rule.number,
          message: result.message,
          description: rule.description,
          docRefIds: docRefId ? [docRefId] : [],
          fieldPaths: [matchedPath],
        }, targetNode);
      }
    }
  }
}
