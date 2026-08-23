# 排错

| 现象 | 先查 |
|------|------|
| `/api/apps` 404 | dsh 插件没起来或 port 不是 17880 |
| `already been declared defineDashboard` | 旧 loader；当前应只从 require dashboard 来 |
| 对象字面量/正则被编坏 | 旧 `compileAppSource` 乱剥 `: type` |
| `llm unavailable` + 其实聊天能用 | 应走 `ctx.llm.stream`；或 POST `/api/llm-config` |
| bash `policy.mode` undefined | 用本地 `bash -c` 路径，不要依赖坏的 sandbox policy |
| UI 空白 / CDN | esm.sh 被拦 |
| iframe 一条缝 | 不是 app 的问题，是 host iframe 高度 |
| MCP 没反应 | args 不要包 `{ input }` |
