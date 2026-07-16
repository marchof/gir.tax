function childElements(element, localName) {
  return Array.from(element?.children || []).filter(child => child.localName === localName);
}

function firstChild(element, localName) {
  return childElements(element, localName)[0] || null;
}

function textOfChild(element, localName) {
  return firstChild(element, localName)?.textContent?.trim() || "";
}

// Namespace-agnostic search for the first descendant with the given local name.
// The GIR XML uses prefixed element names (globe:, stf:), so matching on localName
// keeps this independent of how the document declares its namespaces.
function firstDescendant(element, localName) {
  if (!element) {
    return null;
  }

  for (const node of element.getElementsByTagName("*")) {
    if (node.localName === localName) {
      return node;
    }
  }

  return null;
}

function descendants(element, localName) {
  if (!element) {
    return [];
  }

  return Array.from(element.getElementsByTagName("*")).filter(node => node.localName === localName);
}

const amountFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const regionNames = typeof Intl !== "undefined" && Intl.DisplayNames
  ? new Intl.DisplayNames(["en"], { type: "region" })
  : null;

// The GloBE minimum effective tax rate (15%) is a fixed rule input, not a value
// reported in the GIR, so it is shown as a constant reference in the calculation.
const MINIMUM_RATE = 0.15;

// Resolve an ISO 3166-1 alpha-2 jurisdiction code to its English name, falling back
// to the raw code for anything that isn't a resolvable two-letter code.
function jurisdictionName(code) {
  const upper = (code || "").toUpperCase();
  if (regionNames && /^[A-Z]{2}$/.test(upper)) {
    try {
      const name = regionNames.of(upper);
      if (name && name !== upper) {
        return name;
      }
    } catch {
      // Malformed code: fall through to the raw value.
    }
  }

  return code || "";
}

function parseNumber(rawValue) {
  const value = Number.parseFloat(rawValue ?? "");
  return Number.isFinite(value) ? value : null;
}

function numberOfChild(element, localName) {
  return element ? parseNumber(textOfChild(element, localName)) : null;
}

function formatAmount(rawValue) {
  const value = parseNumber(rawValue);
  return value === null ? null : amountFormatter.format(value);
}

function formatPercentage(rawValue) {
  const value = parseNumber(rawValue);
  if (value === null) {
    return null;
  }

  const percentage = value * 100;
  return `${Number.isInteger(percentage) ? percentage.toFixed(0) : percentage.toFixed(1)}%`;
}

// Count constituent entities resident in each jurisdiction from the CorporateStructure,
// keyed by ResCountryCode. This is the canonical per-jurisdiction entity list; the
// ETR computation's CEComputation blocks are absent for safe-harbour jurisdictions,
// so they can't be used as a reliable count.
function countEntitiesByJurisdiction(xmlDocument) {
  const counts = new Map();
  const corporateStructure = firstDescendant(xmlDocument, "CorporateStructure");
  if (!corporateStructure) {
    return counts;
  }

  const entityElements = childElements(corporateStructure, "UPE").concat(childElements(corporateStructure, "CE"));
  entityElements.forEach(entityElement => {
    const country = firstDescendant(entityElement, "ResCountryCode")?.textContent?.trim();
    if (country) {
      counts.set(country, (counts.get(country) || 0) + 1);
    }
  });

  return counts;
}

// Map each entity's TIN to its name/residence from the CorporateStructure, so covered
// entities and IIR parent entities can be shown by name rather than bare tax numbers.
function buildTinDirectory(xmlDocument) {
  const directory = new Map();
  const corporateStructure = firstDescendant(xmlDocument, "CorporateStructure");
  if (!corporateStructure) {
    return directory;
  }

  const register = identityElement => {
    if (!identityElement) {
      return;
    }
    const tin = textOfChild(identityElement, "TIN");
    if (!tin || tin.toUpperCase() === "NOTIN" || directory.has(tin)) {
      return;
    }
    directory.set(tin, {
      name: textOfChild(identityElement, "Name"),
      country: textOfChild(identityElement, "ResCountryCode"),
    });
  };

  childElements(corporateStructure, "UPE").forEach(upe => {
    const wrapper = firstChild(upe, "OtherUPE") || firstChild(upe, "ExcludedUPE");
    register(firstChild(wrapper, "ID") || firstChild(upe, "ID"));
  });
  childElements(corporateStructure, "CE").forEach(ce => register(firstChild(ce, "ID")));

  return directory;
}

function extractEntityContributions(etrComputation, tinDirectory, describeCode) {
  return childElements(etrComputation, "CEComputation").map(ce => {
    const tin = textOfChild(ce, "TIN");
    const entity = tinDirectory.get(tin);

    const adjustmentCodes = [
      ...descendants(firstChild(ce, "NetGlobeIncome"), "AdjustmentItem"),
      ...descendants(firstChild(ce, "AdjustedCoveredTax"), "AdjustmentItem"),
    ].map(node => node.textContent?.trim()).filter(Boolean);

    const adjustments = [...new Set(adjustmentCodes.map(describeCode))];

    const deferTax = firstDescendant(firstChild(ce, "AdjustedCoveredTax"), "DeferTaxAdjustAmt");
    const deferTaxExpense = numberOfChild(deferTax, "DeferTaxExpense");
    if (deferTaxExpense) {
      adjustments.push("Deferred tax adjustment");
    }

    return {
      name: entity?.name || (tin && tin.toUpperCase() !== "NOTIN" ? tin : "Unknown entity"),
      income: numberOfChild(firstChild(ce, "NetGlobeIncome"), "Total"),
      coveredTaxes: numberOfChild(firstChild(ce, "AdjustedCoveredTax"), "Total"),
      adjustments,
    };
  });
}

function extractCollection(section, overall, jurisdiction, tinDirectory) {
  const rows = [];

  const qdmtt = firstChild(overall, "QDMTT");
  if (qdmtt) {
    rows.push({
      mechanism: "QDMTT",
      collector: `${jurisdictionName(jurisdiction)} (domestic)`,
      amount: numberOfChild(qdmtt, "Amount"),
    });
  }

  descendants(firstDescendant(section, "LowTaxJurisdiction"), "ParentEntity").forEach(parent => {
    const tin = textOfChild(parent, "TIN");
    const country = textOfChild(parent, "ResCountryCode");
    const entity = tinDirectory.get(tin);
    const where = jurisdictionName(country) || country;
    const collector = entity?.name
      ? `${entity.name}${where ? ` (${where})` : ""}`
      : `Parent entity${where ? ` in ${where}` : ""}`;
    rows.push({
      mechanism: "IIR",
      collector,
      amount: numberOfChild(parent, "TopUpTax"),
    });
  });

  const utpr = firstDescendant(section, "UTPR");
  if (utpr) {
    const calculation = firstChild(utpr, "UTPRCalculation");
    rows.push({
      mechanism: "UTPR",
      collector: "UTPR jurisdictions",
      amount: calculation ? numberOfChild(calculation, "TotalUTPRTopUpTax") : null,
    });
  }

  return rows;
}

function extractJurisdictionRows(xmlDocument, describeCode) {
  const jurisdictionSections = Array.from(xmlDocument.getElementsByTagName("*")).filter(
    node => node.localName === "JurisdictionSection"
  );

  const entityCounts = countEntitiesByJurisdiction(xmlDocument);
  const tinDirectory = buildTinDirectory(xmlDocument);

  return jurisdictionSections.map(section => {
    const jurisdiction = textOfChild(section, "Jurisdiction");
    const currency = textOfChild(section, "LocalCurrency");
    const overall = firstDescendant(section, "OverallComputation");
    const etrComputation = firstDescendant(section, "ETRComputation");
    const isSafeHarbour = !overall && !!firstDescendant(section, "ETRException");

    const topUpPercentage = overall ? parseNumber(textOfChild(overall, "TopUpTaxPercentage")) : null;
    const excessProfits = overall ? parseNumber(textOfChild(overall, "ExcessProfits")) : null;
    const initialTopUp =
      topUpPercentage !== null && excessProfits !== null ? Math.round(topUpPercentage * excessProfits) : null;

    const additionalContainer = overall ? firstChild(overall, "AdditionalTopUpTax") : null;
    const additionalTopUp = additionalContainer
      ? descendants(additionalContainer, "AdditionalTopUpTax").reduce((sum, node) => sum + (parseNumber(node.textContent) || 0), 0)
      : null;

    return {
      jurisdiction,
      currency,
      entities: entityCounts.get(jurisdiction) || 0,
      hasComputation: !!overall,
      isSafeHarbour,
      netGlobeIncome: overall ? numberOfChild(firstChild(overall, "NetGlobeIncome"), "Total") : null,
      coveredTaxes: overall ? numberOfChild(firstChild(overall, "AdjustedCoveredTax"), "Total") : null,
      etrRate: overall ? parseNumber(textOfChild(overall, "ETRRate")) : null,
      topUpPercentage,
      substanceExclusion: overall ? numberOfChild(firstChild(overall, "SubstanceExclusion"), "Total") : null,
      excessProfits,
      initialTopUp,
      additionalTopUp,
      domesticTopUp: overall ? numberOfChild(firstChild(overall, "QDMTT"), "Amount") : null,
      residualTopUp: overall ? parseNumber(textOfChild(overall, "TopUpTax")) : null,
      collection: overall ? extractCollection(section, overall, jurisdiction, tinDirectory) : [],
      entityRows: etrComputation ? extractEntityContributions(etrComputation, tinDirectory, describeCode) : [],
    };
  });
}

class JurisdictionSummaryTable extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._xmlDocument = null;
    this._schemaMetadata = null;
    this._expanded = new Set();
    this._onToggleClick = this._onToggleClick.bind(this);
  }

  connectedCallback() {
    this.render();
  }

  set xmlDocument(value) {
    this._xmlDocument = value;
    this._expanded = new Set();
    this.render();
  }

  get xmlDocument() {
    return this._xmlDocument;
  }

  set schemaMetadata(value) {
    this._schemaMetadata = value;
    this.render();
  }

  get schemaMetadata() {
    return this._schemaMetadata;
  }

  _describeCode(code) {
    return this._schemaMetadata?.enumDescriptions?.get(code) || code;
  }

  render() {
    if (!this.shadowRoot) {
      return;
    }

    let content;
    if (!(this._xmlDocument instanceof Document) || !this._xmlDocument.documentElement) {
      content = this._renderEmpty("No XML document is loaded.");
    } else {
      const rows = extractJurisdictionRows(this._xmlDocument, code => this._describeCode(code));
      content = rows.length === 0
        ? this._renderEmpty("No JurisdictionSection entries were found in this XML document.")
        : this._renderTable(rows);
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--font-ui);
          color: var(--color-ink);
        }

        .hint {
          color: var(--color-ink-soft);
          font-size: 0.85rem;
          margin: 0 0 0.75rem;
        }

        .table-scroll {
          overflow-x: auto;
          border: var(--border-card);
          border-radius: var(--radius-lg);
        }

        table {
          border-collapse: collapse;
          width: 100%;
          font-size: 0.9rem;
          font-variant-numeric: tabular-nums;
        }

        thead th {
          background: linear-gradient(180deg, #f7f9fb 0%, #eef2f6 100%);
          color: var(--color-ink-soft);
          font-size: 0.78rem;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          text-align: left;
          padding: 0.6rem 0.75rem;
          border-bottom: var(--border-card);
          white-space: nowrap;
        }

        tbody td,
        tfoot td {
          padding: 0.55rem 0.75rem;
          border-bottom: 1px solid var(--color-line);
        }

        th.numeric,
        td.numeric {
          text-align: right;
        }

        .jur-row {
          cursor: pointer;
        }

        .jur-row:hover {
          background: var(--color-surface-muted);
        }

        .jur-row:focus-visible {
          outline: none;
          box-shadow: inset 0 0 0 2px var(--color-accent);
        }

        .jurisdiction-cell {
          font-weight: 600;
          white-space: nowrap;
        }

        .caret {
          display: inline-block;
          width: 0.9em;
          margin-right: 0.35rem;
          color: var(--color-ink-soft);
          transition: transform 120ms ease;
        }

        .jur-row[aria-expanded="true"] .caret {
          transform: rotate(90deg);
        }

        .jur-code {
          margin-left: 0.4rem;
          color: var(--color-ink-soft);
          font-weight: 400;
          font-size: 0.78rem;
        }

        .currency {
          margin-left: 0.35rem;
          color: var(--color-ink-soft);
          font-size: 0.78rem;
        }

        .muted {
          color: var(--color-ink-soft);
        }

        .jur-row.has-topup {
          background: var(--color-surface-muted);
        }

        td.topup-amount.exposure {
          color: var(--color-danger);
          font-weight: 700;
        }

        tfoot td {
          border-top: 2px solid var(--color-line-strong);
          border-bottom: none;
          font-weight: 600;
        }

        tfoot .total-label {
          text-transform: uppercase;
          font-size: 0.78rem;
          letter-spacing: 0.03em;
          color: var(--color-ink-soft);
        }

        .detail-row > td {
          padding: 0;
          border-bottom: 1px solid var(--color-line);
          background: var(--color-surface-muted);
        }

        .detail-row[hidden] {
          display: none;
        }

        .detail {
          display: grid;
          gap: 1.1rem;
          padding: 1rem 1.1rem 1.2rem;
        }

        .detail h4 {
          margin: 0 0 0.5rem;
          font-size: 0.82rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--color-ink-soft);
        }

        .detail p.section-note {
          margin: 0.25rem 0 0;
          font-size: 0.85rem;
          color: var(--color-ink-soft);
        }

        table.detail-table {
          background: var(--color-surface);
          border: var(--border-card);
          border-radius: var(--radius-md);
          overflow: hidden;
          font-size: 0.85rem;
        }

        table.detail-table th {
          background: var(--color-surface);
          border-bottom: var(--border-card);
        }

        table.detail-table td {
          border-bottom: 1px solid var(--color-line);
        }

        table.detail-table tr:last-child td {
          border-bottom: none;
        }

        .source {
          color: var(--color-ink-soft);
          font-size: 0.8rem;
        }

        .step-total td {
          font-weight: 700;
        }

        .empty {
          padding: 18px;
          border: var(--border-frame);
          border-radius: var(--radius-lg);
          color: var(--color-ink-soft);
          background: var(--color-surface-muted);
          font-size: 0.9rem;
        }
      </style>
      ${content}
    `;

    for (const row of this.shadowRoot.querySelectorAll(".jur-row")) {
      row.addEventListener("click", this._onToggleClick);
      row.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this._onToggleClick(event);
        }
      });
    }
  }

  _onToggleClick(event) {
    const row = event.currentTarget;
    const index = row.dataset.index;
    const detail = this.shadowRoot.querySelector(`.detail-row[data-index="${index}"]`);
    if (!detail) {
      return;
    }

    const expanded = detail.hidden;
    detail.hidden = !expanded;
    row.setAttribute("aria-expanded", expanded ? "true" : "false");
    if (expanded) {
      this._expanded.add(index);
    } else {
      this._expanded.delete(index);
    }
  }

  _renderEmpty(message) {
    return `<div class="empty">${this._escapeHtml(message)}</div>`;
  }

  _renderTable(rows) {
    const body = rows.map((row, index) => this._renderRow(row, index)).join("");
    const footer = this._renderFooter(rows);

    return `
      <p class="hint">Jurisdiction-level GloBE figures. Select a row to expand the detailed calculation. Rows with a top-up tax highlight where Pillar Two exposure exists.</p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Jurisdiction</th>
              <th scope="col" class="numeric">Entities</th>
              <th scope="col" class="numeric">GloBE Income</th>
              <th scope="col" class="numeric">Covered Taxes</th>
              <th scope="col" class="numeric">ETR</th>
              <th scope="col" class="numeric">Top-up %</th>
              <th scope="col" class="numeric">Top-up Tax</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
          ${footer}
        </table>
      </div>
    `;
  }

  _renderRow(row, index) {
    const hasTopUp = row.residualTopUp !== null && row.residualTopUp > 0;
    const isExpanded = this._expanded.has(String(index));

    return `
      <tr class="jur-row ${hasTopUp ? "has-topup" : ""}" data-index="${index}" tabindex="0" role="button" aria-expanded="${isExpanded ? "true" : "false"}">
        <td class="jurisdiction-cell"><span class="caret" aria-hidden="true">&#9654;</span>${this._renderJurisdiction(row.jurisdiction)}</td>
        <td class="numeric">${row.entities}</td>
        <td class="numeric">${this._renderAmount(row.netGlobeIncome, row.currency)}</td>
        <td class="numeric">${this._renderAmount(row.coveredTaxes, row.currency)}</td>
        <td class="numeric">${this._renderPercent(row.etrRate)}</td>
        <td class="numeric">${this._renderPercent(row.topUpPercentage)}</td>
        <td class="numeric topup-amount ${hasTopUp ? "exposure" : ""}">${this._renderAmount(row.residualTopUp, row.currency)}</td>
      </tr>
      <tr class="detail-row" data-index="${index}" ${isExpanded ? "" : "hidden"}>
        <td colspan="7">${this._renderDetail(row)}</td>
      </tr>
    `;
  }

  _renderDetail(row) {
    return `
      <div class="detail">
        ${this._renderCalculation(row)}
        ${this._renderCollection(row)}
        ${this._renderEntities(row)}
      </div>
    `;
  }

  _renderCalculation(row) {
    if (!row.hasComputation) {
      const note = row.isSafeHarbour
        ? "This jurisdiction relies on a safe harbour, so no full GloBE minimum-tax computation is reported."
        : "No GloBE minimum-tax computation is reported for this jurisdiction.";
      return `<section><h4>Minimum-tax calculation</h4><p class="section-note">${note}</p></section>`;
    }

    const currency = row.currency;
    const steps = [
      ["Net GloBE income", this._renderAmount(row.netGlobeIncome, currency), "GIR · OverallComputation/NetGlobeIncome"],
      ["Adjusted covered taxes", this._renderAmount(row.coveredTaxes, currency), "GIR · OverallComputation/AdjustedCoveredTax"],
      ["Jurisdictional ETR", this._renderPercent(row.etrRate), "Calculated"],
      ["Minimum rate", this._escapeHtml(formatPercentage(MINIMUM_RATE)), "Rule"],
      ["Top-up tax percentage", this._renderPercent(row.topUpPercentage), "Calculated"],
      ["Substance-based income exclusion", this._renderAmount(row.substanceExclusion, currency), "Payroll + tangible assets"],
      ["Excess profit", this._renderAmount(row.excessProfits, currency), "Calculated"],
      ["Initial top-up tax", this._renderAmount(row.initialTopUp, currency), "Calculated · top-up % × excess profit"],
    ];

    if (row.additionalTopUp) {
      steps.push(["Additional top-up tax", this._renderAmount(row.additionalTopUp, currency), "GIR-reported · Article 4.1.5"]);
    }

    steps.push(["Domestic top-up tax", this._renderAmount(row.domesticTopUp, currency), "GIR-reported · QDMTT"]);

    const rowsHtml = steps
      .map(
        ([step, amount, source]) => `
        <tr>
          <td>${this._escapeHtml(step)}</td>
          <td class="numeric">${amount}</td>
          <td class="source">${this._escapeHtml(source)}</td>
        </tr>`
      )
      .join("");

    const residual = `
      <tr class="step-total">
        <td>Residual top-up tax</td>
        <td class="numeric">${this._renderAmount(row.residualTopUp, currency)}</td>
        <td class="source">Calculated</td>
      </tr>`;

    return `
      <section>
        <h4>Minimum-tax calculation</h4>
        <table class="detail-table">
          <thead>
            <tr><th scope="col">Step</th><th scope="col" class="numeric">Amount</th><th scope="col">Source</th></tr>
          </thead>
          <tbody>${rowsHtml}${residual}</tbody>
        </table>
      </section>
    `;
  }

  _renderCollection(row) {
    if (!row.collection.length) {
      return `
        <section>
          <h4>Collection and allocation</h4>
          <p class="section-note">No top-up tax collection or allocation is reported for this jurisdiction.</p>
        </section>
      `;
    }

    const rowsHtml = row.collection
      .map(
        entry => `
        <tr>
          <td>${this._escapeHtml(entry.mechanism)}</td>
          <td>${this._escapeHtml(entry.collector)}</td>
          <td class="numeric">${this._renderAmount(entry.amount, row.currency)}</td>
        </tr>`
      )
      .join("");

    return `
      <section>
        <h4>Collection and allocation</h4>
        <table class="detail-table">
          <thead>
            <tr><th scope="col">Mechanism</th><th scope="col">Collecting jurisdiction / entity</th><th scope="col" class="numeric">Amount</th></tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </section>
    `;
  }

  _renderEntities(row) {
    if (!row.entityRows.length) {
      return `
        <section>
          <h4>Entity contribution</h4>
          <p class="section-note">No per-entity computation is reported for this jurisdiction.</p>
        </section>
      `;
    }

    const rowsHtml = row.entityRows
      .map(
        entity => `
        <tr>
          <td>${this._escapeHtml(entity.name)}</td>
          <td class="numeric">${this._renderAmount(entity.income, row.currency)}</td>
          <td class="numeric">${this._renderAmount(entity.coveredTaxes, row.currency)}</td>
          <td>${entity.adjustments.length ? this._escapeHtml(entity.adjustments.join("; ")) : "<span class=\"muted\">—</span>"}</td>
        </tr>`
      )
      .join("");

    return `
      <section>
        <h4>Entity contribution</h4>
        <table class="detail-table">
          <thead>
            <tr><th scope="col">Entity</th><th scope="col" class="numeric">GloBE income</th><th scope="col" class="numeric">Covered taxes</th><th scope="col">Key adjustments</th></tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </section>
    `;
  }

  // Totals are only meaningful for money columns when every jurisdiction reports in the
  // same currency; a GIR can mix local currencies, so those totals collapse to "—" then.
  _renderFooter(rows) {
    const currencies = new Set(rows.map(row => row.currency).filter(Boolean));
    const singleCurrency = currencies.size === 1 ? [...currencies][0] : null;

    const totalEntities = rows.reduce((sum, row) => sum + row.entities, 0);
    const sumColumn = accessor =>
      rows.reduce((sum, row) => {
        const value = accessor(row);
        return value === null ? sum : sum + value;
      }, 0);

    const moneyTotal = accessor =>
      singleCurrency
        ? this._renderAmount(sumColumn(accessor), singleCurrency)
        : "<span class=\"muted\">—</span>";

    return `
      <tfoot>
        <tr>
          <td class="total-label">Total</td>
          <td class="numeric">${totalEntities}</td>
          <td class="numeric">${moneyTotal(row => row.netGlobeIncome)}</td>
          <td class="numeric">${moneyTotal(row => row.coveredTaxes)}</td>
          <td class="numeric"></td>
          <td class="numeric"></td>
          <td class="numeric">${moneyTotal(row => row.residualTopUp)}</td>
        </tr>
      </tfoot>
    `;
  }

  _renderJurisdiction(code) {
    if (!code) {
      return "—";
    }

    const name = jurisdictionName(code);
    const codeLabel = name !== code ? `<span class="jur-code">${this._escapeHtml(code)}</span>` : "";
    return `${this._escapeHtml(name)}${codeLabel}`;
  }

  _renderAmount(value, currency) {
    const formatted = formatAmount(value);
    if (formatted === null) {
      return "<span class=\"muted\">—</span>";
    }

    const currencyLabel = currency ? `<span class="currency">${this._escapeHtml(currency)}</span>` : "";
    return `${this._escapeHtml(formatted)}${currencyLabel}`;
  }

  _renderPercent(rawValue) {
    const formatted = formatPercentage(rawValue);
    return formatted ? this._escapeHtml(formatted) : "<span class=\"muted\">—</span>";
  }

  _escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
}

customElements.define("jurisdiction-summary-table", JurisdictionSummaryTable);
