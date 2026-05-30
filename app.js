import "./components/FileDrop.js";
import "./components/XMLOutline.js";

document.getElementById("drop").addEventListener("filedropped", async e => {
  const file = e.detail.file;
  const xmlText = await file.text();

  const xml = new DOMParser().parseFromString(xmlText, "application/xml");

  const output = document.getElementById("output");
  let outline = output.querySelector("xml-outline");

  if (!outline) {
    output.innerHTML = "";
    outline = document.createElement("xml-outline");
    output.appendChild(outline);
  }

  outline.xmlDocument = xml;
});
