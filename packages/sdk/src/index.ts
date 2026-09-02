/**
 * Mini-app authoring SDK — the **only** package a mini-app imports.
 * UI: hooks come from `react`; `useApp` + the component kit from here.
 * Backend (`main.api.ts`): `defineApp` here is the author-facing contract;
 * the host injects the runtime version when it loads the file.
 */
export * from "./app.ts";
export { AppRuntime, useApp } from "./use-app.ts";
export * from "@monkey-mini-app/ui";
