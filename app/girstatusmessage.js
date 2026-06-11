import { XMLSchema } from "./xmlschema.js";

const GIR_STATUS_SCHEMA = new XMLSchema("schemas/girstatus", "girstatusmessagexml_v1.0.xsd");

const CSM_NS = "urn:oecd:ties:csm:v2";

function compactIsoDateTime(value) {
  if (value instanceof Date) {
    return value.toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  return new Date(value).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function randomToken() {
  const randomPart = Math.random().toString(36).slice(2, 10).toUpperCase();
  const timestampPart = Date.now().toString(36).toUpperCase();
  return `${timestampPart}${randomPart}`;
}

function defaultMessageRefId() {
  return `GIR-STATUS-${randomToken()}`;
}

function asArray(value) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function appendElement(parent, name, textValue) {
  const doc = parent.ownerDocument;
  const node = doc.createElementNS(CSM_NS, `csm:${name}`);

  if (textValue !== undefined && textValue !== null) {
    node.textContent = String(textValue);
  }

  parent.appendChild(node);
  return node;
}

function appendErrorNode(parent, error, nodeName) {
  const errorNode = appendElement(parent, nodeName);
  appendElement(errorNode, "Code", error.code);

  if (error.details) {
    const detailsNode = appendElement(errorNode, "Details", error.details);
    if (error.language) {
      detailsNode.setAttribute("Language", error.language);
    }
  }

  for (const docRefId of asArray(error.docRefIds).filter(Boolean)) {
    appendElement(errorNode, "DocRefIDInError", docRefId);
  }

  for (const fieldPath of asArray(error.fieldPaths).filter(Boolean)) {
    const fieldsInError = appendElement(errorNode, "FieldsInError");
    appendElement(fieldsInError, "FieldPath", fieldPath);
  }
}

export class GirStatusMessage {
  constructor(options = {}) {
    const validatedBy = options.validatedBy || "oecd-gir-viewer";

    this.messageSpec = {
      sendingEntityIN: options.sendingEntityIN || "",
      transmittingCountry: options.transmittingCountry || "FR",
      receivingCountry: options.receivingCountry || "FR",
      warning: options.warning || "",
      contact: options.contact || "",
      messageRefId: options.messageRefId || defaultMessageRefId(),
      messageTypeIndic: options.messageTypeIndic || "",
      corrMessageRefIds: asArray(options.corrMessageRefIds),
      reportingPeriod: options.reportingPeriod || "",
      timestamp: options.timestamp || new Date(),
    };

    this.originalMessage = {
      originalMessageRefId: options.originalMessageRefId || "",
      fileMetaData: options.fileMetaData || null,
    };

    this.validationResult = {
      validatedBy: asArray(validatedBy).filter(Boolean),
    };

    if (this.validationResult.validatedBy.length === 0) {
      this.validationResult.validatedBy.push("oecd-gir-viewer");
    }

    this.fileErrors = [];
    this.recordErrors = [];
  }

  setOriginalMessageRefId(value) {
    this.originalMessage.originalMessageRefId = value || "";
  }

  addRecordValidationError(error) {
    const normalizedError = {
      code: error.code,
      details: error.details,
      language: "EN",
      docRefIds: asArray(error.docRefIds),
      fieldPaths: asArray(error.fieldPaths),
    };

    this.recordErrors.push(normalizedError);
  }

  addFileValidationError(details) {
    const normalizedError = {
      code: "50007",
      details: details,
      language: "EN",
      docRefIds: [],
      fieldPaths: [],
    };

    this.fileErrors.push(normalizedError);
  }

  get status() {
    return this.errorCount > 0 ? "Rejected" : "Accepted";
  }

  get errorCount() {
    return this.fileErrors.length + this.recordErrors.length;
  }

  toValidationModel() {
    return {
      messageRefId: this.messageSpec.messageRefId,
      status: this.status,
      errorCount: this.errorCount,
      fileErrors: [...this.fileErrors],
      recordErrors: [...this.recordErrors],
      validatedBy: [...this.validationResult.validatedBy],
      timestamp: compactIsoDateTime(this.messageSpec.timestamp),
    };
  }

  toXmlString() {
    const doc = document.implementation.createDocument(CSM_NS, "csm:GIRStatusMessage_OECD", null);
    const root = doc.documentElement;
    root.setAttribute("version", "1.0");

    const messageSpec = appendElement(root, "MessageSpec");
    if (this.messageSpec.sendingEntityIN) {
      appendElement(messageSpec, "SendingEntityIN", this.messageSpec.sendingEntityIN);
    }
    appendElement(messageSpec, "TransmittingCountry", this.messageSpec.transmittingCountry);
    appendElement(messageSpec, "ReceivingCountry", this.messageSpec.receivingCountry);
    appendElement(messageSpec, "MessageType", "GIRMessageStatus");
    if (this.messageSpec.warning) {
      appendElement(messageSpec, "Warning", this.messageSpec.warning);
    }
    if (this.messageSpec.contact) {
      appendElement(messageSpec, "Contact", this.messageSpec.contact);
    }
    appendElement(messageSpec, "MessageRefId", this.messageSpec.messageRefId);
    if (this.messageSpec.messageTypeIndic) {
      appendElement(messageSpec, "MessageTypeIndic", this.messageSpec.messageTypeIndic);
    }
    for (const corrMessageRefId of this.messageSpec.corrMessageRefIds) {
      appendElement(messageSpec, "CorrMessageRefId", corrMessageRefId);
    }
    if (this.messageSpec.reportingPeriod) {
      appendElement(messageSpec, "ReportingPeriod", this.messageSpec.reportingPeriod);
    }
    appendElement(messageSpec, "Timestamp", compactIsoDateTime(this.messageSpec.timestamp));

    const girStatusMessage = appendElement(root, "GIRStatusMessage");

    const originalMessage = appendElement(girStatusMessage, "OriginalMessage");
    if (this.originalMessage.originalMessageRefId) {
      appendElement(originalMessage, "OriginalMessageRefID", this.originalMessage.originalMessageRefId);
    }

    if (this.originalMessage.fileMetaData) {
      const fileMetaData = appendElement(originalMessage, "FileMetaData");
      if (this.originalMessage.fileMetaData.ctsTransmissionId) {
        appendElement(fileMetaData, "CTSTransmissionID", this.originalMessage.fileMetaData.ctsTransmissionId);
      }
      if (this.originalMessage.fileMetaData.ctsSendingTimestamp) {
        appendElement(fileMetaData, "CTSSendingTimeStamp", compactIsoDateTime(this.originalMessage.fileMetaData.ctsSendingTimestamp));
      }
      if (this.originalMessage.fileMetaData.uncompressedFileSizeKBQty !== undefined) {
        appendElement(fileMetaData, "UncompressedFileSizeKBQty", this.originalMessage.fileMetaData.uncompressedFileSizeKBQty);
      }
    }

    const validationErrors = appendElement(girStatusMessage, "ValidationErrors");
    for (const error of this.fileErrors) {
      appendErrorNode(validationErrors, error, "FileError");
    }
    for (const error of this.recordErrors) {
      appendErrorNode(validationErrors, error, "RecordError");
    }

    const validationResult = appendElement(girStatusMessage, "ValidationResult");
    appendElement(validationResult, "Status", this.status);
    for (const value of this.validationResult.validatedBy) {
      appendElement(validationResult, "ValidatedBy", value);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(doc)}`;
  }

  async exportValidatedXml(fileName = "girstatusmessage.xml") {
    const xml = this.toXmlString();
    const validationResult = await GIR_STATUS_SCHEMA.validate(xml, fileName);

    if (!validationResult.valid) {
      throw new Error(validationResult.rawOutput || "Generated GIR status message is not schema valid.");
    }

    return xml;
  }
}
