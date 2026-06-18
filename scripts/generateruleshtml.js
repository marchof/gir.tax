import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

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

const renderRuleTargets = (targets) => {
  if (!Array.isArray(targets) || targets.length === 0) {
    return "<span class=\"muted\">No targets</span>";
  }

  const items = targets.map((target) => `<li><code>${escapeHtml(target)}</code></li>`).join("\n");
  return `<ul class="target-list">${items}</ul>`;
};

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

const renderRuleCard = (rule, testFiles, commitId) => {
  const number = escapeHtml(rule.number);
  const shortRule = escapeHtml(rule.rule || "No rule text");
  const description = escapeHtml(rule.description || "No description");
  const test = escapeHtml(rule.test || "");

  return `
    <article class="rule-card" id="rule-${number}">
      <div class="rule-header">
        <span class="rule-badge">Rule ${number}</span>
      </div>
      <h2 class="rule-title">${shortRule}</h2>
      <p class="rule-description">${description}</p>
      <section>
        <h3>Targets</h3>
        ${renderRuleTargets(rule.targets)}
        <h3>Implementation XPath test</h3>
        <pre><code>${test}</code></pre>
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

  const implementedRules = (rulesData.rules || [])
    .filter((rule) => Object.prototype.hasOwnProperty.call(rule, "test"))
    .sort((a, b) => Number(a.number) - Number(b.number));

  const testFilesByRule = new Map();
  await Promise.all(implementedRules.map(async (rule) => {
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

  const ruleCards = implementedRules
    .map((rule) => renderRuleCard(rule, testFilesByRule.get(String(rule.number)) || [], commitId))
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Implemented GIR Rules</title>
  <style>
    :root {
      --bg: #f2f5f8;
      --card-bg: #ffffff;
      --ink: #16253a;
      --ink-soft: #4f6075;
      --line: #d9e1ea;
      --accent: #0f7c6b;
      --accent-soft: #dff4ef;
      --code-bg: #f6f9fc;
      --shadow: 0 10px 30px rgba(17, 37, 62, 0.08);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 20px;
      background: #ffffff;
      color: var(--ink);
      font: 16px/1.5 "Avenir Next", "Segoe UI", sans-serif;
    }

    .frame {
      border: 1px solid #d9dee3;
      border-radius: 12px;
      overflow: hidden;
      background: #fff;
      margin-bottom: 1rem;
    }

    .header-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px;
      background: linear-gradient(180deg, #f7f9fb 0%, #eef2f6 100%);
      border-bottom: 1px solid #d9dee3;
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
      background: #ffffff;
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
      border: 1px solid var(--line);
      border-radius: 10px;
      background: linear-gradient(180deg, #ffffff, #f7fafd);
      padding: 0.65rem 0.75rem;
    }

    .summary-label {
      font-size: 0.78rem;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--ink-soft);
    }

    .summary-value {
      margin-top: 0.2rem;
      color: var(--ink);
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
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--card-bg);
      padding: 0.95rem;
      box-shadow: 0 5px 18px rgba(17, 37, 62, 0.05);
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .rule-badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      border: 1px solid #a9d6cb;
      background: var(--accent-soft);
      color: #0d5e51;
      padding: 0.15rem 0.55rem;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      width: fit-content;
    }

    .rule-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: #1f2f45;
    }

    .rule-description {
      margin: 0;
      color: var(--ink-soft);
      overflow-wrap: anywhere;
    }

    h3 {
      margin: 0.2rem 0 0.35rem;
      font-size: 0.95rem;
      color: #26415f;
    }

    details {
      border: 1px dashed #c9d5e2;
      border-radius: 10px;
      padding: 0.45rem 0.6rem;
      background: #fbfdff;
    }

    summary {
      cursor: pointer;
      color: #2b4662;
      font-weight: 600;
    }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.81rem;
    }

    .target-list code {
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    pre {
      margin: 0.55rem 0 0;
      padding: 0.7rem;
      border-radius: 9px;
      background: var(--code-bg);
      border: 1px solid #dce5ef;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .target-list {
      margin: 0;
      padding-left: 1.1rem;
      display: grid;
      gap: 0.25rem;
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
        <h1>Implemented GIR Rules</h1>
        <section class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Number of Rules</div>
            <div class="summary-value">${implementedRules.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Commit Date and Time</div>
            <div class="summary-value">${escapeHtml(commitTimestamp)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Commit ID</div>
            <div class="summary-value">${escapeHtml(commitId)}</div>
          </div>
        </section>
        <section class="rules-grid">
          ${ruleCards}
        </section>
      </div>
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
