class DownloadButton extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._objectUrl = undefined;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        a {
          appearance: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #cdd6df;
          border-radius: 9px;
          background: #ffffff;
          color: #1f2d3d;
          cursor: pointer;
          font: 600 14px/1.2 sans-serif;
          padding: 8px 12px;
          text-decoration: none;
          transition: background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
          width: fit-content;
        }

        a:hover {
          background: #f7f9fb;
          border-color: #bfcad6;
        }

        a:active {
          background: #eef2f6;
        }

        a:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(125, 176, 226, 0.35);
        }

        a[hidden] {
          display: none;
        }
      </style>
      <a hidden></a>
    `;

    this._anchor = this.shadowRoot.querySelector("a");
    this.label = this.getAttribute("label") || "Download";
  }

  connectedCallback() {
    this._syncLabel();
  }

  disconnectedCallback() {
    this._revokeUrl();
  }

  set label(value) {
    this._label = value || "Download";
    this._syncLabel();
  }

  get label() {
    return this._label;
  }

  setDownload(blob, fileName) {
    if (!(blob instanceof Blob)) {
      throw new TypeError("setDownload expects a Blob");
    }

    this._revokeUrl();
    this._objectUrl = URL.createObjectURL(blob);
    this._anchor.href = this._objectUrl;
    this._anchor.download = fileName;
    this._anchor.hidden = false;
  }

  clear() {
    this._revokeUrl();
    this._anchor.hidden = true;
    this._anchor.removeAttribute("href");
    this._anchor.removeAttribute("download");
  }

  _syncLabel() {
    if (this._anchor) {
      this._anchor.textContent = this._label;
    }
  }

  _revokeUrl() {
    if (this._objectUrl) {
      URL.revokeObjectURL(this._objectUrl);
      this._objectUrl = undefined;
    }
  }
}

customElements.define("download-button", DownloadButton);