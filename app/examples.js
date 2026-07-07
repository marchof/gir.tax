// Curated example documents shipped with the app so a user can try the viewer
// without providing her own file. The referenced files are copied into
// `dist/examples/` by `scripts/build.js`; `url` is the path they are served
// from, relative to the app root. `label` is the short text shown in the file
// drop widget; `expected` is a hover hint describing the outcome.
export const EXAMPLES = [
  {
    url: "examples/globe-positive-gir-example-bzst.xml",
    name: "globe-positive-gir-example-bzst.xml",
    label: "BZSt example",
    expected: "Accepted — the official BZSt example dataset; passes the schema and all GIR rules.",
  },
  {
    url: "examples/globe-positive-alpenkrone.xml",
    name: "globe-positive-alpenkrone.xml",
    label: "Alpenkrone Holding AG",
    expected: "Accepted — a fictional multinational group; passes the schema and all GIR rules.",
  },
  {
    url: "examples/globe-negative-rule-violation.xml",
    name: "globe-negative-rule-violation.xml",
    label: "GIR rule violation",
    expected: "Rejected — schema-valid, but a GIR business rule fails.",
  },
];
