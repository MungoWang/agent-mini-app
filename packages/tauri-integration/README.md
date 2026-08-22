# Tauri integration

## Recommended architecture

```text
┌─────────────────────────┐
│  Tauri WebView (React)  │  shell UI: app list, theme switch, agent
└───────────┬─────────────┘
            │ invoke("mma.*")
┌───────────▼─────────────┐
│  Rust commands          │  thin; may call Node sidecar via stdin/IPC
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│  Node sidecar           │  createMonkeyRuntime({ runtimeRoot })
│  @monkey-mini-app/*     │
└─────────────────────────┘
```

## Bootstrap (Node sidecar)

```ts
import { appDataDir } from "@tauri-apps/api/path"; // or pass from Rust
import {
  createMonkeyRuntime,
  bindTauriCommands,
  defaultTauriRuntimeRoot,
} from "@monkey-mini-app/tauri-integration";

const root = defaultTauriRuntimeRoot("/path/from/rust/appDataDir");
const rt = await createMonkeyRuntime({
  runtimeRoot: root,
  hostHandlers: {
    // native features proxied from Rust
  },
});
const commands = bindTauriCommands(rt);
// expose commands over your IPC of choice
```

## Frontend

```ts
import { invoke } from "@tauri-apps/api/core";

const apps = await invoke("mma.list_apps");
const tokens = await invoke("mma.apply_theme_tokens");
// apply CSS variables on documentElement
for (const [k, v] of Object.entries(tokens)) {
  document.documentElement.style.setProperty(`--${k}`, v);
}
```

## Env overrides

Still honor `MONKEY_MINI_APP_ROOT` if `runtimeRoot` is omitted.

## Mini UI mount

For in-webview React minis, use `rt.openBridge(appId)` in the same JS realm when possible.
For isolated webviews, forward bridge messages over `postMessage` ↔ IPC using the same JSON protocol from `@monkey-mini-app/bridge-protocol`.
