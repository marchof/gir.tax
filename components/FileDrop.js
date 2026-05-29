class FileDrop extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });
		this._dragDepth = 0;

		this.shadowRoot.innerHTML = `
			<style>
				:host {
					display: block;
				}

				.drop-zone {
					border: 2px dashed #ccc;
					border-radius: 15px;
					padding: 40px;
					text-align: center;
					color: #999;
					transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
				}

				.drop-zone:hover {
					border-color: #aaa;
					color: #666;
				}

				.drop-zone.is-over {
					background-color: #f0f0f0;
					border-color: #888;
					color: #555;
				}

				.label {
					pointer-events: none;
				}

                .warning {
                    font-size: 0.8em;
                    margin-top: 10px;
                    color: #bbb;
                    font-weight: bold;
                }
                .warning-details {
                    font-size: 0.8em;
                    margin-top: 10px;
                    color: #bbb;
                }

				::slotted(*) {
					pointer-events: none;
				}
			</style>

			<div class="drop-zone" part="drop-zone" role="button" aria-label="File drop area">
				<div class="label">
                    <slot></slot>
                    <div class="warning">
                        Never upload sensitive or confidential data to a random internet site.
                    </div>
                    <div class="warning-details">
                        This Tool is designed to process your data locally and does not
                        intentionally upload file contents. No guarantees are provided about
                        security. Use at your own risk.
                    </div>
                </div>
			</div>
		`;

		this._dropZone = this.shadowRoot.querySelector(".drop-zone");
		this._onDragOver = this._onDragOver.bind(this);
		this._onDragEnter = this._onDragEnter.bind(this);
		this._onDragLeave = this._onDragLeave.bind(this);
		this._onDrop = this._onDrop.bind(this);
	}

	connectedCallback() {
		this.addEventListener("dragover", this._onDragOver);
		this.addEventListener("dragenter", this._onDragEnter);
		this.addEventListener("dragleave", this._onDragLeave);
		this.addEventListener("drop", this._onDrop);
	}

	disconnectedCallback() {
		this.removeEventListener("dragover", this._onDragOver);
		this.removeEventListener("dragenter", this._onDragEnter);
		this.removeEventListener("dragleave", this._onDragLeave);
		this.removeEventListener("drop", this._onDrop);
	}

	_onDragOver(event) {
		event.preventDefault();
	}

	_onDragEnter(event) {
		event.preventDefault();
		this._dragDepth += 1;
		this._dropZone.classList.add("is-over");
	}

	_onDragLeave(event) {
		event.preventDefault();
		this._dragDepth = Math.max(0, this._dragDepth - 1);
		if (this._dragDepth === 0) {
			this._dropZone.classList.remove("is-over");
		}
	}

	_onDrop(event) {
		event.preventDefault();
		this._dragDepth = 0;
		this._dropZone.classList.remove("is-over");

		const files = event.dataTransfer?.files;
		if (!files || files.length === 0) {
			return;
		}

		this.dispatchEvent(
			new CustomEvent("filedropped", {
				detail: {
					file: files[0],
					files,
				},
				bubbles: false,
				composed: true,
			})
		);
	}
}

customElements.define("file-drop", FileDrop);
