// Renders the curated example documents (see app/examples.js) as a compact,
// low-prominence line of links, meant to sit inside the file drop widget.
// Clicking one dispatches an `exampleselected` event carrying the chosen
// descriptor so the app can fetch and import it just like an uploaded file.
class ExampleList extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._examples = [];
    this._onItemClick = this._onItemClick.bind(this);
  }

  connectedCallback() {
    this.render();
  }

  set examples(value) {
    this._examples = Array.isArray(value) ? value : [];
    this.render();
  }

  get examples() {
    return this._examples;
  }

  _escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  _onItemClick(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index);
    const example = this._examples[index];

    if (!example) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent("exampleselected", {
        detail: { example },
        bubbles: false,
        composed: true,
      })
    );
  }

  render() {
    if (!this.shadowRoot) {
      return;
    }

    const links = this._examples
      .map(
        (example, index) =>
          `<a href="#" class="example" data-index="${index}" title="${this._escapeHtml(example.expected)}">${this._escapeHtml(example.label)}</a>`
      )
      .join('<span class="sep">·</span>');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--font-ui);
          font-size: 0.8rem;
          color: var(--color-ink-soft);
        }

        .label {
          margin-right: 4px;
        }

        .example {
          color: var(--color-accent);
          text-decoration: none;
          cursor: pointer;
        }

        .example:hover {
          text-decoration: underline;
        }

        .example:focus-visible {
          outline: none;
          text-decoration: underline;
          border-radius: var(--radius-sm);
          box-shadow: var(--shadow-focus);
        }

        .sep {
          margin: 0 6px;
          color: var(--color-line-strong);
        }
      </style>
      <span class="label">Or try an example:</span>${links}
    `;

    for (const link of this.shadowRoot.querySelectorAll(".example")) {
      link.addEventListener("click", this._onItemClick);
    }
  }
}

customElements.define("example-list", ExampleList);
