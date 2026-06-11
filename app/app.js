import "./components/FileDrop.js";
import "./components/XMLOutline.js";
import "./components/AppTabs.js";
import "./components/DownloadButton.js";
import "./components/UploadButton.js";
import "./components/CorporateStructureGraph.js";
import "./components/ValidationStatus.js";
import "./components/VersionInfo.js";
import { csvToXml, looksLikeCsvFile, toXmlFileName } from "./csvimport.js";
import { GirStatusMessage } from "./girstatusmessage.js";
import { validateGirRules } from "./girvalidator.js";
import { XMLSchema } from "./xmlschema.js";

const xmlSchema = new XMLSchema("schemas/gir", "globexml_v1.0.xsd");

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
const validationStatus = document.createElement("validation-status");

const schemaMetadata = await xmlSchema.getSchemaMetadata();

tabs.addTab("File", fileContainer, { id: "file", activate: true });
tabs.addTab("XML", viewerContainer, { id: "viewer" });
tabs.addTab("Corporate Structure", corporateStructureGraph, { id: "corporate-structure" });
tabs.addTab("Validation", validationStatus, { id: "validation" });

tabs.setTabVisible("viewer", false);
tabs.setTabVisible("corporate-structure", false);
tabs.setTabVisible("validation", false);
tabs.setActiveTab("file");

function showValidation(statusMessage, xmlFileName, options = {}) {
  validationStatus.statusMessage = statusMessage;
  validationStatus.xmlFileName = xmlFileName;
  tabs.setTabChip("validation", statusMessage.errorCount > 0 ? statusMessage.errorCount : null);
  tabs.setTabVisible("viewer", false);
  tabs.setTabVisible("corporate-structure", false);

  if (options.activate) {
    tabs.setActiveTab("validation");
  }
}

function extractMessageRefId(xml) {
  for (const node of xml.getElementsByTagName("*")) {
    if (node.localName === "MessageRefId") {
      const value = node.textContent?.trim();
      if (value) {
        return value;
      }
    }
  }

  return "";
}

function createStatusMessage() {
  return new GirStatusMessage({
    validatedBy: `gir.tax@${VERSION_INFO.commitIdShort}`,
  });
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
  tabs.setTabChip("validation", null);
  exportXmlButton.clear();

  const statusMessage = createStatusMessage();

  let xmlText;
  let xmlFileName;

  try {
    ({ xmlText, xmlFileName } = await parseInputToXml(file));
  } catch (error) {
    exportXmlButton.clear();
    corporateStructureGraph.xmlDocument = null;
    statusMessage.addParsingError(error instanceof Error ? error.message : String(error));
    showValidation(statusMessage, "input.xml", { activate: true });
    return;
  }

  exportXmlButton.setDownload(new Blob([xmlText], { type: "application/xml" }), xmlFileName);

  const result = await xmlSchema.validate(xmlText, xmlFileName);
  if (!result.valid) {
    corporateStructureGraph.xmlDocument = null;
    statusMessage.addParsingError(result.rawOutput);
    showValidation(statusMessage, xmlFileName, { activate: true });
    return;
  }

  const { xml, parserErrorText } = parseXmlDocument(xmlText);
  if (parserErrorText) {
    corporateStructureGraph.xmlDocument = null;
    statusMessage.addParsingError(parserErrorText);
    showValidation(statusMessage, xmlFileName, { activate: true });
    return;
  }

  statusMessage.setOriginalMessageRefId(extractMessageRefId(xml));
  validateGirRules(xml, statusMessage);
  const hasValidationErrors = statusMessage.errorCount > 0;

  showValidation(statusMessage, xmlFileName, { activate: hasValidationErrors });

  renderXmlOutline(xml);
  tabs.setTabVisible("corporate-structure", true);
  corporateStructureGraph.xmlDocument = xml;

  if (hasValidationErrors) {
    tabs.setActiveTab("validation");
  }
}

drop.addEventListener("filedropped", async e => {
  await handleFileImport(e.detail.file);
});

importButton.addEventListener("fileselected", async e => {
  await handleFileImport(e.detail.file);
});
