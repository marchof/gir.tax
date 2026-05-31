# OECD GIR File Viewer and Validator

Simple online viewer and validator for [GloBE Information Return (GIR)](https://www.oecd.org/en/topics/sub-issues/global-minimum-tax/global-anti-base-erosion-model-rules-pillar-two.html) XML files as defined by the [OECD](https://www.oecd.org/). These XML files are the standardized digital filing and exchange format used for reporting under the _Pillar Two Global Minimum Tax (GloBE)_ rules.

The latest version is deployed at https://gir.tax/

* https://www.oecd.org/en/publications/globe-information-return-pillar-two-xml-schema_c594935a-en.html
https://www.oecd.org/en/publications/globe-information-return-pillar-two-status-message-xml-schema_449e3cc3-en.html

## Features

* [X] Validate if XML input is well formed
* [X] Validate if XML input complies with schema
* [X] Show XML errors
* [X] Show XML tree
* [X] Show description of elements in XML tree (tooltip), load from schema
* [X] Show definition of enums in XML tree, load from schema
* [X] Also accept CSV as input
* [x] Download XML (especially when created from CSV)
* [ ] Validate against additional GIR rules
* [ ] Download validation result as GIR Status Message XML
* [ ] Annotate GIR rule violations in XML tree
* [ ] Show List of all issues
* [ ] Show company structure as graph

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

## License

This tool is provided under the [MIT license](LICENSE.md).