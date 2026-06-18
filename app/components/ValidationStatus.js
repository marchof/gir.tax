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
          font-family: "Avenir Next", "Segoe UI", sans-serif;
          padding: 1rem 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          height: 100%;
          box-sizing: border-box;
          gap: 1rem;
          background: #ffffff;
        }

        .validation-output {
          flex: 1;
          margin: 0;
          line-height: 1.5;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
          gap: 0.75rem;
          margin-bottom: 0.9rem;
        }

        .summary-item {
          border: 1px solid #d7e2ef;
          border-radius: 10px;
          background: linear-gradient(180deg, #ffffff, #f7fafd);
          padding: 0.65rem 0.75rem;
        }

        .summary-label {
          font-size: 0.78rem;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: #4f5e71;
        }

        .summary-value {
          margin-top: 0.2rem;
          color: #1c2b3f;
          font-weight: 600;
          word-break: break-word;
        }

        .summary-value.status-accepted {
          color: #0c7a38;
        }

        .summary-value.status-rejected {
          color: #ad2b10;
        }

        .issue-cards {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.9rem;
        }

        .issue-card {
          border: 1px solid #d9e1ea;
          border-radius: 14px;
          background: #ffffff;
          padding: 0.95rem;
        }

        .issue-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.4rem;
        }

        .issue-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.8rem;
          padding: 0.08rem 0.4rem;
          border-radius: 6px;
          border: 1px solid #cc6666;
          background: #ffaaaa;
          color: #20415f;
          white-space: nowrap;
        }

        .issue-language {
          font-size: 0.74rem;
          color: #4f5e71;
          border: 1px dashed #c9d7e9;
          border-radius: 6px;
          padding: 0.08rem 0.35rem;
          white-space: nowrap;
        }

        .issue-details {
          margin: 0;
          color: #1f2d3d;
        }

        .meta-grid {
          margin-top: 0.5rem;
          display: grid;
          gap: 0.45rem;
        }

        .meta-row {
          display: grid;
          gap: 0.25rem;
        }

        .meta-label {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: #617186;
        }

        .mono-list {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.78rem;
          margin: 0;
          padding: 0;
          color: #1f2d3d;
          word-break: break-all;
          white-space: pre-wrap;
        }

        .empty-state {
          margin: 0;
          color: #4d5f74;
        }

        .rules-hint {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          border: 1px solid #bcd6f5;
          border-radius: 10px;
          padding: 0.6rem 0.9rem;
          background: linear-gradient(180deg, #eaf3ff, #f6faff);
          color: #1c3b5e;
          font-size: 0.9rem;
        }

        .rules-hint a {
          color: #0d5e51;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
        }

        .rules-hint a:hover {
          text-decoration: underline;
        }

        .button-row {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        ${BUTTON_BASE_CSS}
      </style>
      <div class="validation-container">
        <div class="rules-hint">
          <span>Validation is based on the currently implemented GIR rules.</span>
          <a href="rules/" target="_blank" rel="noopener noreferrer">View implemented rules <span aria-hidden="true">&rarr;</span></a>
        </div>
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
    const validatedBy = Array.isArray(model.validatedBy) && model.validatedBy.length > 0
      ? model.validatedBy.join(", ")
      : "-";
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
          <div class="summary-label">File Errors</div>
          <div class="summary-value">${Array.isArray(model.fileErrors) ? model.fileErrors.length : 0}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Record Errors</div>
          <div class="summary-value">${Array.isArray(model.recordErrors) ? model.recordErrors.length : 0}</div>
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
          <div class="summary-value">${this._escapeHtml(validatedBy)}</div>
        </div>
      </section>
    `;

    const combinedIssues = this._mergeIssues(model.fileErrors, model.recordErrors);
    const issues = this._renderIssuesSection(combinedIssues);
    const noIssues = model.errorCount === 0 ? "<p class=\"empty-state\">No validation issues found.</p>" : "";

    return `${summary}${noIssues}${issues}`;
  }

  _renderIssuesSection(errors) {
    if (!errors || errors.length === 0) {
      return "";
    }

    const items = errors.map(error => {
      const code = this._escapeHtml(error.code || "-");
      const details = this._escapeHtml(error.details || "No details");
      const language = error.language ? `<span class="issue-language">${this._escapeHtml(error.language)}</span>` : "";
      const docRefIds = this._renderMonospaceRow("DocRef IDs", error.docRefIds);
      const fieldPaths = this._renderMonospaceRow("Field Paths", error.fieldPaths);

      return `
        <article class="issue-card">
          <div class="issue-topline">
            <span class="issue-code">${code}</span>
            ${language}
          </div>
          <p class="issue-details">${details}</p>
          <div class="meta-grid">
            ${docRefIds}
            ${fieldPaths}
          </div>
        </article>
      `;
    });

    return `<div class="issue-cards">${items.join("")}</div>`;
  }

  _mergeIssues(fileErrors, recordErrors) {
    const asArray = value => (Array.isArray(value) ? value : []);
    return [...asArray(fileErrors), ...asArray(recordErrors)];
  }

  _renderMonospaceRow(label, values) {
    const list = Array.isArray(values) ? values.filter(Boolean) : [];
    const lines = list.length > 0
      ? list.map(value => this._escapeHtml(value)).join("\n")
      : "-";

    return `
      <div class="meta-row">
        <div class="meta-label">${this._escapeHtml(label)}</div>
        <pre class="mono-list">${lines}</pre>
      </div>
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
