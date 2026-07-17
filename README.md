# OECD GIR File Viewer and Validator

An online viewer and validator for [GloBE Information Return (GIR)](https://www.oecd.org/en/topics/sub-issues/global-minimum-tax/global-anti-base-erosion-model-rules-pillar-two.html) XML files as defined by the [OECD](https://www.oecd.org/). These XML files are the standardized digital filing and exchange format used for reporting under the _Pillar Two Global Minimum Tax (GloBE)_ rules.

The latest version is deployed at [https://gir.tax/](https://gir.tax/).

Documents are checked against the GIR XML schema as well as the [semantic validation rules](https://gir.tax/rules/) defined by the OECD.

## Usage and Functionality

Open a document on the *File* tab by dropping it there or by using the *Import* button. Both GIR XML files and a simple CSV representation of the same element tree are accepted; a CSV is converted to GIR XML on import. If you have no document at hand, the *File* tab offers a few example documents — passing and failing ones — that load with a single click.

The document is then validated and the following views become available:

* **XML:** Shows the XML outline with additional documentation like definitions of the `GIRnnnn` enum constants. Elements with validation problems are marked directly in the outline and show the corresponding error messages on hover.
* **Jurisdictions:** Per-jurisdiction overview of GloBE income, covered taxes, ETR, and top-up tax, expandable to the detailed calculation, collection mechanisms, and entity contributions.
* **Corporate Structure:** Graphical representation of the corporate structure and ownerships.
* **Validation:** Detailed validation results, error messages, and an option to export the validation result as a *Status Message XML* document.

The *File* tab also provides an *Export XML* button to download the imported document, which is useful to obtain the GIR XML generated from a CSV import.

The example documents are also available in the [`examples/`](examples/) folder.

## How It Works

The application is a fully client-side static web app: all parsing, schema validation, rule checking, and rendering happen in the browser, so the data of an opened GIR file never leaves the user's machine. There is no backend, and an imported document is never uploaded anywhere.

This is possible because both validation stages run locally:

* **Schema validation** uses [xmllint-wasm](https://github.com/noppa/xmllint-wasm) against the official OECD schemas in [`schemas/`](schemas/), which are shipped with the application.
* **Rule validation** is generated from [`gir-rules/rules.yaml`](gir-rules/rules.yaml) into a JavaScript module at build time and evaluated by [`app/ruleeval.js`](app/ruleeval.js), a port of the reference interpreter [`gir-rules/rule_eval.py`](gir-rules/rule_eval.py). Both interpreters read the same rule definitions, so the browser enforces exactly what the Python test suite pins down.

The user interface is built from framework-free custom elements in [`app/components/`](app/components/); the corporate structure graph is the only view that relies on a third-party UI library ([Cytoscape](https://js.cytoscape.org/)).

## Local Development and Execution

Local development requires the following standard tools:

* [git](https://git-scm.com/install/)
* [Node.js](https://nodejs.org/en/download)
* [Python](https://www.python.org/downloads/) (for rule testing only)

Also an IDE of your choice like [VS Code](https://code.visualstudio.com/docs/setup/setup-overview) is helpful to work on the project.

Then clone the source code from this repository:

```bash
git clone https://github.com/marchof/gir.tax.git
cd gir.tax
```

Install JavaScript dependencies and start a local web server:

```bash
npm install
npm run dev
```

Now you can use the application at http://localhost:8080/ — it rebuilds and serves the `dist/` folder whenever a source file changes.

## Self-Hosting

Hosting your own copy of the application keeps the guarantee described above under your control.

Build the static bundle:

```bash
git clone https://github.com/marchof/gir.tax.git
cd gir.tax
npm install
npm run build
```

This produces a self-contained `dist/` folder. Serve it with any static web server; no application runtime is required on the server. Make sure the web server returns the correct MIME type for every file type used by the application:

| File ending | MIME type          |
| ----------- | ------------------ |
| `.html`     | `text/html`        |
| `.ico`      | `image/x-icon`     |
| `.js`       | `text/javascript`  |
| `.mjs`      | `text/javascript`  |
| `.svg`      | `image/svg+xml`    |
| `.wasm`     | `application/wasm` |
| `.xml`      | `application/xml`  |
| `.xsd`      | `application/xml`  |

## Authors

The project was created and is maintained by [@marchof](https://github.com/marchof) and [@svpetersen](https://github.com/svpetersen/).

## OECD Sources and Schema Attribution

The implementation is based on the following publications and includes the corresponding XML schema definitions.

1. OECD (2025), GloBE Information Return (Pillar Two) XML Schema: User Guide for Tax Administrations, OECD Publishing, Paris, https://doi.org/10.1787/c594935a-en.
1. OECD (2025), GloBE Information Return (Pillar Two) Status Message XML Schema: User Guide for Tax Administrations, OECD Publishing, Paris, https://doi.org/10.1787/449e3cc3-en.

This work is made available under the Creative Commons Attribution 4.0 International license.

## Copyright and License

Copyright (C) 2026 Mountainminds GmbH & Co. KG

This project is dual-licensed.

### Open Source License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation under the terms of GPL version 3.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the [GNU General Public License](LICENSE.md) for more details.

### Commercial License

This software is also available under separate commercial license terms from Mountainminds GmbH & Co. KG if you wish to use this software under terms other than the GNU General Public License, including for proprietary or closed-source applications.

Unless otherwise agreed in writing, the GPL version 3 license terms apply to all use, modification, and distribution of this software.

## Hosted Service Terms

Mountainminds GmbH & Co. KG may make this software available under [https://gir.tax/](https://gir.tax/) as a publicly accessible free online service.

Access to and use of the hosted service is provided on an "AS IS" and "AS AVAILABLE" basis, without warranties of any kind, whether express or implied, including but not limited to warranties of data security, availability, reliability, merchantability, fitness for a particular purpose, or non-infringement.

Mountainminds GmbH & Co. KG does not guarantee that the hosted service will be uninterrupted, error-free, secure, or available at any particular time. The hosted service may be modified, suspended, or discontinued at any time without notice.

Use of the hosted service does not grant any rights beyond those expressly provided under the applicable software license or separate written agreement.