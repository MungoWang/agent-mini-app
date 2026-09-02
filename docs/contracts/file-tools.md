# Mini-app file tools

Agents read and write mini-app source through `mini_app_*` tools — never by writing the runtime directory directly.

## Tools (host `ToolFacade`)

| Tool | Purpose |
|---|---|
| `mini_app_get` | Manifest + absolute dir |
| `mini_app_list_files` | Source file list (skips `.git` / `storage`) |
| `mini_app_read` | One file (optional line window) |
| `mini_app_edit` | Surgical edits (`edits: [{ oldText, newText }]`) |
| `mini_app_write` | New file / large rewrite |
| `mini_app_delete` | One file (`manifest.json` cannot be deleted) |
| `mini_app_register` | Create app from a `files` map |
| `mini_app_reload` | Validate + compile + warm cache |
| `mini_app_call` | Smoke-test one `api` method |
| `mini_app_open` | Show the app in the panel |
| `mini_app_list` | List registered apps |

Paths are **app-relative**. `..` and absolute paths are rejected.

## Layout reminder

```
manifest.json · ui.tsx · main.api.ts
ui/      UI only
api/     backend only
shared/  pure isomorphic
```

Full author contract: `skills/monkey-mini-app/SKILL.md`.
