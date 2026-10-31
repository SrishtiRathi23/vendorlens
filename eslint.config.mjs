import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const restrict = (patterns) => ({ "no-restricted-imports": ["error", { patterns }] });

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  // Type-aware rules for all application and test code.
  {
    files: ["**/*.{ts,tsx,mts}"],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      eqeqeq: ["error", "always"],
      "no-console": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },

  // Money, quote and comparison logic must stay pure and framework-free.
  {
    files: ["src/domain/**"],
    rules: restrict([
      { group: ["react", "react-*", "next", "next/*"], message: "Domain code is framework-free." },
      { group: ["@/*", "!@/domain/*"], message: "Domain code may only import other domain modules." },
      { group: ["@google/genai", "idb"], message: "Domain code performs no I/O." },
    ]),
  },

  // Browser-side code talks to the server through API routes, never by importing it.
  {
    files: ["src/features/**", "src/ui/**", "src/lib/**"],
    rules: restrict([{ group: ["@/server/*"], message: "Use fetch('/api/…') instead of importing server modules." }]),
  },

  globalIgnores([".next/", "coverage/", "playwright-report/", "test-results/", "next-env.d.ts"]),
]);
