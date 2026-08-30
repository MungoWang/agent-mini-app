# ctx.tool 能调什么

**不要把本文件当固定目录。** 工具集随 dsh profile / 插件 / MCP 变化。

生成或改 `main.api.ts` **并且确实要用 `ctx.tool`** 时才：

1. 调聊天工具 `mini_app_list_ctx_tools`（无参）
2. 人类调试才 `curl -s http://127.0.0.1:17880/api/ctx-tools`

返回 `{ count, tools: [{ name, description, schema }] }`。  
`name` 就是 `ctx.tool(name, args)` 的第一参；`schema` 是参数形状（可能叫 parameters / inputSchema）。

`args` 必须是普通 JSON 对象（`{}` 可以）。禁止 `{ input: "..." }`、`Date`、function、`AbortSignal`。无参工具传 `{}`。

## 写 app 时的优先级

1. `ctx.storage` / `ctx.http` / `ctx.bash` / `ctx.llm` / `ctx.system.metrics`
2. 只有明确要复用 dsh 已有工具（读工作区文件等）才 `ctx.tool`
3. MCP 用 `ctx.mcp("server__tool", args)`，不要 `{ input }`

`ctx.listTools()` 在后端同样返回这份快照。
