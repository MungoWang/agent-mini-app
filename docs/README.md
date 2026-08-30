# Docs index

**LLM / agent 入口。** 写文档前先读本节纪律；实现契约以 skill + 下列 live 目录为准。

## 能写哪

| 目录 | 用途 | 何时写 |
|------|------|--------|
| [`architecture/`](./architecture/) | 现行架构（短、可执行） | 改分层 / 接缝 / 安装路径 |
| [`contracts/`](./contracts/) | 长期行为契约 | 改 `ctx.agent`、文件工具等对外协议 |
| [`rfcs/`](./rfcs/) | 未落地调研 | 新想法、端口方案；落地后提炼进上两栏 |
| [`archive/`](./archive/) | 历史只读 | **不要往这里叠新设计** |
| [`assets/`](./assets/) | 预览图 / HTML / CSS 样例 | 非契约物料 |

## 禁止

1. 在仓库根或 `docs/` 根新建长文（本 `README.md` 除外）。
2. 把实现细节复制进多份 md；skill 权威源：`packages/dsh/skills/monkey-mini-app/`。
3. 引用 `archive/**` 当作「当前该怎么做」。
4. 再引入已删除的旧包名当作 live 路径：`host-core` / `panel-core` / `dsh-plugin`（仅存在于 git tag `archive/pre-cutover-legacy-2026-08-29`）。

## Live 文档

- [architecture/overview.md](./architecture/overview.md) — 现行包面与组合根
- [contracts/agent.md](./contracts/agent.md) — `ctx.agent` / one-shot
- [contracts/file-tools.md](./contracts/file-tools.md) — mini_app 文件工具
- [rfcs/pi-extension-port.md](./rfcs/pi-extension-port.md) — PI 宿主调研（未实现）

## 本地开发

见仓库根 [`LOCAL.md`](../LOCAL.md) 与 [`AGENTS.md`](../AGENTS.md)。

## 历史快照

旧三包（`host-core` / `panel-core` / `dsh-plugin`）与旧文档全文：

```bash
git show archive/pre-cutover-legacy-2026-08-29:packages/host-core/package.json
# 或浏览 docs/archive/
```
