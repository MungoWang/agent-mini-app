# monkey-mini-app — 本地快速运行

## 依赖

- Node.js ≥ 20
- 网络（首次装 `dsh` / `pnpm` / `isomorphic-git`）

## 一键

```bash
unzip monkey-mini-app.zip
cd monkey-mini-app
chmod +x scripts/*.sh
bash scripts/setup.sh
```

## 两条路径

### A. 只看 Host Demo（不需要 dsh）

```bash
bash scripts/run-demo.sh
# → http://127.0.0.1:8080
```

- 多 Tab：Hello / Counter  
- Counter 写入 `~/.monkey-mini-app/runtime/apps/com.example.counter/storage/default.json`（可用 `MONKEY_MINI_APP_ROOT` 改）

### B. dsh web + 本地 link 插件（和开发机同一套）

```bash
# setup.sh 已执行过则跳过；单独重装：
bash scripts/install-dsh-plugin.sh

dsh web --no-open --port 3080
# → http://127.0.0.1:3080
```

启动日志应出现：

```text
[monkey-mini-app] loaded · tools=13 · skill=...
```

插件以 **path link** 挂到 `~/.dsh/profiles/web`：

```text
pnpm add -w /绝对路径/packages/dsh-plugin
# package.json → dsh.profile.bundles 含 "@monkey-mini-app/dsh-plugin"
```

## Demo / 示例

| 路径 | 说明 |
|------|------|
| `demo/server.mjs` | Host 视觉 Demo 服务 |
| `examples/com.example.hello` | 最小 UI 示例 |
| `examples/com.example.counter` | storage 示例 |
| `packages/agent-skills/skills/monkey-mini-app/SKILL.md` | Agent 创建规范（唯一源） |
| `packages/dsh-plugin` | dsh bundle（`lib/` 已预构建） |

## 环境变量

| 变量 | 默认 | 含义 |
|------|------|------|
| `MONKEY_MINI_APP_ROOT` | `~/.monkey-mini-app/runtime` | apps 运行态根目录 |
| `DSH_HOME` | `~/.dsh` | dsh 配置与 profile |
| `PORT` | `8080` | demo 端口 |

## 排错

1. **`tools.register failed`** — 需 dsh-tools 支持的 `defineTool` + `output.schema`；本仓库 `lib/index.js` 已按当前 dsh 修好。  
2. **找不到 isomorphic-git** — `cd packages/dsh-plugin && npm i isomorphic-git`  
3. **pnpm workspace root 警告** — 安装脚本已用 `pnpm add -w`。  
4. **插件未进 composition** — 看 `~/.dsh/profiles/web/package.json` 的 `dsh.profile.bundles`。

## 设计文档

见同级或包内：`monkey-mini-app-design.md`（若与 zip 一并打包）。
