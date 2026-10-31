import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["scripts/*.mjs", "tests/**/*.test.ts", "tests/helpers/*.ts", "e2e/**/*.spec.ts"],
  project: ["src/**/*.{ts,tsx,css}", "scripts/*.mjs", "tests/**/*.ts", "e2e/**/*.ts"],
};

export default config;
