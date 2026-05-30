import "./components/FileDrop.js";

const xslUrl = "oecd-globe-style.xsl";

document.getElementById("drop").addEventListener("filedropped", async e => {
  const file = e.detail.file;
  const xmlText = await file.text();

  const xml = new DOMParser().parseFromString(xmlText, "application/xml");

  const xslText = await fetch(xslUrl).then(r => r.text());
  const xsl = new DOMParser().parseFromString(xslText, "application/xml");

  const processor = new XSLTProcessor();
  processor.importStylesheet(xsl);

  const result = processor.transformToFragment(xml, document);

  const output = document.getElementById("output");
  output.innerHTML = "";
  output.appendChild(result);
});
