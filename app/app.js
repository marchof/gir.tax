import "./components/FileDrop.js";
import "./components/XMLOutline.js";
import "./components/AppTabs.js";
import { getSchemaMetadata, validate } from "./xmlschema.js";

const tabs = document.getElementById("top-tabs");
const drop = document.getElementById("drop");

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
  const xmlText = await file.text();

  tabs.setTabVisible("validation", true);

  const result = await validate(xmlText, file.name || "input.xml");
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
