import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

const mmaPackages = [
  "packages/host/**/*.{ts,tsx}",
  "packages/api/**/*.{ts,tsx}",
  "packages/panel/**/*.{ts,tsx}",
  "packages/dsh/**/*.{ts,tsx}",
  "packages/ui-examples/**/*.{ts,tsx}",
];

const monkeyMiniAppStringRule = [
  "error",
  {
    selector: "Literal[value=/\\.monkey-mini-app/]",
    message:
      "Do not hardcode .monkey-mini-app; only packages/host/src/config/defaults.ts and bootstrap.ts may seed that path.",
  },
  {
    selector: "TemplateElement[value.raw=/\\.monkey-mini-app/]",
    message:
      "Do not hardcode .monkey-mini-app; only packages/host/src/config/defaults.ts and bootstrap.ts may seed that path.",
  },
];

export default tseslint.config(
  {
    // ui-examples must stay mini-app-portable: bare UI package + react + in-package relatives only.
    files: [
      "packages/ui-examples/src/areas/**/*.{ts,tsx}",
      "packages/ui-examples/src/components/**/*.{ts,tsx}",
      "packages/ui-examples/src/shared/**/*.{ts,tsx}",
      "packages/ui-examples/src/index.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@monkey-mini-app/ui/*",
                "@monkeyagent/*",
                "@monkey-mini-app/sdk",
                "lucide-react",
                "react-day-picker",
                "recharts",
                "@codemirror/*",
                "shiki",
                "@tiptap/*",
              ],
              message:
                "examples may import only react + bare @monkey-mini-app/ui + in-package relatives (must stay mini-app-portable)",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/lib/**",
      "coverage/**",
      "apps/**",
      "packages/ui/**",
      "packages/smoke-test/**",
      "docs/**",
    ],
  },
  {
    files: mmaPackages,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",

      // Unified style (match existing host/panel/dsh code)
      quotes: ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }],
      semi: ["error", "always"],
      "jsx-quotes": ["error", "prefer-double"],

      // Imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            // Node builtins
            ["^node:"],
            // External packages
            ["^@?\\w"],
            // Internal workspace packages
            ["^@monkey-mini-app/", "^@monkeyagent/"],
            // Relative parent / sibling / index
            ["^\\.\\.(?!/?$)", "^\\.\\./?$", "^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"],
          ],
        },
      ],
      "simple-import-sort/exports": "error",

      "no-restricted-syntax": monkeyMiniAppStringRule,
    },
  },
  {
    files: ["packages/host/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@monkey-mini-app/panel", message: "host must not import panel" },
            { name: "@monkey-mini-app/dsh-mini-app", message: "host must not import dsh" },
          ],
          patterns: [
            {
              group: [
                "@monkey-mini-app/panel/*",
                "@monkey-mini-app/dsh-mini-app/*",
                "**/packages/panel/**",
                "**/packages/dsh/**",
              ],
              message: "host must not import panel or dsh",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/panel/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@monkey-mini-app/host", message: "panel must not import host" },
            { name: "@monkey-mini-app/dsh-mini-app", message: "panel must not import dsh" },
          ],
          patterns: [
            {
              group: [
                "@monkey-mini-app/host/*",
                "@monkey-mini-app/dsh-mini-app/*",
                "**/packages/host/**",
                "**/packages/dsh/**",
              ],
              message: "panel must not import host or dsh",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "packages/host/src/config/defaults.ts",
      "packages/host/src/config/bootstrap.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    files: ["packages/**/tests/**/*.{ts,tsx}", "packages/**/*.test.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
);
