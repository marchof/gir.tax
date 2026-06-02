import { BUTTON_BASE_CSS } from "./buttonBaseStyle.js";

class ValidationStatus extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._statusMessage = null;
    this._xmlFileName = null;
    this._objectUrl = undefined;
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    this._revokeUrl();
  }

  set statusMessage(value) {
    this._statusMessage = value;
    this.render();
  }

  get statusMessage() {
    return this._statusMessage;
  }

  set xmlFileName(value) {
    this._xmlFileName = value || "girstatusmessage.xml";
  }

  get xmlFileName() {
    return this._xmlFileName;
  }

  async exportStatusXml() {
    if (!this._statusMessage) {
      return;
    }

    try {
      const statusXmlFileName = this._toStatusMessageFileName(this._xmlFileName);
      const statusXml = await this._statusMessage.exportValidatedXml(statusXmlFileName);

      this._revokeUrl();
      this._objectUrl = URL.createObjectURL(new Blob([statusXml], { type: "application/xml" }));

      const anchor = document.createElement("a");
      anchor.href = this._objectUrl;
      anchor.download = statusXmlFileName;
      anchor.click();
    } catch (error) {
      console.error("Failed to export GIR status message", error);
      alert(`Export failed: ${error.message}`);
    }
  }

  render() {
    const content = this._statusMessage
      ? this._renderValidationHtml(this._statusMessage)
      : "<p class=\"empty-state\">No validation data.</p>";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 0;
          margin: 0;
        }

        .validation-container {
          font-family: system-ui, -apple-system, Segoe UI, sans-serif;
          padding: 1rem;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          height: 100%;
          box-sizing: border-box;
          gap: 1rem;
        }

        .validation-output {
          flex: 1;
          margin: 0;
          font-size: 0.95em;
          line-height: 1.5;
          border: 1px solid #ddd;
          padding: 1rem;
          background: #fff;
          border-radius: 8px;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .summary-item {
          border: 1px solid #e1e7ef;
          border-radius: 8px;
          background: #f9fbfd;
          padding: 0.6rem 0.7rem;
        }

        .summary-label {
          font-size: 0.78rem;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: #5a6878;
        }

        .summary-value {
          margin-top: 0.2rem;
          color: #1f2d3d;
          font-weight: 600;
          word-break: break-word;
        }

        .summary-value.status-accepted {
          color: #0e7c42;
        }

        .summary-value.status-rejected {
          color: #a1260d;
        }

        .issues-section + .issues-section {
          margin-top: 1rem;
        }

        .issues-heading {
          margin: 0 0 0.5rem;
          font-size: 1rem;
          color: #1f2d3d;
        }

        .issues-list {
          margin: 0;
          padding-left: 1.1rem;
        }

        .issue-item + .issue-item {
          margin-top: 0.45rem;
        }

        .issue-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.85rem;
          padding: 0.08rem 0.35rem;
          border-radius: 6px;
          border: 1px solid #d7dfe8;
          background: #f5f8fb;
          margin-right: 0.35rem;
        }

        .empty-state {
          margin: 0;
          color: #5a6878;
        }

        .button-row {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        ${BUTTON_BASE_CSS}
      </style>
      <div class="validation-container">
        <div class="validation-output">${content}</div>
        <div class="button-row">
          <button class="button-base" id="export-btn">Export GIR Status Message</button>
        </div>
      </div>
    `;

    const exportBtn = this.shadowRoot.getElementById("export-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportStatusXml());
    }
  }

  _renderValidationHtml(statusMessage) {
    const model = statusMessage.toValidationModel();
    const statusClass = model.status === "Accepted" ? "status-accepted" : "status-rejected";
    const summary = `
      <section class="summary-grid">
        <div class="summary-item">
          <div class="summary-label">Status</div>
          <div class="summary-value ${statusClass}">${this._escapeHtml(model.status)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Errors</div>
          <div class="summary-value">${model.errorCount}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Message Ref ID</div>
          <div class="summary-value">${this._escapeHtml(model.messageRefId || "-")}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Timestamp</div>
          <div class="summary-value">${this._escapeHtml(model.timestamp)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Validated By</div>
          <div class="summary-value">${this._escapeHtml(model.validatedBy.join(", "))}</div>
        </div>
      </section>
    `;

    const fileIssues = this._renderIssuesSection("File Issues", model.fileErrors);
    const recordIssues = this._renderIssuesSection("Record Issues", model.recordErrors);
    const noIssues = model.errorCount === 0 ? "<p class=\"empty-state\">No validation issues found.</p>" : "";

    return `${summary}${noIssues}${fileIssues}${recordIssues}`;
  }

  _renderIssuesSection(title, errors) {
    if (!errors || errors.length === 0) {
      return "";
    }

    const items = errors.map(error => {
      const code = this._escapeHtml(error.code || "-");
      const details = this._escapeHtml(error.details || "No details");
      return `<li class="issue-item"><span class="issue-code">${code}</span>${details}</li>`;
    });

    return `
      <section class="issues-section">
        <h3 class="issues-heading">${this._escapeHtml(title)}</h3>
        <ul class="issues-list">${items.join("")}</ul>
      </section>
    `;
  }

  _toStatusMessageFileName(xmlFileName) {
    const baseName = (xmlFileName || "input.xml").replace(/\.xml$/i, "");
    return `${baseName}-status.xml`;
  }

  _escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  _revokeUrl() {
    if (this._objectUrl) {
      URL.revokeObjectURL(this._objectUrl);
      this._objectUrl = undefined;
    }
  }
}

customElements.define("validation-status", ValidationStatus);
