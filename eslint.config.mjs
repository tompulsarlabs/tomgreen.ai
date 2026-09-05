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
    // Alternate build outputs. next.config.mjs honours NEXT_DIST_DIR, which
    // the Vercel contract script and the golden path's review build both use
    // to avoid clobbering .next - and a build output is not source.
    ".next-*/**",
  ]),
]);

export default eslintConfig;
