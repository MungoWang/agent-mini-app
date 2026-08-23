# @monkey-mini-app/dsh-monkey-mini-app

English | [中文](README.zh-CN.md)

Installable **DeepSeek Harness (dsh) profile bundle** that wires [monkey-mini-app](https://github.com/) into a running Harness: model-facing `mini_app_*` tools, an agent **SKILL**, and a multi-tab host session behind `ctx.monkeyMiniApp`.

The npm last segment is `dsh-monkey-mini-app` on purpose: dsh's plugin list strips the scope and a leading `dsh-` / `dsh-host-` / `dsh-client-`, so `@monkey-mini-app/dsh-plugin` would render as **plugin**.

This package follows the official **bundle** contract:

- `package.json` → `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`
- `cordis.patch.yml` → inserts plugin row `id: monkey-mini-app`
- Cordis entry → `export const name`, `inject`, `apply(ctx)`

See [Package and install a plugin](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish).

## Install

```sh
dsh plugin --profile web add @monkey-mini-app/dsh-monkey-mini-app
# local checkout:
dsh plugin --profile web add /path/to/monkey-mini-app/packages/dsh-plugin
```

Restart / reload the profile, then verify:

```sh
dsh --profile web --dump-config | grep -A3 'id: monkey-mini-app'
```

You should see a boot log line:

```text
[monkey-mini-app] loaded · runtimeRoot=... · tools=... · skill=...
```

Remove:

```sh
dsh plugin --profile web remove @monkey-mini-app/dsh-monkey-mini-app
```

## What the model gets

| Tool | Purpose |
|------|---------|
| `mini_app_list` / `mini_app_get` / `mini_app_validate` | Discover apps |
| `mini_app_register` | Register file map into runtime |
| `mini_app_open` / `list_tabs` / `focus` / `close_tab` | Multi-tab host |
| `mini_app_history_*` | commit / list tree / reset / revert |
| `mini_app_set_theme` | Host theme |

Agent instructions live only in `skills/monkey-mini-app/` (SKILL.md + references + templates). `@monkey-mini-app/agent-skills` only resolves that path — no second copy.

File create/edit should use **Harness file tools**; this plugin owns **runtime semantics** (register, history, tabs).

## Config

Patch `config` on the row (profile `cordis.patch.yml`) or set env:

| Key / env | Default |
|-----------|---------|
| `config.runtimeRoot` / `MONKEY_MINI_APP_ROOT` | `~/.monkey-mini-app/runtime` |
| `config.themeId` | `light` |

Example profile override:

```yaml
- id: monkey-mini-app
  name: "@monkey-mini-app/dsh-monkey-mini-app"
  config:
    runtimeRoot: "~/my-mma-runtime"
    themeId: dark
```

## Layout

```text
packages/dsh-plugin/
├── package.json          # dsh.bundle.patch
├── cordis.patch.yml      # insert row
├── src/index.ts          # host: name / inject / apply
├── src/client.ts         # dsh web sidebar + dashboard
├── src/ui-kit.ts         # iframe component bag
├── lib/                  # tsup output (gitignored)
├── skills/monkey-mini-app/SKILL.md
├── README.md
└── README.zh-CN.md
```

Shared libraries (not bundles): `@monkey-mini-app/agent-core`, `runtime-core`, `ui-core`, …

## Model Experience

### Request context and condition

#### What the model sees

Tool schemas for `mini_app_*` when `ctx.tools` is available, plus optional skill body from `skills/monkey-mini-app/SKILL.md` when the skill tool loads it.

#### Token effect

Conditional: skill text only when invoked; tool schemas retained while the plugin is loaded.

#### KV Cache effect

Prefix-stable for tool list while the plugin stays mounted; skill injection is request-scoped when loaded on demand.

## Known Limitations and Deferred Work

- **defineTool / dsh-tools exact API** — registration uses a portable tool object; pin `@deepseek-ai/dsh-tools` and wrap with `defineTool` if your Harness build requires it.
- **Web UI slots** — host/tools path is primary; sidebar Dashboard is deferred to a `dsh.client` half.
- **HostPort vs dsh sandbox fs** — default Node fs under `runtimeRoot`; optional bridge to Harness fs providers is deferred.

## License

MIT
