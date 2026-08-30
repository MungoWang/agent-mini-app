# mini_app 文件工具

Agent 读写小程序源码用 `mini_app_*`（不是直接 Write runtime）。

## 工具

| 工具 | 用途 |
|------|------|
| `mini_app_register` | **新建脚手架**（要 `manifest.json`） |
| `mini_app_list_files` | 列相对路径 + size |
| `mini_app_read` | 读文件；可选 `startLine`/`endLine`（闭区间）或 `offset`/`limit`；`numbered?`；返回 `totalLines` + 实际窗 |
| `mini_app_edit` | **主编辑**：`edits: [{ oldText, newText }]`（Pi 语义：唯一匹配 + 轻量 fuzzy） |
| `mini_app_write` | 全文创建/覆盖 |
| `mini_app_delete` | 删文件（不可删 manifest） |
| `mini_app_reload` | **替代 validate**：校验 + 同步编译 api/ui；成功且 dirty → auto-commit |
| `mini_app_call` / `open` / `history_*` | 保留不变 |

## 副作用

**mutate**（register / edit / write / delete）成功后：

1. 路径安全、manifest parse（若触及）
2. invalidate dashboard + UI 内存缓存
3. 默认 auto-commit（`commit: false` 可关）
4. **不**同步编译

**reload**：validate + 全量编译（预热缓存）+ dirty 时 commit `reload`。

## 编辑实现

`packages/host/src/apps/edit-diff.ts` 移植自 [Pi coding-agent edit-diff](https://github.com/badlogic/pi-mono)（MIT）。
