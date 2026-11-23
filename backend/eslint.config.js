import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import nodePlugin from "eslint-plugin-n";
import prettier from "eslint-config-prettier";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  {
    // Ensure TypeScript-ESLint resolves the correct tsconfig in the backend
    languageOptions: {
      parserOptions: {
        // Limit TSConfig root to the backend package so it doesn't see frontend tsconfigs
        tsconfigRootDir: __dirname,
      },
    },
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    ignores: ["dist", "node_modules"],
  },

  {
    files: ["**/*.ts"],
    plugins: {
      import: importPlugin,
      n: nodePlugin,
    },
    rules: {
      "n/no-missing-import": "off",

      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal"],
          alphabetize: { order: "asc" },
        },
      ],

      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },

  prettier,
];
