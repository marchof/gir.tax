# OECD GIR File Viewer and Validator

An online viewer and validator for [GloBE Information Return (GIR)](https://www.oecd.org/en/topics/sub-issues/global-minimum-tax/global-anti-base-erosion-model-rules-pillar-two.html) XML files as defined by the [OECD](https://www.oecd.org/). These XML files are the standardized digital filing and exchange format used for reporting under the _Pillar Two Global Minimum Tax (GloBE)_ rules.

The latest version is deployed at https://gir.tax/.

See folder [`gir-rules/`](gir-rules/) for details about the current implementation approach and status of document validation rules.

## Usage and Functionality

Open a GIR XML file on the *File* tab by dropping it there or use the *Import* button. The file is then validated against the GIR XML schema and the GIR rule set. Currently the following views are available:

* **XML:** Shows the XML outline with additional documentation like definitions of the `GIRnnnn` enum constants.
* **Corporate Structure:** Graphical representation of the corporate structure and ownerships.
* **Validation:** Detailed validation results, error messages, and an option to export the validation result as a *Status Message XML* document.

You may test some example documents from the [`examples/`](examples/) folder.

## Data Processing and Security

This tool is designed to process your data locally and does not intentionally upload file contents. No guarantees are provided about security. Please use at your own risk or deploy your own local version.

## Local Development and Execution

Local development requires the following standard tools:

* [git](https://git-scm.com/install/)
* [npm](https://nodejs.org/en/download)
* [Python](https://www.python.org/downloads/)

Also an IDE of your choice like [VS Code](https://code.visualstudio.com/docs/setup/setup-overview) is helpful to work on the project.

Then clone the source code from this repository:

```bash
git clone https://github.com/marchof/gir.tax.git
cd gir.tax
```

Generate the GIR rules for JavaScript:

```bash
cd gir-rules
source setup_venv.sh
python3 generatejs.py
cd ..
```

Install JavaScript dependencies and start a local web server:

```bash
npm install
npm run dev
```

Now you can use the application under http://localhost:8080/

## Authors

The project was created and is maintained by @marchof and @svpetersen.

## OECD Sources and Schema Attribution

The implementation is based on the following publications and includes the corresponding XML schema definitions.

1. OECD (2025), GloBE Information Return (Pillar Two) XML Schema: User Guide for Tax Administrations, OECD Publishing, Paris, https://doi.org/10.1787/c594935a-en.
1. OECD (2025), GloBE Information Return (Pillar Two) Status Message XML Schema: User Guide for Tax Administrations,
OECD Publishing, Paris, https://doi.org/10.1787/449e3cc3-en.

This work is made available under the Creative Commons Attribution 4.0 International licence.

## Copyright and License

Copyright (C) 2026 Mountainminds GmbH & Co. KG

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation under the terms of GPL version 3.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
[GNU General Public License](LICENSE.md) for more details.
