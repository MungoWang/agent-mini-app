# Local development

Day-to-day on the **platform** (host / panel / iframe): **`pnpm dev:host`** (Vite `:5174`, demo host `:17900`). No dsh involved.

dsh is the current adapter; pi is not wired yet. You do not need dsh to change UI.

## Link into local dsh web (dev machine)

```bash
bash scripts/setup/install-dsh-plugin.sh
dsh web --no-open # http://127.0.0.1:3080 ; apps host :17880
```

This is **not** the user install path (users run `dsh plugin add @monkey-mini-app/dsh-mini-app`). The script builds then path-links repo packages into `~/.dsh/profiles/web`.

Rewrite config only:

```bash
pnpm exec tsx scripts/setup/host-config.mts
```

## Edit loop

```bash
# after host / panel / dsh source changes
pnpm --filter @monkey-mini-app/dsh-mini-app build
# restart dsh web, hard-refresh the browser

# UI kit / SDK
node scripts/build/ui.mjs && node scripts/build/sdk.mjs
pnpm skill # gen:skill + check:skill
```

## Test

```bash
pnpm lint
pnpm skill
pnpm test
pnpm exec tsc -b
```

Pre-publish install gate (real npm packages + real dsh web; slow; use `pnpm dev:host` daily):

```bash
pnpm dsh-host # :3088
pnpm test:dsh
pnpm publish:packages # runs test:dsh first; emergency --skip-e2e
```

### dsh 版本与 harness 安装（2026-09-04 实测，已升到 0.1.2-rc.1）

四个包（`@deepseek-ai/dsh` + `dsh-llm / dsh-session / dsh-subagent`）**同训钉版**，目前
`0.1.2-rc.1`，**不用 `latest`**：镜像上后三者的 `latest` dist-tag 还指着 `0.0.1-rc.x`（比在用
的旧），而 `^0.1.1-rc.2` 这类范围会把 prerelease 漂到 `0.1.2` train —— 直接依赖和传递依赖分属
两条 train 正是崩溃来源。升版 = 改四处 exact pin + 重跑 `pnpm test:dsh`。

**关键坑：dsh 的插件树必须在 isolated 链接下安装。** 0.1.2 的官方插件彼此要求不同世代的
`dsh-llm` / `dsh-session` / `dsh-attachment` API（各自的 `peerDependencies` 是 `^0.1.1-rc.2`，
而 core 要 `^0.1.2-rc.1`），pnpm 默认的 hoisted 平铺只会放一个版本，于是必然出现
`does not provide an export named 'deepFreeze' / assertNever / snapshotJsonValue /
admitPromptContent` 这类 `loader entries failed to apply`，dsh web 起不来。解法不是降版也不是
`pnpm.overrides`（实测都能"看似"修好，其实是把一半插件喂错版本）：给 harness 一份**自己的**
workspace —— `apps/dsh-host/pnpm-workspace.yaml` + `apps/dsh-host/pnpm-lock.yaml`，让它有本地
`node_modules`，每个插件按 peer 拿到自己的副本。`pnpm test:dsh` 已串上这一步。

**0.1.2 还加了浏览器鉴权**：web 只认启动时打印的 `http://127.0.0.1:3088/?token=…`（303 → 签
30 天 HttpOnly cookie），其余一律 401。`scripts/up.mts` 抓这条 URL 落到 `.dsh/web-url`，
`e2e/smoke.spec.ts` 用它导航 —— 否则症状是「我们的 `小程序` 按钮根本不存在」，看着像插件坏了。
首屏弹窗也从 `Configure later` 变成了 **Internal Testing Notice / Continue**，`dismissOnboarding`
改成轮询清门（残留时点名报错），别再等单一文案。

顺带记两个坑：`up.mts` 会**改写仓库里 `packages/*/package.json` 的 version** 为
`0.0.0-dshhost.<sha>.<hash>`（跑完 `git checkout` 回去，别提交）；跑 e2e 前先确认 **4873 端口没有
上一轮残留的 Verdaccio** —— `EADDRINUSE` 会让整轮跑在旧包上，我因此一度误判成"升级不可能"。

## Docs

Index: [`docs/README.md`](./docs/README.md). Do not add long essays at the repo root.

## FAQ

1. **Missing host.json** — run `scripts/setup/install-dsh-plugin.sh` or `scripts/setup/host-config.mts`.
2. **Theme lost on refresh** — confirm the apps host got `POST /api/host-config`; hard-refresh.
3. **Old package names** — `dsh-plugin` / `host-core` / `panel-core` are gone; see tag `archive/pre-cutover-legacy-2026-08-29`.
