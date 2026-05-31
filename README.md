# OECD GIR File Viewer and Validator

Simple online viewer and validator for [GloBE Information Return (GIR)](https://www.oecd.org/en/topics/sub-issues/global-minimum-tax/global-anti-base-erosion-model-rules-pillar-two.html) XML files as defined by the [OECD](https://www.oecd.org/). These XML files are the standardized digital filing and exchange format used for reporting under the _Pillar Two Global Minimum Tax (GloBE)_ rules.

The latest version is deployed at https://gir.tax/

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