# @monkey-mini-app/panel

Pure React panel UI (the `PanelHost` seam). It renders the shell you see around a mini-app
—— the app list, settings, theme pop, tab bar. It talks to a host **over HTTP/frame**, so
it bundles no server and must not depend on `host` or `dsh`.

## Mount

```tsx
import { createMiniAppPanel, createRestPanelHost } from "@monkey-mini-app/panel";

const panel = createMiniAppPanel(createRestPanelHost({ baseUrl, ... }), { ... });
// panel.mount(el) / panel.unmount()
```

`createMiniAppPanel(host: PanelHost, options?)` returns a `PanelInstance`. `PanelProvider`
supplies `usePanelActions` / `usePanelI18n` for the state + i18n context. For a REST
backend, build the host with `createRestPanelHost` (`RestOptions`) which drives the host's
`HttpGateway`.

## Seams

| Export | Role |
|--------|------|
| `PanelHost` / `capabilitiesOf` | The panel adapter seam (fetchApps / persistTheme / frame …) |
| `createRestPanelHost` / `RestOptions` | REST client that drives `HttpGateway` |
| `createFrameController` / `FrameController` | iframe ↔ host frame bridge |
| `createHostShell` / `HostShellInstance` | host wiring for the panel |
| `createMiniAppPanel` / `MiniAppPanel` | The top-level panel component / mount |

## State & theme

- `usePanelState` / `getPanelState` / `setPanelState` / `subscribePanel` — shared store.
- `themes.ts` — `cssVars`, `PALETTES`, `tokensOf`, `applyThemeTo`, `runnerThemeCss`,
  `parseThemeCss`, `*Theme*` helpers.
- `styles.ts` — `injectPanelCss` / `PANEL_CSS_TAG` (inject the panel CSS without a file).

## Errors

`HostUnreachableError` — thrown by the REST host when the host socket is unreachable; the
panel renders a browser-actionable message instead of a blank screen.

## Constraints

- Pure React: no `/api`, no `host`/`dsh` dependency (import direction enforced by eslint).
- Theme/CSS helpers are self-contained so the panel can be dropped into any host.
