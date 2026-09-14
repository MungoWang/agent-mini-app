import { defineWorkspace } from "vitest/config";
import * as path from "node:path";

const root = path.resolve(__dirname);
const alias = (name: string) => path.join(root, "packages", name, "src/index.ts");

/**
 * Two projects, because the kit and the runtime need different harnesses.
 *
 * `kit` is packages/ui's own config: jsdom, testing-library matchers, and the
 * `@monkey-mini-app/ui` to source alias. `unit` is node-environment host/panel/api/dsh logic.
 *
 * The split fixes a silent hole: the `kit` project used to be unreachable. `pnpm test` ran
 * only `unit`, whose includes end in `.test.ts`, so every `.test.tsx` under packages/ui sat
 * on disk, type-checked, and never executed. Merely widening `unit`'s glob would not have
 * helped — those tests need jsdom and setup the node project does not provide. packages/ui
 * is therefore excluded here so its `.test.ts` files are not also run under the wrong
 * environment.
 */
export default defineWorkspace([
  "./packages/ui/vitest.config.ts",
  {
    resolve: {
      alias: {
        "@monkey-mini-app/host": alias("host"),
        "@monkey-mini-app/panel/themes": path.join(root, "packages/panel/src/themes.ts"),
        "@monkey-mini-app/panel": alias("panel"),
        "@monkey-mini-app/dsh-mini-app": alias("dsh"),
        "@monkey-mini-app/shell": alias("shell"),
        "@monkey-mini-app/pi-mini-app": alias("pi"),
      },
    },
    test: {
      name: "unit",
      environment: "node",
      include: [
        "packages/**/src/**/*.test.ts",
        "packages/**/tests/**/*.test.ts",
        "packages/smoke-test/**/*.test.ts",
      ],
      exclude: ["**/node_modules/**", "**/dist/**", "packages/ui/**", "apps/**"],
      testTimeout: 60_000,
      // No `coverage` block here on purpose. Coverage is a root-only option: a workspace
      // project is typed `ProjectConfig`, which does not accept it, and anything written
      // here is ignored. The real thresholds live in `vitest.config.ts`.
    },
  },
]);
