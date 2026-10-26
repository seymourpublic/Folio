import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    ocr: "src/ocr-entry.ts",
    signing: "src/signing-entry.ts",
    convert: "src/convert-entry.ts",
    config: "src/config.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
  splitting: false,
  minify: false,
  platform: "browser",
});
