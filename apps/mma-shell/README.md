# MMA Shell (Tauri)

Lightweight desktop shell that **owns the App Host** and embeds the Panel.

## Architecture

- **Tauri webview** → `@monkey-mini-app/panel` (`createHostShell`)
- **Node sidecar** → `packages/shell` CLI (`mma-shell-host --demo` or caps from pi)
- **pi package** → Agent Client only (`serve` AgentCapabilities + register tools over HTTP)

## Dev

```bash
pnpm --filter @monkey-mini-app/shell build
pnpm --filter @monkey-mini-app/mma-shell install
pnpm --filter @monkey-mini-app/mma-shell tauri:dev
```

Without Tauri UI, host-only:

```bash
pnpm --filter @monkey-mini-app/shell build
node packages/shell/dist/cli.js --runtime-root ~/.monkey-mini-app --demo --port 17880
```

## With pi

1. Start Shell Host (without `--demo`) after pi has written `agent-capabilities.json`.
2. Or start pi Agent Client first (`startPiAgentClient`), then Shell `startShellHost`.
