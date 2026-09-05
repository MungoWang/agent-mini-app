# dsh-host

Pre-publish install gate: publish this commit’s `@monkey-mini-app/*` to local Verdaccio, `dsh plugin add` the real tarball into an in-repo `DSH_HOME`, boot `dsh web`, Playwright-click「小程序」.

Daily development: `pnpm react-host`. Do not use this loop for UI work.

```bash
pnpm dsh-host          # verdaccio + dsh web (:3088 / apps :17880)
pnpm test:dsh          # first install can take minutes
```

Homes (gitignored):

- `apps/dsh-host/.dsh` — `DSH_HOME`
- `apps/dsh-host/mma-runtime` — MMA `runtimeRoot`
- `apps/dsh-host/registry` — verdaccio storage

## Seeded apps

| App | Where it comes from | Why it is here |
|---|---|---|
| `com.example.todo` · `com.example.review` | `fixtures/` | panel + iframe plumbing, kept in-repo so the gate does not drift with the skill |
| `com.example.kit` | `pnpm gen:examples` → `fixtures/com.example.kit` | every kit component mounts in the iframe |
| `com.example.spreadsheet` | **the shipped skill template** (`skills/.../templates/spreadsheet`) + `npm install exceljs` at seed time | the only case that cannot exist without `mini_app_install`: a real `.xlsx` parsed by a package living in that app's own `node_modules` |

The uploaded workbook is `e2e/fixtures/运输明细.xlsx`; regenerate it (it prints the aggregate
numbers the specs assert on) with:

```bash
pnpm exec tsx scripts/gen/dsh-e2e-xlsx.mts
```
