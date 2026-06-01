# OECD GIR File Viewer and Validator

A online viewer and validator for [GloBE Information Return (GIR)](https://www.oecd.org/en/topics/sub-issues/global-minimum-tax/global-anti-base-erosion-model-rules-pillar-two.html) XML files as defined by the [OECD](https://www.oecd.org/). These XML files are the standardized digital filing and exchange format used for reporting under the _Pillar Two Global Minimum Tax (GloBE)_ rules.

The latest version is deployed at https://gir.tax/.

## Open Tasks

* [X] Validate if XML input is well formed
* [X] Validate if XML input complies with schema
* [X] Show XML errors
* [X] Show XML tree
* [X] Show description of elements in XML tree (tooltip), load from schema
* [X] Show definition of enums in XML tree, load from schema
* [X] Also accept CSV as input
* [X] Download XML (especially when created from CSV)
* [X] Show company structure as graph (element CorporateStructure)
* [ ] Validate against additional GIR rules
* [ ] Download validation result as GIR Status Message XML
* [ ] Annotate GIR rule violations in XML tree
* [ ] Show list of all issues

## Usage

TODO

## Data Processing and Security

TODO

## Local Development and Execution

Local development requires the tools [git](https://git-scm.com/install/) and [npm](https://nodejs.org/en/download). Also an IDE of your choice like [VS Code](https://code.visualstudio.com/docs/setup/setup-overview) is helpful to work on the project.

Then clone the source code from this repository:

```bash
git clone https://github.com/marchof/gir.tax.git
cd gir.tax
```

Install dependencies and start a local web server:

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
