// Tests for app/xmlexport.js: the export must use the fixed globe/stf prefixes,
// declared once on the root element, whatever prefixes the input used, and is
// pretty-printed.
//
// Run with: node --test scripts/testxmlexport.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { DOMImplementation, DOMParser, XMLSerializer } from "@xmldom/xmldom";

// app/xmlexport.js uses the browser DOM globals.
// Silence xmldom's console output for the not-well-formed case.
globalThis.DOMParser = class extends DOMParser {
  constructor() {
    super({ onError: () => {} });
  }
};
globalThis.XMLSerializer = XMLSerializer;
globalThis.document = { implementation: new DOMImplementation() };
globalThis.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3, CDATA_SECTION_NODE: 4, PROCESSING_INSTRUCTION_NODE: 7, DOCUMENT_TYPE_NODE: 10 };

const { toExportXml } = await import("../app/xmlexport.js");

const repoRoot = path.resolve(import.meta.dirname, "..");

const ROOT_DECLARATIONS = 'xmlns:globe="urn:oecd:ties:globe:v2" xmlns:stf="urn:oecd:ties:globestf:v5"';

test("rewrites arbitrary prefixes to globe/stf declared on the root", () => {
  const input = `<ns1:GLOBE_OECD xmlns:ns1="urn:oecd:ties:globe:v2" version="1"><ns1:MessageSpec><ns1:MessageType>GIR</ns1:MessageType></ns1:MessageSpec><ns1:GLOBEBody><ns2:Name xmlns:ns2="urn:oecd:ties:globestf:v5">X</ns2:Name></ns1:GLOBEBody></ns1:GLOBE_OECD>`;

  assert.equal(toExportXml(input), `<?xml version="1.0" encoding="UTF-8"?>
<globe:GLOBE_OECD ${ROOT_DECLARATIONS} version="1">
  <globe:MessageSpec>
    <globe:MessageType>GIR</globe:MessageType>
  </globe:MessageSpec>
  <globe:GLOBEBody>
    <stf:Name>X</stf:Name>
  </globe:GLOBEBody>
</globe:GLOBE_OECD>
`);
});

test("rewrites a default namespace and keeps other namespaces and comments", () => {
  const input = `<!-- head --><GLOBE_OECD xmlns="urn:oecd:ties:globe:v2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:oecd:ties:globe:v2 x.xsd"><MessageSpec/><!-- note --></GLOBE_OECD>`;

  assert.equal(toExportXml(input), `<?xml version="1.0" encoding="UTF-8"?>
<!-- head -->
<globe:GLOBE_OECD ${ROOT_DECLARATIONS} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:oecd:ties:globe:v2 x.xsd">
  <globe:MessageSpec/>
  <!-- note -->
</globe:GLOBE_OECD>
`);
});

test("re-indents badly indented input but keeps text values as they are", () => {
  const input = `<globe:GLOBE_OECD xmlns:globe="urn:oecd:ties:globe:v2">
\t\t<globe:Name>  A  </globe:Name>
      <globe:Mixed>text<globe:Child/></globe:Mixed></globe:GLOBE_OECD>`;

  assert.equal(toExportXml(input), `<?xml version="1.0" encoding="UTF-8"?>
<globe:GLOBE_OECD ${ROOT_DECLARATIONS}>
  <globe:Name>  A  </globe:Name>
  <globe:Mixed>text<globe:Child/></globe:Mixed>
</globe:GLOBE_OECD>
`);
});

test("keeps a 2-space indented example unchanged apart from the root start tag", () => {
  const input = readFileSync(path.join(repoRoot, "examples", "globe-positive-alpenkrone.xml"), "utf8");
  const output = toExportXml(input);
  const splitAtRoot = xml => {
    const rootStart = xml.indexOf("<globe:GLOBE_OECD");
    const rootEnd = xml.indexOf(">", rootStart) + 1;
    return [xml.slice(0, rootStart), xml.slice(rootStart, rootEnd), xml.slice(rootEnd)];
  };
  const [inputBefore, , inputAfter] = splitAtRoot(input);
  const [outputBefore, outputRoot, outputAfter] = splitAtRoot(output);

  assert.equal(outputBefore, inputBefore);
  assert.equal(outputRoot, `<globe:GLOBE_OECD ${ROOT_DECLARATIONS} version="1" xmlns:iso="urn:oecd:ties:isoglobetypes:v1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:oecd:ties:globe:v2 globe-xsd/GLOBEXML_v1.0.xsd">`);
  assert.equal(outputAfter, inputAfter);
});

test("is idempotent on all examples", () => {
  const examplesDir = path.join(repoRoot, "examples");
  for (const file of readdirSync(examplesDir).filter(name => name.endsWith(".xml"))) {
    const once = toExportXml(readFileSync(path.join(examplesDir, file), "utf8"));
    assert.equal(toExportXml(once), once, file);
  }
});

test("returns input that is not well-formed unchanged", () => {
  const input = "<globe:GLOBE_OECD";
  assert.equal(toExportXml(input), input);
});
