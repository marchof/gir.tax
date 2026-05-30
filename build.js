import { build, context } from "esbuild";
import { copy } from "esbuild-plugin-copy";
import { mkdir, rm } from "node:fs/promises";

const watch = process.argv.includes("--watch");

const options = {
  entryPoints: ["app.js"],
  bundle: true,
  minify: true,
  format: "esm",
  outfile: "dist/app.js",
  plugins: [
    copy({
      assets: [
        { from: ["./index.html"], to: ["./index.html"] },
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
  console.log("Watching for changes...");
} else {
  await build(options);
}
