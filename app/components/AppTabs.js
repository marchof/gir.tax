class AppTabs extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._tabs = new Map();
    this._tabOrder = [];
    this._activeTabId = null;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          margin-top: 16px;
        }

        .tabs {
          border: 1px solid #d9dee3;
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
        }

        .tab-list {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px;
          background: linear-gradient(180deg, #f7f9fb 0%, #eef2f6 100%);
          border-bottom: 1px solid #d9dee3;
        }

        .tab-title {
          margin-left: auto;
          color: #aaa;
          font: 700 18px/1.2 sans-serif;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }

        .tab-button {
          appearance: none;
          border: 1px solid transparent;
          border-radius: 9px;
          background: transparent;
          color: #425466;
          cursor: pointer;
          font: 600 14px/1.2 sans-serif;
          padding: 8px 12px;
          transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .tab-button:hover {
          background: #e8edf2;
        }

        .tab-button[aria-selected="true"] {
          background: #ffffff;
          border-color: #cdd6df;
          color: #1f2d3d;
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.08);
        }

        .tab-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1.5rem;
          height: 1.25rem;
          padding: 0 0.1rem;
          border-radius: 999px;
          background: #cf3f2e;
          color: #ffffff;
          font: 700 11px/1 sans-serif;
        }

        .tab-chip[hidden] {
          display: none;
        }

        .panels {
          padding: 14px;
          background: #ffffff;
          min-height: 120px;
        }

        .panel[hidden] {
          display: none;
        }
      </style>
      <div class="tabs">
        <div class="tab-list" role="tablist" aria-label="Application tabs"></div>
        <div class="panels"></div>
      </div>
    `;

    this._tabList = this.shadowRoot.querySelector(".tab-list");
    this._panels = this.shadowRoot.querySelector(".panels");

    this._title = document.createElement("div");
    this._title.className = "tab-title";
    this._title.textContent = "OECD GIR File Viewer";
    this._tabList.appendChild(this._title);
  }

  addTab(label, element, options = {}) {
    if (!(element instanceof HTMLElement)) {
      throw new TypeError("addTab expects an HTMLElement as tab content");
    }

    const id = options.id || `tab-${crypto.randomUUID()}`;
    if (this._tabs.has(id)) {
      throw new Error(`A tab with id '${id}' already exists`);
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab-button";
    button.role = "tab";
    button.id = `${id}-button`;
    button.setAttribute("aria-selected", "false");
    button.setAttribute("aria-controls", `${id}-panel`);

    const labelNode = document.createElement("span");
    labelNode.textContent = label;

    const chipNode = document.createElement("span");
    chipNode.className = "tab-chip";
    chipNode.hidden = true;

    button.append(labelNode, chipNode);
    button.addEventListener("click", () => {
      this.setActiveTab(id);
    });

    const panel = document.createElement("section");
    panel.className = "panel";
    panel.role = "tabpanel";
    panel.id = `${id}-panel`;
    panel.setAttribute("aria-labelledby", button.id);
    panel.hidden = true;
    panel.appendChild(element);

    this._tabList.insertBefore(button, this._title);
    this._panels.appendChild(panel);

    this._tabs.set(id, {
      button,
      panel,
      element,
      labelNode,
      chipNode,
      visible: true,
    });
    this._tabOrder.push(id);

    this.setTabChip(id, options.chip);

    if (options.activate || this._activeTabId === null) {
      this.setActiveTab(id);
    }

    return id;
  }

  setActiveTab(id) {
    if (!this._tabs.has(id)) {
      return;
    }

    const nextTab = this._tabs.get(id);
    if (!nextTab.visible) {
      return;
    }

    this._activeTabId = id;

    for (const [tabId, tab] of this._tabs) {
      const active = tabId === id;
      tab.button.setAttribute("aria-selected", active ? "true" : "false");
      tab.panel.hidden = !active;
    }
  }

  setTabVisible(id, visible) {
    const tab = this._tabs.get(id);
    if (!tab) {
      return;
    }

    tab.visible = visible;
    tab.button.hidden = !visible;

    if (!visible) {
      tab.panel.hidden = true;
      if (this._activeTabId === id) {
        const firstVisible = this._tabOrder.find(tabId => this._tabs.get(tabId).visible);
        if (firstVisible) {
          this.setActiveTab(firstVisible);
        } else {
          this._activeTabId = null;
        }
      }
      return;
    }

    if (!this._activeTabId) {
      this.setActiveTab(id);
    }
  }

  setTabChip(id, chip) {
    const tab = this._tabs.get(id);
    if (!tab) {
      return;
    }

    const chipText = this._normalizeChip(chip);
    tab.chipNode.textContent = chipText || "";
    tab.chipNode.hidden = chipText === null;
  }

  _normalizeChip(chip) {
    if (chip === null || chip === undefined || chip === false || chip === "") {
      return null;
    }

    return String(chip);
  }

  getActiveTab() {
    return this._activeTabId;
  }
}

customElements.define("app-tabs", AppTabs);
