# @monkey-mini-app/dsh-monkey-mini-app

[English](README.md) | 中文

可安装的 **DeepSeek Harness（dsh）profile 组合包（bundle）**，把 monkey-mini-app 接到 Harness：模型侧 `mini_app_*` 工具、Agent **SKILL**，以及 `ctx.monkeyMiniApp` 上的多 Tab Host 会话。

遵循官方 **bundle** 约定：

- `package.json` → `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`
- `cordis.patch.yml` → 插入 `id: monkey-mini-app` 插件行
- Cordis 入口 → `export const name`、`inject`、`apply(ctx)`

文档：[打包并安装插件](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish)

## 安装

```sh
dsh plugin --profile web add @monkey-mini-app/dsh-monkey-mini-app
# 本地目录：
dsh plugin --profile web add /path/to/monkey-mini-app/packages/dsh-plugin
```

重启 / 重载 profile 后检查：

```sh
dsh --profile web --dump-config | grep -A3 'id: monkey-mini-app'
```

启动日志应包含：

```text
[monkey-mini-app] loaded · runtimeRoot=... · tools=... · skill=...
```

卸载：

```sh
dsh plugin --profile web remove @monkey-mini-app/dsh-monkey-mini-app
```

## 模型获得的能力

| 工具 | 作用 |
|------|------|
| `mini_app_list` / `get` / `validate` | 发现应用 |
| `mini_app_register` | 注册文件树到 runtime |
| `mini_app_open` / tabs 相关 | 多 Tab 打开与切换 |
| `mini_app_history_*` | commit / 树形历史 / reset / revert |
| `mini_app_set_theme` | Host 主题 |

操作规范见 `skills/monkey-mini-app/SKILL.md`，**不必阅读 runtime 源码**。

创建/编辑源码请用 **Harness 自带文件工具**；本插件负责 **runtime 语义**（注册、历史、Tab）。

## 配置

| 配置 / 环境变量 | 默认 |
|-----------------|------|
| `config.runtimeRoot` / `MONKEY_MINI_APP_ROOT` | `~/.monkey-mini-app/runtime` |
| `config.themeId` | `light` |

## 与 `@monkey-mini-app/adapter-dsh` 的关系

- **`dsh-plugin`**：标准 **可安装 bundle**（给 `dsh plugin add` 用）。
- **`adapter-dsh`**：早期 harness 无关的接线库；新集成请以本包为准。

## 已知限制

- 若当前 dsh 强制 `defineTool()`，需在 `apply` 内按你的 `@deepseek-ai/dsh-tools` 版本再包一层。
- Web 入口：client 半部在「新会话」右侧放 Apps 按钮（官方无该槽位，DOM 锚定），侧栏底部 `sidebar.footer.action` 再放一个。改完需重启 dsh web 并硬刷新。
- 默认使用 Node 写 `runtimeRoot`；与 dsh 沙箱 fs 的深度对齐待办。

## License

MIT
