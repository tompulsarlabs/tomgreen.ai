import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The app imports by "@/..." and tsconfig resolves it; the test runner
  // has to resolve it identically, or a module can only be tested by
  // rewriting its imports to suit the runner.
  resolve: {
    alias: {
      "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src"),
    },
  },
  test: {
    exclude: ["e2e/**", "**/node_modules/**", "**/.next/**"],
  },
});
