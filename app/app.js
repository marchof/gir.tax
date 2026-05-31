import "./components/FileDrop.js";
import "./components/XMLOutline.js";
import "./components/AppTabs.js";
import "./components/DownloadButton.js";
import "./components/UploadButton.js";
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
const validationContainer = document.createElement("pre");
validationContainer.style.margin = "0";
validationContainer.style.whiteSpace = "pre-wrap";
validationContainer.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";

const schemaMetadata = await getSchemaMetadata();

console.log("Extracted schema metadata", schemaMetadata);

tabs.addTab("File", fileContainer, { id: "file", activate: true });
tabs.addTab("XML", viewerContainer, { id: "viewer" });
tabs.addTab("Validation", validationContainer, { id: "validation" });

tabs.setTabVisible("viewer", false);
tabs.setTabVisible("validation", false);
tabs.setActiveTab("file");

async function handleFile(file) {
  if (!file) {
    return;
  }

  tabs.setTabVisible("validation", true);

  let xmlText;
  let xmlFileName = file.name || "input.xml";

  try {
    const fileText = await file.text();
    if (looksLikeCsvFile(file)) {
      xmlText = csvToXml(fileText);
      xmlFileName = toXmlFileName(file.name);
    } else {
      xmlText = fileText;
    }
  } catch (error) {
    exportXmlButton.clear();
    validationContainer.textContent = error instanceof Error ? error.message : String(error);
    tabs.setTabVisible("viewer", false);
    tabs.setActiveTab("validation");
    return;
  }

  exportXmlButton.setDownload(new Blob([xmlText], { type: "application/xml" }), xmlFileName);

  const result = await validate(xmlText, xmlFileName);
  if (!result.valid) {
    console.warn("XML validation failed", result.errors);
    validationContainer.textContent = result.rawOutput;
    tabs.setTabVisible("viewer", false);
    tabs.setActiveTab("validation");
    return;
  }

  validationContainer.textContent = "No validation errors.";

  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  const parserError = xml.querySelector("parsererror");
  if (parserError) {
    validationContainer.textContent = parserError.textContent || "XML parsing failed.";
    tabs.setTabVisible("viewer", false);
    tabs.setActiveTab("validation");
    return;
  }

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

drop.addEventListener("filedropped", async e => {
  await handleFile(e.detail.file);
});

importButton.addEventListener("fileselected", async e => {
  await handleFile(e.detail.file);
});
