import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // Next.js swaps `server-only` at build time; under Vitest it is replaced with an empty module.
    alias: { "server-only": resolve(import.meta.dirname, "tests/helpers/empty-module.ts") },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    clearMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/server/**"],
      reporter: ["text-summary", "text", "lcov"],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    },
  },
});
