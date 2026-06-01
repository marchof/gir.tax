import "./components/FileDrop.js";
import "./components/XMLOutline.js";
import "./components/AppTabs.js";
import "./components/DownloadButton.js";
import "./components/UploadButton.js";
import "./components/CorporateStructureGraph.js";
import { csvToXml, looksLikeCsvFile, toXmlFileName } from "./csvimport.js";
import { getSchemaMetadata, validate } from "./xmlschema.js";

const tabs = document.getElementById("top-tabs");
const drop = document.createElement("file-drop");
drop.id = "drop";
drop.append("Drop an OECD GIR XML or CSV file here");
const importButton = document.createElement("upload-button");
importButton.label = "Import XML or CSV";
importButton.accept = ".xml,.csv,text/xml,text/csv";

const fileContainer = document.createElement("div");
const buttonRow = document.createElement("div");
buttonRow.style.display = "flex";
buttonRow.style.alignItems = "center";
buttonRow.style.gap = "0.75rem";
buttonRow.style.marginTop = "0.75rem";

const exportXmlButton = document.createElement("download-button");
exportXmlButton.label = "Export XML";
exportXmlButton.style.display = "inline-block";

fileContainer.appendChild(drop);
buttonRow.appendChild(importButton);
buttonRow.appendChild(exportXmlButton);
fileContainer.appendChild(buttonRow);

const viewerContainer = document.createElement("div");
const corporateStructureGraph = document.createElement("corporate-structure-graph");
const validationContainer = document.createElement("pre");
validationContainer.style.margin = "0";
validationContainer.style.whiteSpace = "pre-wrap";
validationContainer.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";

const schemaMetadata = await getSchemaMetadata();

tabs.addTab("File", fileContainer, { id: "file", activate: true });
tabs.addTab("XML", viewerContainer, { id: "viewer" });
tabs.addTab("Corporate Structure", corporateStructureGraph, { id: "corporate-structure" });
tabs.addTab("Validation", validationContainer, { id: "validation" });

tabs.setTabVisible("viewer", false);
tabs.setTabVisible("corporate-structure", false);
tabs.setTabVisible("validation", false);
tabs.setActiveTab("file");

function showValidation(rawOutput) {
  validationContainer.textContent = rawOutput;
  tabs.setTabVisible("viewer", false);
  tabs.setTabVisible("corporate-structure", false);
  tabs.setActiveTab("validation");
}

function renderXmlOutline(xml) {
  let outline = viewerContainer.querySelector("xml-outline");

  if (!outline) {
    viewerContainer.innerHTML = "";
    outline = document.createElement("xml-outline");
    viewerContainer.appendChild(outline);
  }

  outline.schemaMetadata = schemaMetadata;
  outline.xmlDocument = xml;
  tabs.setTabVisible("viewer", true);
  tabs.setActiveTab("viewer");
}

async function parseInputToXml(file) {
  const fileText = await file.text();

  if (looksLikeCsvFile(file)) {
    return {
      xmlText: csvToXml(fileText),
      xmlFileName: toXmlFileName(file.name),
    };
  }

  return {
    xmlText: fileText,
    xmlFileName: file.name || "input.xml",
  };
}

async function runValidation(xmlText, xmlFileName) {
  return validate(xmlText, xmlFileName);
}

function parseXmlDocument(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  const parserError = xml.querySelector("parsererror");

  if (parserError) {
    return {
      xml,
      parserErrorText: parserError.textContent || "XML parsing failed.",
    };
  }

  return {
    xml,
    parserErrorText: "",
  };
}

async function handleFileImport(file) {
  if (!file) {
    return;
  }

  tabs.setTabVisible("validation", true);

  let xmlText;
  let xmlFileName;

  try {
    ({ xmlText, xmlFileName } = await parseInputToXml(file));
  } catch (error) {
    exportXmlButton.clear();
    corporateStructureGraph.xmlDocument = null;
    showValidation(error instanceof Error ? error.message : String(error));
    return;
  }

  exportXmlButton.setDownload(new Blob([xmlText], { type: "application/xml" }), xmlFileName);

  const result = await runValidation(xmlText, xmlFileName);
  if (!result.valid) {
    console.warn("XML validation failed", result.errors);
    corporateStructureGraph.xmlDocument = null;
    showValidation(result.rawOutput);
    return;
  }

  validationContainer.textContent = "No validation errors.";

  const { xml, parserErrorText } = parseXmlDocument(xmlText);
  if (parserErrorText) {
    corporateStructureGraph.xmlDocument = null;
    showValidation(parserErrorText);
    return;
  }

  renderXmlOutline(xml);
  tabs.setTabVisible("corporate-structure", true);
  corporateStructureGraph.xmlDocument = xml;
}

drop.addEventListener("filedropped", async e => {
  await handleFileImport(e.detail.file);
});

importButton.addEventListener("fileselected", async e => {
  await handleFileImport(e.detail.file);
});
