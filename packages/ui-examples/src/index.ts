/**
 * Runnable, mini-app-portable examples for `@monkey-mini-app/ui`.
 *
 * Every file here imports ONLY `react`, the bare `@monkey-mini-app/ui`, and
 * in-package relatives — so it can be copied verbatim into a mini-app `lib/`
 * or into the authoring skill. `check` (eslint no-restricted-imports) enforces it.
 *
 * Areas are group showcases (Forms/Data/…); per-component canonical examples
 * live under `components/<Name>/<name>-NN.tsx` and carry an `@exampleOf` tag.
 */
export { ChartBlockExamples } from "./areas/charts-blocks";
export { DataExamples } from "./areas/data";
export { DateExamples } from "./areas/dates";
export { EditorExamples } from "./areas/editors";
export { FormExamples } from "./areas/forms";
export { OverlayExamples } from "./areas/overlays";
export { PrimitiveExamples } from "./areas/primitives";
export { ProductExamples } from "./areas/products";
export { LOOKS } from "./looks";
