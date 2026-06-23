import cytoscape from "cytoscape";
import cytoscapeSvg from "cytoscape-svg";

cytoscape.use(cytoscapeSvg);

function childElements(element, localName) {
  return Array.from(element?.children || []).filter(child => child.localName === localName);
}

function firstChild(element, localName) {
  return childElements(element, localName)[0] || null;
}

function textOfChild(element, localName) {
  return firstChild(element, localName)?.textContent?.trim() || "";
}

function formatOwnershipPercentage(rawValue) {
  const value = Number.parseFloat(rawValue || "");
  if (!Number.isFinite(value)) {
    return rawValue || "";
  }

  const percentage = value * 100;
  return `${Number.isInteger(percentage) ? percentage.toFixed(0) : percentage.toFixed(1)}%`;
}

function getIdentityElement(entityElement) {
  if (entityElement.localName === "UPE") {
    const wrapper = firstChild(entityElement, "OtherUPE") || firstChild(entityElement, "ExcludedUPE");
    return firstChild(wrapper, "ID") || firstChild(entityElement, "ID");
  }

  return firstChild(entityElement, "ID");
}

function getUpeData(upeElement, index) {
  const identityElement = getIdentityElement(upeElement);
  const name = textOfChild(identityElement, "Name") || `UPE ${index + 1}`;
  const country = textOfChild(identityElement, "ResCountryCode");
  const tin = textOfChild(identityElement, "TIN");
  const status = childElements(identityElement, "GlobeStatus")
    .map(node => node.textContent?.trim())
    .filter(Boolean)
    .join(", ");

  return {
    id: `upe-${index + 1}`,
    kind: "upe",
    name,
    country,
    tin,
    status,
    label: [name, country ? `(${country})` : "", tin || ""].filter(Boolean).join("\n"),
    title: [
      "Ultimate Parent Entity",
      name,
      country ? `Country: ${country}` : "",
      tin ? `TIN: ${tin}` : "",
      status ? `Status: ${status}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function getEntityData(entityElement, index, options = {}) {
  const hasMatchingUpe = options.hasMatchingUpe === true;
  const identityElement = getIdentityElement(entityElement);
  const name = textOfChild(identityElement, "Name") || `${entityElement.localName} ${index + 1}`;
  const country = textOfChild(identityElement, "ResCountryCode");
  const tin = textOfChild(identityElement, "TIN");
  const status = childElements(identityElement, "GlobeStatus")
    .map(node => node.textContent?.trim())
    .filter(Boolean)
    .join(", ");

  return {
    id: `entity-${index + 1}`,
    kind: hasMatchingUpe ? "ce-upe" : "ce",
    name,
    country,
    tin,
    status,
    label: [name, country ? `(${country})` : "", tin || ""].filter(Boolean).join("\n"),
    title: [
      hasMatchingUpe ? "Constituent Entity (matches UPE)" : "Constituent Entity",
      name,
      country ? `Country: ${country}` : "",
      tin ? `TIN: ${tin}` : "",
      status ? `Status: ${status}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function extractCorporateStructureGraph(corporateStructureElement) {
  const upeElements = childElements(corporateStructureElement, "UPE");
  const entityElements = childElements(corporateStructureElement, "CE");
  const nodes = [];
  const edges = [];
  const roots = [];
  const sourceIndexByTin = new Map();
  const incomingCounts = new Map();
  let placeholderNodeCount = 0;
  const upeTinSet = new Set();

  upeElements.forEach((upeElement, index) => {
    const upeData = getUpeData(upeElement, index);
    nodes.push({ data: upeData, classes: upeData.kind });

    if (upeData.tin && upeData.tin.toUpperCase() !== "NOTIN") {
      upeTinSet.add(upeData.tin);
      if (!sourceIndexByTin.has(upeData.tin)) {
        sourceIndexByTin.set(upeData.tin, upeData.id);
      }
    }
  });

  function ensurePlaceholderNode(ownerTin, ownershipType, percentage) {
    const placeholderId = `missing-owner-${placeholderNodeCount + 1}`;
    const ownershipDetails = [
      ownershipType ? `Type: ${ownershipType}` : "",
      percentage ? `Ownership: ${formatOwnershipPercentage(percentage)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const placeholderNode = {
      data: {
        id: placeholderId,
        kind: "missing-owner",
        label: [`Other Owner`, ownerTin ? `TIN: ${ownerTin}` : "TIN: Unknown"].filter(Boolean).join("\n"),
        title: [
          "Owner could not be resolved to any entity in CorporateStructure.",
          ownerTin ? `TIN: ${ownerTin}` : "TIN: Unknown",
          ownershipDetails,
        ]
          .filter(Boolean)
          .join("\n"),
      },
      classes: "placeholder-owner",
    };

    nodes.push(placeholderNode);
    placeholderNodeCount += 1;
    return placeholderId;
  }

  const ceNodeIds = [];

  entityElements.forEach((entityElement, index) => {
    const entityIdentity = getIdentityElement(entityElement);
    const entityTin = textOfChild(entityIdentity, "TIN");
    const entityData = getEntityData(entityElement, index, {
      hasMatchingUpe: !!entityTin && upeTinSet.has(entityTin),
    });
    nodes.push({ data: entityData, classes: entityData.kind });
    ceNodeIds.push(entityData.id);

    if (entityData.tin && entityData.tin.toUpperCase() !== "NOTIN" && !sourceIndexByTin.has(entityData.tin)) {
      sourceIndexByTin.set(entityData.tin, entityData.id);
    }
  });

  let edgeIndex = 0;

  entityElements.forEach((entityElement, targetIndex) => {
    const targetId = ceNodeIds[targetIndex];
    const ownershipElements = childElements(entityElement, "Ownership").concat(childElements(entityElement, "PreOwnership"));

    ownershipElements.forEach(ownershipElement => {
      const ownerTin = textOfChild(ownershipElement, "TIN") || textOfChild(ownershipElement, "OtherTIN");
      const percentage = textOfChild(ownershipElement, "OwnershipPercentage") || textOfChild(ownershipElement, "PreOwnershipPercentage");
      const ownershipType = textOfChild(ownershipElement, "OwnershipType");
      const ownershipPercentageLabel = percentage ? formatOwnershipPercentage(percentage) : "";
      const edgeLabel = [ownershipType, ownershipPercentageLabel].filter(Boolean).join("\n");

      const sourceId = ownerTin && ownerTin.toUpperCase() !== "NOTIN" ? sourceIndexByTin.get(ownerTin) : null;
      const resolvedSourceId = sourceId || ensurePlaceholderNode(ownerTin, ownershipType, percentage);

      if (resolvedSourceId === targetId) {
        return;
      }

      edges.push({
        data: {
          id: `edge-${edgeIndex + 1}`,
          source: resolvedSourceId,
          target: targetId,
          label: edgeLabel,
          title: [
            ownershipType ? `Ownership type: ${ownershipType}` : "",
            ownershipPercentageLabel ? `Ownership: ${ownershipPercentageLabel}` : "",
            ownerTin ? `Owner TIN: ${ownerTin}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
        classes: "ownership",
      });

      edgeIndex += 1;
      incomingCounts.set(targetId, (incomingCounts.get(targetId) || 0) + 1);
    });
  });

  if (roots.length === 0) {
    for (const node of nodes) {
      if (!incomingCounts.has(node.data.id)) {
        roots.push(node.data.id);
      }
    }
  }

  return { nodes, edges, roots };
}

class CorporateStructureGraph extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._cy = null;
    this._xmlDocument = null;
    this._pendingRender = null;
    this._resizeObserver = new ResizeObserver(() => {
      this.refresh();
    });
    this._onExportPngClick = this._onExportPngClick.bind(this);
    this._onExportSvgClick = this._onExportSvgClick.bind(this);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          min-height: 520px;
        }

        .frame {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
          min-height: 520px;
        }

        .hint {
          color: #5f6f82;
          font: 600 13px/1.3 sans-serif;
        }

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .actions {
          display: inline-flex;
          gap: 8px;
        }

        .export-btn {
          appearance: none;
          border: 1px solid #cdd6df;
          border-radius: var(--radius-md);
          background: var(--color-surface);
          color: #1f2d3d;
          cursor: pointer;
          font: 600 12px/1.2 sans-serif;
          padding: 6px 10px;
          transition: background-color 120ms ease, border-color 120ms ease;
        }

        .export-btn:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #b7c3cf;
        }

        .export-btn:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .empty {
          display: none;
          padding: 18px;
          border: var(--border-frame);
          border-radius: var(--radius-lg);
          color: #5f6f82;
          background: #f7f9fb;
          font: 14px/1.5 sans-serif;
        }

        .graph {
          width: 100%;
          height: 72vh;
          min-height: 500px;
          border: var(--border-frame);
          border-radius: var(--radius-lg);
          background: linear-gradient(180deg, var(--color-surface) 0%, #f9fbfc 100%);
          overflow: hidden;
        }

        .empty[hidden] {
          display: none;
        }
      </style>
      <div class="frame">
        <div class="toolbar">
          <div class="hint">Drag to pan, scroll to zoom, click a node to inspect its details.</div>
          <div class="actions">
            <button class="export-btn export-png" type="button" disabled>Export PNG</button>
            <button class="export-btn export-svg" type="button" disabled>Export SVG</button>
          </div>
        </div>
        <div class="empty" hidden></div>
        <div class="graph" part="graph"></div>
      </div>
    `;

    this._emptyEl = this.shadowRoot.querySelector(".empty");
    this._graphEl = this.shadowRoot.querySelector(".graph");
    this._exportPngButton = this.shadowRoot.querySelector(".export-png");
    this._exportSvgButton = this.shadowRoot.querySelector(".export-svg");
  }

  connectedCallback() {
    this._resizeObserver.observe(this._graphEl);
    this._exportPngButton.addEventListener("click", this._onExportPngClick);
    this._exportSvgButton.addEventListener("click", this._onExportSvgClick);
    if (this._xmlDocument) {
      this.render(this._xmlDocument);
    }
  }

  disconnectedCallback() {
    this._resizeObserver.disconnect();
    this._exportPngButton.removeEventListener("click", this._onExportPngClick);
    this._exportSvgButton.removeEventListener("click", this._onExportSvgClick);
    this._destroyGraph();
  }

  set xmlDocument(value) {
    this._xmlDocument = value;
    this.render(value);
  }

  get xmlDocument() {
    return this._xmlDocument;
  }

  refresh() {
    if (!this._cy) {
      return;
    }

    this._cy.resize();
    this._cy.fit(undefined, 24);
  }

  render(xmlDocument) {
    this._destroyGraph();
    this._graphEl.textContent = "";

    if (this.clientWidth === 0 || this.clientHeight === 0) {
      this._pendingRender = xmlDocument;
      requestAnimationFrame(() => {
        if (this._pendingRender === xmlDocument) {
          this.render(xmlDocument);
        }
      });
      return true;
    }

    this._pendingRender = null;

    if (!(xmlDocument instanceof Document) || !xmlDocument.documentElement) {
      this._showEmpty("No XML document is loaded.");
      return false;
    }

    const corporateStructureElement = Array.from(xmlDocument.getElementsByTagName("*")).find(
      node => node.localName === "CorporateStructure"
    );

    if (!corporateStructureElement) {
      this._showEmpty("No CorporateStructure element was found in this XML document.");
      return false;
    }

    const { nodes, edges, roots } = extractCorporateStructureGraph(corporateStructureElement);
    if (nodes.length === 0) {
      this._showEmpty("CorporateStructure is present, but no UPE or CE entries were found.");
      return false;
    }

    this._hideEmpty();
    this._cy = cytoscape({
      container: this._graphEl,
      elements: [...nodes, ...edges],
      style: [
        {
          selector: "node",
          style: {
            content: "data(label)",
            shape: "round-rectangle",
            "background-color": "#ffffff",
            "border-width": 2,
            "border-color": "#8aa3b7",
            color: "#1f2d3d",
            "font-family": "ui-sans-serif, system-ui, sans-serif",
            "font-size": 11,
            "text-wrap": "wrap",
            "text-max-width": 180,
            "text-valign": "center",
            "text-halign": "center",
            padding: 12,
            "min-width": 80,
            "min-height": 36,
            width: "label",
            height: "label",
          },
        },
        {
          selector: "node.upe",
          style: {
            "background-color": "#fef3c7",
            "border-color": "#d97706",
            "border-width": 3,
            "font-weight": "bold",
          },
        },
        {
          selector: "node.ce",
          style: {
            "background-color": "#ecfccb",
            "border-color": "#65a30d",
          },
        },
        {
          selector: "node.ce-upe",
          style: {
            "background-color": "#dbeafe",
            "border-color": "#2563eb",
            "border-width": 3,
          },
        },
        {
          selector: "node.placeholder-owner",
          style: {
            "background-color": "#f1f5f9",
            "border-color": "#64748b",
            "border-style": "dashed",
            color: "#334155",
          },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#94a3b8",
            "target-arrow-color": "#94a3b8",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": 10,
            "text-wrap": "wrap",
            "text-max-width": 120,
            "text-justification": "center",
            "line-height": 1.2,
            "text-background-color": "#ffffff",
            "text-background-opacity": 0.85,
            "text-background-padding": 5,
            "text-rotation": "none",
            color: "#475569",
          },
        },
        {
          selector: "edge.ownership",
          style: {
            "line-style": "solid",
          },
        },
      ],
      layout: {
        name: "breadthfirst",
        directed: true,
        roots,
        padding: 24,
        spacingFactor: 1.35,
        avoidOverlap: true,
        animate: false,
      },
    });

    requestAnimationFrame(() => {
      this.refresh();
    });

    this._syncExportButtons();

    return true;
  }

  _showEmpty(message) {
    this._emptyEl.textContent = message;
    this._emptyEl.hidden = false;
  }

  _hideEmpty() {
    this._emptyEl.hidden = true;
  }

  _destroyGraph() {
    if (this._cy) {
      this._cy.destroy();
      this._cy = null;
    }

    this._syncExportButtons();
  }

  _syncExportButtons() {
    const canExport = !!this._cy;
    this._exportPngButton.disabled = !canExport;
    this._exportSvgButton.disabled = !canExport;
  }

  _onExportPngClick() {
    if (!this._cy) {
      return;
    }

    const dataUrl = this._cy.png({
      full: true,
      bg: "#ffffff",
      scale: 2,
    });
    this._downloadDataUrl(dataUrl, "corporate-structure.png");
  }

  _onExportSvgClick() {
    if (!this._cy) {
      return;
    }

    const svg = this._cy.svg({
      full: true,
      bg: "#ffffff",
      scale: 1,
    });
    this._downloadText(svg, "corporate-structure.svg", "image/svg+xml;charset=utf-8");
  }

  _downloadDataUrl(dataUrl, fileName) {
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  _downloadText(text, fileName, contentType) {
    const blob = new Blob([text], { type: contentType });
    const url = URL.createObjectURL(blob);
    this._downloadDataUrl(url, fileName);
    URL.revokeObjectURL(url);
  }
}

customElements.define("corporate-structure-graph", CorporateStructureGraph);