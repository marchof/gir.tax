import { validateXML } from "xmllint-wasm";

const SCHEMA_BASE_PATH = "schemas";
const MAIN_SCHEMA_FILE = "globexml_v1.0.xsd";
const PRELOAD_SCHEMA_FILES = [
    "isoglobetypes_v1.1.xsd",
    "oecdglobetypes_v5.0.xsd",
];

async function loadSchema(fileName) {
    const response = await fetch(`${SCHEMA_BASE_PATH}/${fileName}`);
    if (!response.ok) {
        throw new Error(`Failed to load schema ${fileName} (${response.status})`);
    }

    return response.text();
}

export async function validate(xmlText, fileName = "input.xml") {
    const [mainSchema, ...preloadSchemas] = await Promise.all([
        loadSchema(MAIN_SCHEMA_FILE),
        ...PRELOAD_SCHEMA_FILES.map(loadSchema),
    ]);

    return validateXML({
        xml: [{ fileName, contents: xmlText }],
        schema: [{ fileName: MAIN_SCHEMA_FILE, contents: mainSchema }],
        preload: PRELOAD_SCHEMA_FILES.map((schemaFile, index) => ({
            fileName: schemaFile,
            contents: preloadSchemas[index],
        })),
    });
}

