import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "dist-electron/**",
    "electron/**",
    "design-reference/**",
    // packages/* are independent workspace packages with their own lint/build pipelines
    // (see packages/sdk/package.json) — the root config shouldn't lint their build output.
    "packages/**",
    // site/ is a standalone Next.js app with its own config and its own @/* alias.
    "site/**",
  ]),
]);

export default eslintConfig;
