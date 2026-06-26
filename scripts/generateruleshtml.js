import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse, stringify } from "yaml";
import { ASSERTION_OPS, ruleIsDisabled } from "../app/ruleeval.js";
import { CSS_TOKENS } from "./styleTokens.js";

const repoRootDir = ".";

const rulesFile = path.join(repoRootDir, "gir-rules", "rules.yaml");
const outputFile = path.join(repoRootDir, "dist", "rules", "index.html");
const testDocsBaseDir = path.join(repoRootDir, "gir-rules", "testdocs");

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const getTestDocsTreeBaseUrl = (commitId) => `https://github.com/marchof/gir.tax/tree/${commitId}/gir-rules/testdocs`;
const getTestDocsBlobBaseUrl = (commitId) => `https://github.com/marchof/gir.tax/blob/${commitId}/gir-rules/testdocs`;

const getRequiredArgValue = (flag) => {
  const argIndex = process.argv.indexOf(flag);
  const value = argIndex === -1 ? null : process.argv[argIndex + 1];

  if (!value || !value.trim()) {
    throw new Error(`Missing required argument: ${flag}`);
  }

  return value.trim();
};

const renderRuleTests = (ruleNumber, testFiles, commitId) => {
  const ruleId = String(ruleNumber);
  const folderUrl = `${getTestDocsTreeBaseUrl(commitId)}/${encodeURIComponent(ruleId)}`;
  const filesCount = Array.isArray(testFiles) ? testFiles.length : 0;

  if (filesCount === 0) {
    return `
      <details>
        <summary>Test files (0)</summary>
        <div class="tests-links">
          <span class="muted">No local XML test files found for this rule.</span>
          <a href="${folderUrl}" target="_blank" rel="noreferrer">Open test folder</a>
        </div>
      </details>
    `;
  }

  const files = testFiles
    .map((fileName) => {
      const fileUrl = `${getTestDocsBlobBaseUrl(commitId)}/${encodeURIComponent(ruleId)}/${encodeURIComponent(fileName)}`;
      return `<li><a href="${fileUrl}" target="_blank" rel="noreferrer">${escapeHtml(fileName)}</a></li>`;
    })
    .join("\n");

  return `
    <details>
      <summary>Test files (${filesCount})</summary>
      <div class="tests-links">
        <a href="${folderUrl}" target="_blank" rel="noreferrer">Open test folder</a>
        <ul class="test-file-list">
          ${files}
        </ul>
      </div>
    </details>
  `;
};

// Serialize a rule's executable definition — its `targets`, optional `when:`
// guard, and single assertion operator with operands — back to the YAML the
// rule is authored in, so the page shows the structured rule rather than a raw
// XPath. Fields are emitted in authoring order to mirror rules.yaml.
const renderImplementation = (rule) => {
  const operator = ASSERTION_OPS.find((op) => op in rule);
  const assertion = { targets: rule.targets };
  if ("when" in rule) {
    assertion.when = rule.when;
  }
  // Disabled rules carry no assertion operator; show just the targets.
  if (operator) {
    assertion[operator] = rule[operator];
  }
  return escapeHtml(stringify(assertion).trimEnd());
};

const renderRuleCard = (rule, testFiles, commitId) => {
  const number = escapeHtml(rule.number);
  const shortRule = escapeHtml(rule.rule || "No rule text");
  const description = escapeHtml(rule.description || "No description");
  const implementationNotes = rule.implementation_notes
    ? `<p class="impl-notes">${escapeHtml(rule.implementation_notes)}</p>`
    : "";
  const disabled = ruleIsDisabled(rule);
  const disabledTag = disabled
    ? `<span class="rule-tag rule-tag--disabled">Disabled</span>`
    : "";

  return `
    <article class="rule-card${disabled ? " rule-card--disabled" : ""}" id="${number}">
      <div class="rule-header">
        <a class="rule-badge" href="#${number}">Rule ${number}</a>
        ${disabledTag}
      </div>
      <h2 class="rule-title">${shortRule}</h2>
      <p class="rule-description">${description}</p>
      <section>
        <h3>Implementation</h3>
        <pre><code>${renderImplementation(rule)}</code></pre>
        ${implementationNotes}
      </section>
      <section>
        <h3>Tests</h3>
        ${renderRuleTests(rule.number, testFiles, commitId)}
      </section>
    </article>
  `;
};

const generateRulesHtml = async () => {
  const commitId = getRequiredArgValue("--commit-id");
  const commitTimestamp = getRequiredArgValue("--commit-timestamp");
  const rulesRaw = await readFile(rulesFile, "utf8");
  const rulesData = parse(rulesRaw);

  const allRules = (rulesData.rules || [])
    .slice()
    .sort((a, b) => Number(a.number) - Number(b.number));
  const disabledCount = allRules.filter(ruleIsDisabled).length;
  const enabledCount = allRules.length - disabledCount;

  const testFilesByRule = new Map();
  await Promise.all(allRules.map(async (rule) => {
    const ruleId = String(rule.number);
    const ruleTestsDir = path.join(testDocsBaseDir, ruleId);

    try {
      const entries = await readdir(ruleTestsDir, { withFileTypes: true });
      const xmlFiles = entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".xml"))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));
      testFilesByRule.set(ruleId, xmlFiles);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        testFilesByRule.set(ruleId, []);
        return;
      }
      throw error;
    }
  }));

  const ruleCards = allRules
    .map((rule) => renderRuleCard(rule, testFilesByRule.get(String(rule.number)) || [], commitId))
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GIR Rules</title>
  <style>
    :root {
      ${CSS_TOKENS}
      --code-bg: #f6f9fc;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 20px;
      background: var(--color-surface);
      color: var(--color-ink);
      font: 16px/1.5 var(--font-ui);
    }

    .frame {
      border: var(--border-frame);
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--color-surface);
      margin-bottom: 1rem;
    }

    .header-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px;
      background: linear-gradient(180deg, #f7f9fb 0%, #eef2f6 100%);
      border-bottom: var(--border-frame);
    }

    .frame-title {
      margin-left: auto;
      color: #aaa;
      font: 700 18px/1.2 sans-serif;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }

    .back-button {
      appearance: none;
      border: 1px solid transparent;
      border-radius: 9px;
      background: transparent;
      color: #425466;
      cursor: pointer;
      font: 600 14px/1.2 sans-serif;
      padding: 8px 12px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
    }

    .back-button:hover {
      background: #e8edf2;
    }

    .panel {
      padding: 14px;
      background: var(--color-surface);
    }

    h1 {
      margin: 0;
      font-size: clamp(1.4rem, 2.2vw, 2rem);
      line-height: 1.2;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
      gap: 0.75rem;
      margin-top: 0.9rem;
    }

    .summary-item {
      border: var(--border-card);
      border-radius: var(--radius-md);
      background: linear-gradient(180deg, var(--color-surface), var(--color-surface-muted));
      padding: 0.65rem 0.75rem;
    }

    .summary-label {
      font-size: 0.78rem;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--color-ink-soft);
    }

    .summary-value {
      margin-top: 0.2rem;
      color: var(--color-ink);
      font-weight: 600;
      word-break: break-word;
    }

    .rules-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.9rem;
      margin-top: 1rem;
    }

    .rule-card {
      border: var(--border-card);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      padding: 0.95rem;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      scroll-margin-top: 1rem;
    }

    .rule-card:target {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 2px var(--color-accent-soft);
    }

    .rule-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .rule-badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      border: 1px solid #a9d6cb;
      background: var(--color-accent-soft);
      color: #0d5e51;
      padding: 0.15rem 0.55rem;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      width: fit-content;
      text-decoration: none;
    }

    .rule-badge:hover {
      text-decoration: underline;
    }

    .rule-tag {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0.15rem 0.55rem;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      width: fit-content;
    }

    .rule-tag--disabled {
      border: 1px solid #d9b0b0;
      background: #fbeaea;
      color: #8a2b2b;
    }

    .rule-card--disabled {
      background: var(--color-surface-muted);
      border-style: dashed;
    }

    .rule-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: #1f2f45;
    }

    .rule-description {
      margin: 0;
      color: var(--color-ink-soft);
      overflow-wrap: anywhere;
    }

    h3 {
      margin: 0.2rem 0 0.35rem;
      font-size: 0.95rem;
      color: #26415f;
    }

    details {
      border: 1px dashed #c9d5e2;
      border-radius: var(--radius-md);
      padding: 0.45rem 0.6rem;
      background: #fbfdff;
    }

    summary {
      cursor: pointer;
      color: #2b4662;
      font-weight: 600;
    }

    code {
      font-family: var(--font-mono);
      font-size: 0.81rem;
    }

    pre {
      margin: 0.55rem 0 0;
      padding: 0.7rem;
      border-radius: var(--radius-md);
      background: var(--code-bg);
      border: var(--border-card);
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .impl-notes {
      margin: 0.4rem 0 0;
      font-size: 0.8rem;
      color: var(--color-ink-soft);
      overflow-wrap: anywhere;
    }

    .tests-links {
      display: grid;
      gap: 0.45rem;
    }

    .tests-links a {
      color: #25538a;
      text-decoration: none;
      width: fit-content;
      max-width: 100%;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .tests-links a:hover {
      text-decoration: underline;
    }

    .test-file-list {
      margin: 0;
      padding-left: 1.1rem;
      display: block;
    }

    .test-file-list li {
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .test-file-list li + li {
      margin-top: 0.2rem;
    }

    .muted {
      color: #66778e;
    }

    .summary-value a {
      color: #25538a;
      text-decoration: none;
    }

    .summary-value a:hover {
      text-decoration: underline;
    }

    .footer-info {
      margin-top: 10px;
      font-size: 0.8rem;
      color: #ccc;
    }

    .footer-info a {
      color: inherit;
    }

    @media (max-width: 700px) {
      .rule-card {
        padding: 0.8rem;
      }
    }
  </style>
</head>
<body>
  <main>
    <div class="frame">
      <div class="header-bar">
        <a class="back-button" href="..">&larr; Back to Viewer</a>
        <div class="frame-title">OECD GIR File Viewer</div>
      </div>
      <div class="panel">
        <h1>GIR Rules</h1>
        <section class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Number of Rules</div>
            <div class="summary-value">${allRules.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Enabled Rules</div>
            <div class="summary-value">${enabledCount}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Disabled Rules</div>
            <div class="summary-value">${disabledCount}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Commit Date and Time</div>
            <div class="summary-value">${escapeHtml(commitTimestamp)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Commit ID</div>
            <div class="summary-value">${escapeHtml(commitId)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Rules Source</div>
            <div class="summary-value">
              <a href="https://doi.org/10.1787/449e3cc3-en" target="_blank" rel="noreferrer">OECD (2025),
              GloBE Information Return (Pillar Two) Status Message XML Schema: User Guide for Tax Administrations</a>
            </div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Source Copyright</div>
            <div class="summary-value">
              &copy; OECD. Published under the
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">Creative Commons Attribution 4.0 International licence</a>.
            </div>
          </div>
        </section>
        <section class="rules-grid">
          ${ruleCards}
        </section>
      </div>
    </div>
    <div class="footer-info">
      <a href="https://github.com/marchof/gir.tax">github.com/marchof/gir.tax</a> @
      <a href="https://github.com/marchof/gir.tax/commit/${commitId}">${escapeHtml(commitId)}</a> |
      ${escapeHtml(commitTimestamp)} |
      <a href="https://github.com/marchof/gir.tax#hosted-service-terms">Terms of Service</a>
    </div>
  </main>
</body>
</html>
`;

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, html, "utf8");
  console.log(`Wrote ${outputFile}`);
};

generateRulesHtml().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
