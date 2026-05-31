import { build, context } from "esbuild";
import { copy } from "esbuild-plugin-copy";
import { mkdir, rm } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const serve = process.argv.includes("--serve");

const options = {
  entryPoints: ["app/app.js"],
  bundle: true,
  minify: true,
  format: "esm",
  outfile: "dist/app/app.js",
  plugins: [
    copy({
      resolveFrom: "cwd",
      assets: [
        { from: ["./index.html"], to: ["./dist/index.html"] },
        { from: ["./schemas/*"], to: ["./dist/schemas/"] },
        { from: ["./node_modules/xmllint-wasm/xmllint-browser.mjs"], to: ["./dist/app/xmllint-browser.mjs"] },
        { from: ["./node_modules/xmllint-wasm/xmllint.wasm"], to: ["./dist/app/xmllint.wasm"] },
      ],
      watch,
      verbose: true,
    }),
  ],
};

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

if (watch) {
  const ctx = await context(options);
  await ctx.watch();

   if (serve) {
    const host = "127.0.0.1";
    const port = 8080;
    await ctx.serve({ servedir: "dist", host, port });
    console.log(`Serving dist at http://${host}:${port}`);
  }

  console.log("Watching for changes...");
} else {
  await build(options);
}
