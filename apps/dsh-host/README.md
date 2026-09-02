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
