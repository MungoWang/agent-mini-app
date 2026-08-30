import tseslint from "typescript-eslint";

const mmaPackages = [
  "packages/host/**/*.{ts,tsx}",
  "packages/panel/**/*.{ts,tsx}",
  "packages/dsh/**/*.{ts,tsx}",
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
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
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
