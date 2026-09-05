# TODO

Platform runtime/SDK, react-host, and the dsh-host install gate are landed. See `docs/architecture/overview.md`, `LOCAL.md`.

---

## NEXT: per-app backend packages（给弱模型执行）

> RFC：[`docs/rfcs/per-app-packages.md`](docs/rfcs/per-app-packages.md) **§1–§6 only**
> 目标：`mini_app_install` + backend 能 `require` 该 app 自己的 `node_modules`
> 完成标准：文末验收 7 条全绿 + `pnpm --filter @monkey-mini-app/host test` + `pnpm check:skill`

### 0. 硬禁令（违反 = 跑偏，立刻停）

1. **不要**实现 RFC §7（Approve/Reject 弹窗、pending、npm star）。内部用，直接装直接跑。
2. **不要**改 UI compiler 让 `ui.tsx` 能 `import "exceljs"`。UI 仍然只有 `react` / `@monkey-mini-app/ui` / `lodash`。
3. **不要**在宿主 `package.json` 加 `kafkajs` / `mysql2` / `exceljs`。不是 platform vendor。lodash 已经在 `/mma/vendors/lodash.js`，**不要动** `platform-modules.ts` 的 `VENDOR_IDS`。
4. **不要**用 `ctx.bash` / `execFile("pnpm"…)` 装包。只用 `npm install --ignore-scripts --omit=dev`，cwd = **该 app 目录**。
5. **不要**从 host / 插件的 `node_modules` resolve。解析根必须是 `appDir/node_modules`。
6. **不要**执行 package.json `scripts`。写入时若有 `scripts` 字段直接删掉。
7. **不要**开 backend worker / 子进程加载。v1 仍在 host 进程里 `require`（和现在 `defineApp` 一样）。
8. **不要**给 `minimal`/`todo` 加 `package.json`，不要第八个 template。
9. **不要**改 `SKIP_DIRS`：`packages/host/src/apps/app-files.ts` 已包含 `node_modules`。`git-history.ts` 的 `GITIGNORE` 已含 `node_modules/`。不要重复造。
10. **先改代码再写 skill**：`scripts/check/skill.mjs` 规定 SKILL.md 里出现的每个 `mini_app_*` 必须已在 `tool-facade.ts` 注册。

---

### T1 — backend loader：从 app 的 node_modules resolve

文件：`packages/host/src/apps/apps-manager.ts` 的 `loadAppFile` 里那个 `req` 回调（约 L703）。

**现在的顺序必须保持，只在 lodash 之后、相对路径之前插入一步：**

```ts
// 1. @monkey-mini-app/api → defineApp proxy（原样）
// 2. resolveVendorSpecifier(spec) → lodash（原样，不要改）
// 3. NEW: 非相对 spec → require from appDir/node_modules
// 4. 相对路径 → resolveAppModule（原样）
```

第 3 步用 Node 的 `createRequire`，**不要**手写路径拼接：

```ts
import { createRequire } from "node:module";

function requireFromAppNodeModules(appDir: string, spec: string): unknown {
  const pkgJson = path.join(appDir, "package.json");
  if (!existsSync(pkgJson)) {
    throw new HostError(
      "BACKEND_IMPORT",
      `backend cannot import '${spec}'. Install it with mini_app_install first (no package.json)`,
    );
  }
  const req = createRequire(pkgJson);
  let resolved: string;
  try {
    resolved = req.resolve(spec);
  } catch {
    throw new HostError(
      "BACKEND_IMPORT",
      `backend cannot import '${spec}'. Run mini_app_install({ packages: [{ name: "${spec.split("/")[0]}" }] }) first`,
    );
  }
  const root = path.resolve(appDir, "node_modules") + path.sep;
  const abs = path.resolve(resolved);
  if (abs !== path.resolve(appDir, "node_modules") && !abs.startsWith(root)) {
    throw new HostError(
      "BACKEND_IMPORT",
      `backend cannot import '${spec}': resolved outside this app's node_modules`,
    );
  }
  return req(spec);
}
```

错误文案改这一处（lodash 仍合法）：

```
backend cannot import '${spec}'. Backend may import @monkey-mini-app/api, lodash, packages installed by mini_app_install, and relative paths inside the app dir
```

`troubleshoot.md` 里对应那一行同步改（旧字符串会让 agent 对照失败）。

---

### T2 — `mini_app_install` 工具

#### T2a. AppsManager 方法

在 `packages/host/src/apps/apps-manager.ts` 新增 **一个** 方法，不要新开 HTTP 路由：

```ts
async installPackages(
  appId: string,
  opts: {
    packages?: { name: string; version?: string }[];
    remove?: string[];
    commit?: boolean;
  },
): Promise<{
  ok: boolean;
  packages: Record<string, string>;
  error?: string;
  committed: CommitOutcome;
}>
```

步骤（按这个顺序，不要省）：

1. `dir = this.dirOf(appId)`，app 必须已 register（没有 `main.api.ts` 就抛现有的 `MISSING_MAIN_API` / 同等）。
2. `package.json`：没有就写 `{ "private": true, "name": appId, "dependencies": {} }`。已有则 `JSON.parse`；**删掉 `scripts` 键**（若存在）。
3. denylist（大小写不敏感比较 **包名**，不是 version）：
   `react` `react-dom` `lodash` `lodash-es` `axios` `typescript`
   以及任何以 `@monkey-mini-app/` 开头的。命中 → `HostError("INVALID_TOOL_ARGS", ...)`，**不要 npm install**。
4. `packages[]`：写入 `dependencies[name] = version ?? "*"`（install 成功后再用 lock 里的实版回写更好；最低限度：把 name 写进 dependencies）。
   `remove[]`：从 `dependencies` 删掉。
5. 确保 app 目录有 `.gitignore`：调用现成的 git init 即可（`afterMutate` → `git.init` 会 `ensureGitignore`，已含 `node_modules/`）。**不要**自己再写一份 GITIGNORE。
6. 跑 npm（必须 ignore-scripts）：

```ts
import { spawn } from "node:child_process";

function npmInstall(appDir: string, extraArgs: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  const cmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = ["install", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund", ...extraArgs];
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: appDir, env: process.env });
    // collect stdout/stderr; on error reject; on close resolve with exit code
  });
}
```

装新包时 extraArgs 用 `exceljs@^4` 这种 `name@version` 数组（npm 会更新 package.json + lock）。
`remove` 用 `npm uninstall --ignore-scripts --omit=dev <name>`。
超时建议 120s，超时 kill 子进程并 `ok: false`。

7. `await this.afterMutate(dir, { commitMessage: "installPackages", commit: opts.commit })`。lockfile + package.json 进 git；`node_modules` 不会进（gitignore 已有）。
8. 返回 `{ ok: code===0, packages: pkg.dependencies, error: stderr 或 undefined, committed }`。

#### T2b. ToolFacade

`packages/host/src/tools/tool-facade.ts`：

- `definitions()` 数组里 **加一项** `mini_app_install`（放在 `mini_app_reload` 附近）。
- `invoke` switch **加一个 case**，不要改别的 case。

```ts
{
  name: "mini_app_install",
  description:
    "Install or remove npm packages for one mini-app backend (into that app's directory, ignore-scripts). Use only when main.api.ts must import a Node library the platform does not ship (file format / binary protocol / vendor SDK). Do not install lodash, axios, react, or @monkey-mini-app/*. UI still cannot import these packages.",
  inputSchema: {
    type: "object",
    properties: {
      appId: APP_ID_SCHEMA,
      packages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            version: { type: "string" },
          },
          required: ["name"],
        },
        description: "Packages to add, e.g. [{ name: \"exceljs\" }]",
      },
      remove: {
        type: "array",
        items: { type: "string" },
        description: "Package names to uninstall",
      },
      commit: { type: "boolean" },
    },
    required: ["appId"],
  },
  execute: (args, signal) => this.invoke("mini_app_install", args, signal),
}
```

`packages` 和 `remove` 可以同时空 → 返回当前 `dependencies`（幂等查询），不要跑 npm。

`dsh` 的 `lifecycle.ts` **不要**再注册一遍：普通 `mini_app_*` 只来自 ToolFacade。只有 `mini_app_list_ctx_tools` 是 dsh 特例。

---

### T3 — skill 文档（代码注册完再写）

改这些文件，**英文指令**，不要写中文散文（`check:skill` 的 skill-language 会红）：

1. `skills/monkey-mini-app/SKILL.md` 工具表加一行：
   `| Install a backend npm library into this app | \`mini_app_install({ appId, packages: [{ name: \"exceljs\" }] })\` | Then import it from main.api.ts. Not for UI. |`
2. `references/loader.md` Backend 节：在 lodash 那条后面加：app 可用 `mini_app_install` 装的包；UI 仍然不能。
3. `references/troubleshoot.md`：
   - 更新 `BACKEND_IMPORT` 那一行（对齐 T1 新文案）
   - 加一行：缺包 → 先 `mini_app_install`，不要改 UI import
4. SKILL.md 加 4 条规则（短）：
   - 先 `ctx.http` / `ctx.bash` / `ctx.tool`；只有必须 `import` Node 库时才 install
   - 禁止装 denylist
   - 禁止往 `ui.tsx` import 刚装的包
   - **不要**在 skill 里列 exceljs/kafkajs 推荐清单（会过期）

然后 `pnpm check:skill` 必须绿。

---

### T4 — 测试（不要依赖真实 exceljs 网络也可，优先纯 JS 小包）

文件：`packages/host/tests/apps-manager.test.ts` 和 `packages/host/tests/ui-compiler.test.ts`（已有 lodash 用例，照那个风格加）。

1. **loader 无 package.json**：`import "left-pad"`（或任意非 lodash 裸名）→ `HostError` / `BACKEND_IMPORT`，message 含 `mini_app_install`。
2. **denylist**：`installPackages(..., { packages: [{ name: "lodash" }] })` 必须抛，且 app 目录不能出现 `node_modules/lodash`。
3. **install + require**（可 mock spawn，或对一个极小纯 JS 包真装）：
   - 若走 mock：把 `npmInstall` 抽到可注入函数，测试里写假 `node_modules/fake-lib/index.js` + `package.json` dependencies，然后 `call` 一个 `import x from "fake-lib"` 的 api。
   - 若走真 npm：只用 `ms` 或类似很小的纯 JS 包；测试要设 timeout（30s+）；CI 没网则 skip。**优先 mock/手工 node_modules**，避免 CI 红。
4. **UI 仍拒绝**：`ui-compiler.test.ts` 里 `import x from "exceljs"` → compile throw（`Could not resolve` 或现有 forbidden）。不要为它加 SDK_SPECIFIER。
5. **路径逃逸**：resolve 到 appDir 外面 → BACKEND_IMPORT `outside this app's node_modules`。

不要删现有 lodash 测试。

---

### T5 — 验收（你做完自己跑）

```bash
pnpm --filter @monkey-mini-app/host test
pnpm --filter @monkey-mini-app/host typecheck
pnpm exec eslint packages/host/src/apps/apps-manager.ts packages/host/src/tools/tool-facade.ts
pnpm check:skill
```

RFC §6 对照：

- [ ] `minimal` / `todo` 仍无 package.json，reload 不碰网络
- [ ] 手工 node_modules 或 install 后 `main.api.ts` 能 import 该包并 `call` 成功
- [ ] `ui.tsx` import 同一包仍失败
- [ ] install lodash 被拒
- [ ] 未 install 的裸 import 仍 BACKEND_IMPORT 且提到 mini_app_install
- [ ] `mini_app_list_files` 仍看不到 node_modules（已有 SKIP_DIRS，补一个回归断言即可）
- [ ] **没有** Approve UI、没有 worker、没有改 VENDOR_IDS

---

