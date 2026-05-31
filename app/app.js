import "./components/FileDrop.js";
import "./components/XMLOutline.js";
import { validate } from "./validation.js";


document.getElementById("drop").addEventListener("filedropped", async e => {
  const file = e.detail.file;
  const xmlText = await file.text();

  const output = document.getElementById("output");

  const result = await validate(xmlText, file.name || "input.xml");
  if (!result.valid) {
    console.warn("XML validation failed", result.errors);
    output.innerHTML = "";
    const errordisplay = document.createElement("pre");
    errordisplay.textContent = result.rawOutput;
    output.appendChild(errordisplay);
    return;
  }

  const xml = new DOMParser().parseFromString(xmlText, "application/xml");

  let outline = output.querySelector("xml-outline");

  if (!outline) {
    output.innerHTML = "";
    outline = document.createElement("xml-outline");
    output.appendChild(outline);
  }

  outline.xmlDocument = xml;
});
