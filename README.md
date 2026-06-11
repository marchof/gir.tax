# OECD GIR File Viewer and Validator

An online viewer and validator for [GloBE Information Return (GIR)](https://www.oecd.org/en/topics/sub-issues/global-minimum-tax/global-anti-base-erosion-model-rules-pillar-two.html) XML files as defined by the [OECD](https://www.oecd.org/). These XML files are the standardized digital filing and exchange format used for reporting under the _Pillar Two Global Minimum Tax (GloBE)_ rules.

The latest version is deployed at [https://gir.tax/](https://gir.tax/).

See folder [`gir-rules/`](gir-rules/) for details about the current implementation approach and status of document validation rules.

## Usage and Functionality

Open a GIR XML file on the *File* tab by dropping it there or use the *Import* button. The file is then validated against the GIR XML schema and the GIR rule set. Currently the following views are available:

* **XML:** Shows the XML outline with additional documentation like definitions of the `GIRnnnn` enum constants.
* **Corporate Structure:** Graphical representation of the corporate structure and ownerships.
* **Validation:** Detailed validation results, error messages, and an option to export the validation result as a *Status Message XML* document.

You may test some example documents from the [`examples/`](examples/) folder.

## Local Development and Execution

Local development requires the following standard tools:

* [git](https://git-scm.com/install/)
* [npm](https://nodejs.org/en/download)
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

Now you can use the application under http://localhost:8080/

## Authors

The project was created and is maintained by [@marchof](https://github.com/marchof) and [@svpetersen](https://github.com/svpetersen/).

## OECD Sources and Schema Attribution

The implementation is based on the following publications and includes the corresponding XML schema definitions.

1. OECD (2025), GloBE Information Return (Pillar Two) XML Schema: User Guide for Tax Administrations, OECD Publishing, Paris, https://doi.org/10.1787/c594935a-en.
1. OECD (2025), GloBE Information Return (Pillar Two) Status Message XML Schema: User Guide for Tax Administrations,
OECD Publishing, Paris, https://doi.org/10.1787/449e3cc3-en.

This work is made available under the Creative Commons Attribution 4.0 International licence.

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