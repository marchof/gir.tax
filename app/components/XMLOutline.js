
class XMLOutline extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._enumDescriptions = new Map();
    this._tagDescriptions = new Map();
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--font-ui);
        }

        div.xml-code {
          display: table;
          font-size: 0.85rem;
          border-radius: 5px;
          margin-left: 20px;
          margin-top: 4px;
          margin-bottom: 4px;
          padding-right: 4px;
          line-height: 1.5;
          text-indent: 20px hanging;
          transition: background-color 120ms ease, border-color 120ms ease;
        }

        div.xml-code:has(div.xml-code) {
          border-left: 1px solid var(--color-line);
          border-bottom: 1px solid var(--color-line);
        }

        div.xml-code:has(div.xml-code):has(> span.validation-error) {
          border-left: 1px solid var(--color-danger-soft-border);
          border-bottom: 1px solid var(--color-danger-soft-border);
        }

        div.xml-code:not(:has(div.xml-code:hover)):hover {
          background: var(--color-surface-muted);
          border-color: var(--color-line-strong);
        }

        div.xml-code:not(:has(div.xml-code:hover)):hover:has(> span.validation-error) {
          border-color: var(--color-danger);
        }

        .xml-tag {
          font-family: var(--font-mono);
          color: #aaa;
          background: var(--color-line);
          padding: 2px 4px;
          border-radius: 4px;
          margin-right: 4px;
          transition: background-color 120ms ease;
        }

        .validation-error {
          background: var(--color-danger-soft-bg);
          cursor: help;
        }

        .validation-error:before {
          content: "❌ ";
        }

        div.xml-code:not(:has(div.xml-code:hover)):hover > .xml-tag {
          background: var(--color-line-strong);
        }

        div.xml-code:not(:has(div.xml-code:hover)):hover > .validation-error {
          background: var(--color-danger-soft-border);
        }

        .xml-tag-name {
          color: #9966ff;
          margin-left: 2px;
          margin-right: 2px;
        }

        .xml-tag-name.has-doc {
          text-decoration: underline dotted #9966ff;
          text-underline-offset: 2px;
          cursor: help;
        }

        .xml-tag-doc-indicator {
          color: #5e7aa2;
          font-size: 0.7em;
          margin-left: 2px;
          vertical-align: super;
        }

        .xml-attr-name {
          color: #ee9966;
        }

        .xml-attr-val {
          color: #000;
        }

        .xml-text {
          font-family: var(--font-mono);
          color: #000;
        }

        .schema-documentation {
          color: #888;
          font-style: italic;
        }

        .validation-tooltip {
          position: absolute;
          background: #fff3cd;
          border: 1px solid #c1b899;
          border-radius: 6px;
          padding: 12px;
          margin-left: 8px;
          margin-top: 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          z-index: 1000;
          font-size: 13px;
          min-width: 250px;
          max-width: 400px;
          display: none;
          pointer-events: none;
          text-indent: 0px;
        }

        .validation-tooltip.show {
          display: block;
        }

        .validation-tooltip-title {
          font-weight: 700;
          color: #c92a2a;
          margin-bottom: 8px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .validation-error-item {
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 107, 107, 0.2);
        }

        .validation-error-item:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }

        .validation-error-code {
          font-family: var(--font-mono);
          font-weight: 600;
          color: #c92a2a;
          font-size: 12px;
          margin-bottom: 4px;
        }

        .validation-error-message {
          color: #5c5c5c;
          line-height: 1.4;
        }
      </style>
      <div id="container" part="container"></div>
    `;

    this._container = this.shadowRoot.querySelector("#container");
  }

  set xmlDocument(value) {
    this.render(value);
  }

  set schemaMetadata(value) {
    this._enumDescriptions = value?.enumDescriptions instanceof Map ? value.enumDescriptions : new Map();
    this._tagDescriptions = value?.tagDescriptions instanceof Map ? value.tagDescriptions : new Map();
  }

  render(xmlDocument) {
    this._container.innerHTML = "";

    if (!(xmlDocument instanceof Document) || !xmlDocument.documentElement) {
      return;
    }

    this._container.appendChild(this._renderNode(xmlDocument.documentElement));
  }

  _renderNode(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      return this._renderElement(node);
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return this._renderText(node);
    }

    return document.createDocumentFragment();
  }

  _renderElement(element) {
    const errors = element.validationErrors || [];
    const wrapper = document.createElement("div");
    wrapper.className = "xml-code";

    const tag = document.createElement("span");
    tag.className = "xml-tag";

    if (errors.length > 0) {
      tag.classList.add('validation-error');
      
      // Create tooltip
      const tooltip = document.createElement("div");
      tooltip.className = "validation-tooltip";
      tooltip.innerHTML = this._buildTooltipHTML(errors);
      wrapper.appendChild(tooltip);
      
      // Add hover handlers
      tag.addEventListener("mouseenter", () => {
        tooltip.classList.add("show");
      });
      tag.addEventListener("mouseleave", () => {
        tooltip.classList.remove("show");
      });
    }

    const isEmpty = element.childNodes.length === 0;
    tag.appendChild(document.createTextNode("<"));
    tag.appendChild(this._tagNameSpan(element.localName, { showIndicator: true }));
    this._appendAttributes(tag, element.attributes);

    if (isEmpty) {
      tag.appendChild(document.createTextNode("/>"));
      wrapper.appendChild(tag);
      return wrapper;
    }

    tag.appendChild(document.createTextNode(">"));
    wrapper.appendChild(tag);

    for (const child of element.childNodes) {
      wrapper.appendChild(this._renderNode(child));
    }

    return wrapper;
  }

  _appendAttributes(parent, attributes) {
    for (const attr of attributes) {
      parent.appendChild(document.createTextNode(" "));

      const attrName = document.createElement("span");
      attrName.className = "xml-attr-name";
      attrName.textContent = attr.name;
      parent.appendChild(attrName);

      parent.appendChild(document.createTextNode('="'));

      const attrVal = document.createElement("span");
      attrVal.className = "xml-attr-val";
      attrVal.textContent = attr.value;
      this._describeEnumValue(attr.value, attrVal);
      parent.appendChild(attrVal);

      parent.appendChild(document.createTextNode('"'));
    }
  }

  _renderText(node) {
    const fragment = document.createDocumentFragment();
    const text = node.textContent ?? "";

    if (text.length > 0) {
      const value = document.createElement("span");
      value.className = "xml-text";
      value.textContent = text;
      fragment.appendChild(value);
      this._describeEnumValue(text, fragment);
    }

    return fragment;
  }

  _tagNameSpan(name, options = {}) {
    const showIndicator = options.showIndicator !== false;
    const tagName = document.createElement("span");
    tagName.className = "xml-tag-name";
    tagName.textContent = name;

    const description = this._describeTag(name);
    if (description) {
      tagName.title = description;
      tagName.classList.add("has-doc");

      if (showIndicator) {
        const withIndicator = document.createElement("span");
        withIndicator.append(tagName, this._docIndicatorSpan());
        withIndicator.title = description;
        return withIndicator;
      }
    }

    return tagName;
  }

  _docIndicatorSpan() {
    const indicator = document.createElement("span");
    indicator.className = "xml-tag-doc-indicator";
    indicator.setAttribute("aria-hidden", "true");
    indicator.textContent = "i";
    return indicator;
  }

  _describeEnumValue(value, tag) {
    const description = this._enumDescriptions.get(value.trim());
    if (description) {
      const comment = document.createElement("span");
      comment.className = "schema-documentation";
      comment.textContent = ` (${description})`;
      tag.appendChild(comment);
    }
  }

  _describeTag(name) {
    return this._tagDescriptions.get(name) || this._tagDescriptions.get(name.split(":").pop()) || "";
  }

  _buildTooltipHTML(errors) {
    const title = `<div class="validation-tooltip-title">Validation Errors (${errors.length})</div>`;
    const items = errors.map(error => {
      const code = error.code ? `<div class="validation-error-code">${this._escapeHtml(error.code)}</div>` : "";
      const message = error.details ? `<div class="validation-error-message">${this._escapeHtml(error.details)}</div>` : "";
      return `<div class="validation-error-item">${code}${message}</div>`;
    }).join("");
    return title + items;
  }

  _escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define("xml-outline", XMLOutline);