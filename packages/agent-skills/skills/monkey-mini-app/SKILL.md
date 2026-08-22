---
name: monkey-mini-app
description: Create and maintain local monkey-mini-app mini applications (directory layout, manifest, theme tokens, storage, history, multi-tab host).
---

# monkey-mini-app skill

Use this skill when the user wants a **local mini-app** under the monkey-mini-app runtime (dashboard widgets, small tools, prototypes).

You do **not** need to read monkey-mini-app source code. Follow this skill and call the `mini_app_*` tools.

## Workflow

1. Choose reverse-DNS `appId` (e.g. `com.example.todo`).
2. Write files under `apps/<appId>/` using **host file tools** (path from `mini_app_get` or `{runtimeRoot}/apps/<appId>`).
3. `mini_app_register` with the file map **or** register after files exist on disk (if tool supports refresh-only — prefer register with files).
4. `mini_app_history_commit` with a message.
5. `mini_app_open` to open a **tab** (multiple tabs allowed; does not close others).

## Required layout

```text
apps/<appId>/
├── manifest.json      # required
├── App.tsx            # required entry (default export component)
├── main.api.ts        # optional bridge wrappers
├── components/
├── hooks/
├── utils/
├── styles/
└── storage/           # runtime-managed JSON; do not invent parallel data/
```

## manifest.json

```json
{
  "id": "com.example.todo",
  "name": "Todo",
  "version": "0.1.0",
  "entry": "App.tsx",
  "permissions": ["storage", "ui"],
  "theme": { "followsHost": true }
}
```

- Directory name **must equal** `id`.
- Permissions: declare every capability used (`storage`, `ui`, `host:<name>`, …).

## Styling

- Themeable values **must** use CSS variables, e.g. `var(--color-background)`, `var(--color-primary)`, `var(--radius-md)`, `var(--space-4)`.
- Do **not** hard-code brand hex colors for surfaces.
- Component library is optional (shadcn-style OK). Do not add a second full UI framework.

## Storage

- App data lives in `storage/*.json` via bridge (`mini.storage`), not ad-hoc files beside source (unless user asks).
- Multi-file: pass `file` option (`default.json`, `settings.json`, …).

## History (single branch `main`)

| Intent | Tool |
|--------|------|
| Save | `mini_app_history_commit` |
| See tree | `mini_app_history_list` |
| Undo commit impact, stay forward | `mini_app_history_revert` |
| Go back to old state and continue | `mini_app_history_reset` (keeps backup tip in tree) |

No feature branches / merge in product workflow.

## Tabs

- `mini_app_open` opens another tab like a browser.
- `mini_app_list_tabs` / `mini_app_focus` / `mini_app_close_tab` manage the host session.
- Closing a tab does not delete the app.

## Imports allowed

- Relative imports inside the app
- `@monkey-mini-app/api-client` for `mini.*`
- `react` / `react-dom` (provided by host)

## Checklist before done

- [ ] manifest valid, id = folder name  
- [ ] entry exists  
- [ ] permissions listed  
- [ ] styles use tokens  
- [ ] registered + committed  
- [ ] opened in a tab if user wants preview  

## Anti-patterns

- Skipping register and only writing files without runtime awareness  
- Building private auth/request stacks instead of host bridge  
- `reset` vs `revert` confusion (reset moves main; revert adds forward undo commit)
