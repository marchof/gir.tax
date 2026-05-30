import { build, context } from "esbuild";
import { copy } from "esbuild-plugin-copy";

const watch = process.argv.includes("--watch");

const options = {
  entryPoints: ["app.js"],
  bundle: true,
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

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await build(options);
}
