# @monkey-mini-app/dsh-mini-app

[DeepSeek Harness](https://github.com/) plugin (Cordis) that wires the mini-app host into a
dsh session. It assembles `createHost(DshCapabilities, DshLifecycle, { config, themes })`
and ships the skills that generate mini-apps.

## Install

```bash
pnpm add @monkey-mini-app/dsh-mini-app
```

The plugin publishes a server entry (`apply`), a browser client export and a set of skills.
`@monkey-mini-app/*` are **external** at runtime (require, not bundled) so your host/panel
versions stay decoupled.

## Plugin entry (server)

The plugin exports `apply(ctx, config?)` (the Cordis entry), the constants `name =
"monkey-mini-app"` and `inject = ["tools"]`, and the seams `DshCapabilities` /
`DshLifecycle` / `DshThemeResource`:

```ts
export async function apply(ctx: DshCtx, config: DshPluginConfig = {}) {
  const hostConfig = loadPluginHostConfig(config);
  const host = createHost(new DshCapabilities(ctx), new DshLifecycle(ctx), {
    config: hostConfig,
    themes: new DshThemeResource(hostConfig.runtimeRoot),
  });
  try {
    const { port } = await host.apply(ctx); // may throw on port collision
    console.log(`[monkey-mini-app] apps host http://127.0.0.1:${port}`);
    return () => void host.stop();
  } catch (cause) {
    // A port collision must not crash dsh web: log + clean up instead.
    await host.stop().catch(() => {});
    return () => {};
  }
}
```

`apply(ctx)` returns a cleanup function. On port collision (a busy `hostPort`) it logs a
browser-actionable message and returns a no-op rather than throwing into dsh.

## Client export

```ts
import { FooterButton, createMiniAppPanel, appFrameUrl, appsOrigin } from "@monkey-mini-app/dsh-mini-app/client";
```

The client mounts the panel shell, the footer button, and the mini-app iframe via the
panel `createMiniAppPanel`. It also exports the client `apply` (browser mount entry) and
`appsOrigin` / `appFrameUrl` (build the host URL).

## Skills

- `monkey-mini-app` — how to author a mini-app (`manifest.json` + `ui.tsx` + `main.api.ts`).
  Templates in `skills/monkey-mini-app/templates/`.
- `monkey-mini-app-ui` — the component contract (auto-synced by `pnpm skill:gen`).

`getSkillDir()`, `getTemplateFiles()`, `getSkeletonTemplateFiles()` and
`getSkillMarkdown()` expose the skill files at runtime.

## Config

`loadPluginHostConfig(config)` / `resolveRuntimeRoot(config)` resolve the host config. The
runtime **does not invent** `host.json` defaults — a missing file is an error; run the
install script (`bash scripts/install-dsh-mini-app.sh`) or `pnpm exec tsx scripts/mma-init.ts`.
