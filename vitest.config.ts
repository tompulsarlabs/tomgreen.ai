import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The app imports by "@/..." and tsconfig resolves it; the test runner
  // has to resolve it identically, or a module can only be tested by
  // rewriting its imports to suit the runner. Resolved from cwd rather
  // than import.meta so the config still loads as CommonJS.
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
  },
  test: {
    exclude: ["e2e/**", "**/node_modules/**", "**/.next/**"],
  },
});
