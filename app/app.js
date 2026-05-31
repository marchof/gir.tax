import "./components/FileDrop.js";
import "./components/XMLOutline.js";
import "./components/AppTabs.js";
import { csvToXml, looksLikeCsvFile, toXmlFileName } from "./csvimport.js";
import { getSchemaMetadata, validate } from "./xmlschema.js";

const tabs = document.getElementById("top-tabs");
const drop = document.createElement("file-drop");
drop.id = "drop";
drop.append("Drop an OECD GIR XML or CSV file here");

const uploaderContainer = document.createElement("div");
uploaderContainer.appendChild(drop);

const viewerContainer = document.createElement("div");
const validationContainer = document.createElement("pre");
validationContainer.style.margin = "0";
validationContainer.style.whiteSpace = "pre-wrap";
validationContainer.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";

const schemaMetadata = await getSchemaMetadata();

console.log("Extracted schema metadata", schemaMetadata);

tabs.addTab("Upload", uploaderContainer, { id: "uploader", activate: true });
tabs.addTab("XML", viewerContainer, { id: "viewer" });
tabs.addTab("Validation", validationContainer, { id: "validation" });

tabs.setTabVisible("viewer", false);
tabs.setTabVisible("validation", false);
tabs.setActiveTab("uploader");

drop.addEventListener("filedropped", async e => {
  const file = e.detail.file;

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
    validationContainer.textContent = error instanceof Error ? error.message : String(error);
    tabs.setTabVisible("viewer", false);
    tabs.setActiveTab("validation");
    return;
  }

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
});
