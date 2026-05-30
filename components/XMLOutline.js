const GIR_ENUMS = new Map([
  ["GIR101", "The message only contains new information"],
  ["GIR102", "The message contains corrections/deletions for previously sent information"],
  ["GIR103", "The message advises there is no data to report"],
]);

class XMLOutline extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        div.xml-code {
          font-family: monospace;
          background: #f8f9fa;
          border-radius: 5px;
          padding-left: 20px;
          line-height: 1.7;
        }

        .xml-tag {
          color: #aaa;
          background: #e0e0e0;
          padding: 2px 4px;
          border-radius: 4px;
          margin: 2px;
        }

        .xml-tag-name {
          color: #9966ff;
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

        .xml-comment {
          color: #888;
          font-style: italic;
        }
      </style>
      <div class="xml-code" part="container"></div>
    `;

    this._container = this.shadowRoot.querySelector(".xml-code");
  }

  set xmlDocument(value) {
    this.render(value);
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

    if (node.nodeType === Node.COMMENT_NODE) {
      return this._renderComment(node);
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
    tag.appendChild(this._tagNameSpan(element.tagName));
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

    const closeTag = document.createElement("span");
    closeTag.className = "xml-tag";
    closeTag.appendChild(document.createTextNode("</"));
    closeTag.appendChild(this._tagNameSpan(element.tagName));
    closeTag.appendChild(document.createTextNode(">"));
    wrapper.appendChild(closeTag);

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
    }

    const description = GIR_ENUMS.get(text.trim());
    if (description) {
      const commentWrapper = document.createElement("div");
      commentWrapper.className = "xml-code";

      const comment = document.createElement("span");
      comment.className = "xml-comment";
      comment.textContent = `<!-- ${description} -->`;
      commentWrapper.appendChild(comment);

      fragment.appendChild(commentWrapper);
    }

    return fragment;
  }

  _renderComment(node) {
    const wrapper = document.createElement("div");
    wrapper.className = "xml-code";

    const comment = document.createElement("span");
    comment.className = "xml-comment";
    comment.textContent = `<!--${node.textContent ?? ""}-->`;
    wrapper.appendChild(comment);

    return wrapper;
  }

  _tagNameSpan(name) {
    const tagName = document.createElement("span");
    tagName.className = "xml-tag-name";
    tagName.textContent = name;
    return tagName;
  }
}

customElements.define("xml-outline", XMLOutline);