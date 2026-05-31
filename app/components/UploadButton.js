import { BUTTON_BASE_CSS } from "./buttonBaseStyle.js";

class UploadButton extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        ${BUTTON_BASE_CSS}

        input {
          display: none;
        }
      </style>
      <button class="button-base" type="button"></button>
      <input type="file" />
    `;

    this._button = this.shadowRoot.querySelector("button");
    this._input = this.shadowRoot.querySelector("input");

    this._onButtonClick = this._onButtonClick.bind(this);
    this._onFileChange = this._onFileChange.bind(this);

    this.label = this.getAttribute("label") || "Import File";
    this.accept = this.getAttribute("accept") || "";
  }

  connectedCallback() {
    this._syncLabel();
    this._syncAccept();
    this._button.addEventListener("click", this._onButtonClick);
    this._input.addEventListener("change", this._onFileChange);
  }

  disconnectedCallback() {
    this._button.removeEventListener("click", this._onButtonClick);
    this._input.removeEventListener("change", this._onFileChange);
  }

  set label(value) {
    this._label = value || "Import File";
    this._syncLabel();
  }

  get label() {
    return this._label;
  }

  set accept(value) {
    this._accept = value || "";
    this._syncAccept();
  }

  get accept() {
    return this._accept;
  }

  _syncLabel() {
    if (this._button) {
      this._button.textContent = this._label;
    }
  }

  _syncAccept() {
    if (this._input) {
      this._input.accept = this._accept;
    }
  }

  _onButtonClick() {
    this._input.click();
  }

  _onFileChange() {
    const file = this._input.files?.[0];
    const files = this._input.files;
    this._input.value = "";

    if (!file) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent("fileselected", {
        detail: { file, files },
        bubbles: false,
        composed: true,
      })
    );
  }
}

customElements.define("upload-button", UploadButton);