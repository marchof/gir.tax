import { build, context } from "esbuild";
import { copy } from "esbuild-plugin-copy";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const distDir = "./dist";
const distMetaDir = `${distDir}/.meta`;

const watch = process.argv.includes("--watch");
const serve = process.argv.includes("--serve");
const execFileAsync = promisify(execFile);

const getVersionInfo = async () => {
  const [{ version }, [commitId, commitIdShort, commitTimestamp, commitTimestampIso]] = await Promise.all([
    readFile("package.json", "utf8").then(JSON.parse),
    execFileAsync(
      "git",
      ["show", "-s", "--date=format-local:%Y-%m-%dT%H:%M:%SZ", "--format=%H%n%h%n%ct%n%cd", "HEAD"],
      { env: { ...process.env, TZ: "UTC" } },
    ).then(({ stdout }) => stdout.trim().split("\n")),
  ]);

  return {
    version,
    commitId,
    commitIdShort,
    commitTimestamp: Number(commitTimestamp),
    commitTimestampIso,
  };
};

const versionInfo = await getVersionInfo();

const writeVersionMetadata = async () => {
  await writeFile(`${distMetaDir}/version.json`, `${JSON.stringify(versionInfo, null, 2)}\n`);
};

const writeThirdPartyLicenseReport = async () => {
  const licenseCheckerBin = "./node_modules/license-checker-evergreen/dist/bin/license-checker-evergreen.js";
  await Promise.all([
    execFileAsync(process.execPath, [licenseCheckerBin, "--production", "--production", "--markdown", "--out", `${distMetaDir}/third-party-licenses.md`]),
  ]);
};

const options = {
  entryPoints: ["app/app.js"],
  bundle: true,
  minify: true,
  format: "esm",
  define: {
    VERSION_INFO: JSON.stringify(versionInfo),
  },
  outfile: `${distDir}/app/app.js`,
  plugins: [
    copy({
      resolveFrom: "cwd",
      assets: [
        { from: ["./index.html"], to: [`./${distDir}/index.html`] },
        { from: ["./schemas/**/*"], to: [`./${distDir}/schemas/`] },
        { from: ["./node_modules/xmllint-wasm/xmllint-browser.mjs"], to: [`./${distDir}/app/xmllint-browser.mjs`] },
        { from: ["./node_modules/xmllint-wasm/xmllint.wasm"], to: [`./${distDir}/app/xmllint.wasm`] },
        { from: ["./LICENSE.md"], to: [`./${distMetaDir}/license.md`] },
      ],
      watch,
      verbose: true,
    }),
  ],
};

await rm(distDir, { recursive: true, force: true });
await mkdir(distMetaDir, { recursive: true });
await writeVersionMetadata();
await writeThirdPartyLicenseReport();

if (watch) {
  const ctx = await context(options);
  await ctx.watch();

  if (serve) {
    const host = "127.0.0.1";
    const port = 8080;
    await ctx.serve({ servedir: distDir, host, port });
    console.log(`Serving dist at http://${host}:${port}`);
  }

  console.log("Watching for changes...");
} else {
  await build(options);
}
