import { validateXML } from "xmllint-wasm";

const SCHEMA_BASE_PATH = "schemas";
const SCHEMA_FILES = [
    "globexml_v1.0.xsd",
    "isoglobetypes_v1.1.xsd",
    "oecdglobetypes_v5.0.xsd",
];

async function loadSchema(fileName) {
    const response = await fetch(`${SCHEMA_BASE_PATH}/${fileName}`);
    const contents = await response.text();
    return { fileName, contents};
}

export async function validate(xmlText, fileName = "input.xml") {
    const schemas = await Promise.all(SCHEMA_FILES.map(loadSchema));

    return validateXML({
        xml: [{ fileName, contents: xmlText }],
        schema: schemas.slice(0, 1),
        preload: schemas.slice(1)
    });
}

