import { BUTTON_BASE_CSS } from "./buttonBaseStyle.js";

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

        ${BUTTON_BASE_CSS}

        a.button-base {
          text-decoration: none;
        }

        a[hidden] {
          display: none;
        }
      </style>
      <a class="button-base" hidden></a>
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