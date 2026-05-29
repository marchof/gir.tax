class VersionInfo extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          margin-top: 10px;
          font-size: 0.9em;
          color: #ccc;
        }

        a {
          color: inherit;
        }
      </style>
      <div>
        <a href="https://github.com/marchof/gir.tax">https://github.com/marchof/gir.tax</a> |
        <a href="https://github.com/marchof/gir.tax/commit/${VERSION_INFO.commitId}">${VERSION_INFO.commitIdShort}</a> |
        ${VERSION_INFO.commitTimestampIso}
      </div>
    `;
  }
}

customElements.define("version-info", VersionInfo);