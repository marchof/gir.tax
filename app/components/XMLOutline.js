
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
        }

        div.xml-code {
          display: table;
          font-family: monospace;
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
          border-left: 1px solid #e0e0e0;
          border-bottom: 1px solid #e0e0e0;
        }

        div.xml-code:not(:has(div.xml-code:hover)):hover {
          background: #f8f8f8;
          border-color: #d8d8d8;
        }

        .xml-tag {
          color: #aaa;
          background: #e0e0e0;
          padding: 2px 4px;
          border-radius: 4px;
          margin-right: 4px;
          transition: background-color 120ms ease;
        }

        div.xml-code:not(:has(div.xml-code:hover)):hover > .xml-tag {
          background: #d8d8d8;
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
          color: #000;
        }

        .schema-documentation {
          color: #888;
          font-family: sans-serif;
          font-style: italic;
          font-size: 80%;
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
    const wrapper = document.createElement("div");
    wrapper.className = "xml-code";

    const tag = document.createElement("span");
    tag.className = "xml-tag";

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
}

customElements.define("xml-outline", XMLOutline);