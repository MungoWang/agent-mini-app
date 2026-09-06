Items 1–5 (utils/motion, layout presets, templates, security disclaimer, custom theme) → [`authoring-surface.md`](./authoring-surface.md).

README “why not HTML / a local Python site” → landed in root `README.md` / `README.zh.md`.

Backend packages (Kafka / Excel / vendor SDKs, not a host driver list) → [`per-app-packages.md`](./per-app-packages.md).

README 里加个 section
能做什么  做什么你自己来决定，不需要会写代码，直接告诉 AI 你的诉求，一个完整的应用就在眼前。
比如做个自己的 jira dashboard？任务进度管理？sprints 管理？
做个自己的工作台桌面，对接各种任务信息合并显示，工作日报？工时记录？
做个自定义的 AI 雷达，接入各种配置化的数据源？
等等

6 skill 强化，增加引导
目标：构建一套完整的Agent Skill，实现从用户模糊自然语言需求 → 挖掘真实意图 → 输出标准化产品PRD → 自动生成可直接运行的 ui.tsx + main.ts 原型应用，解决用户输入宽泛需求（例如“做一个Jira看板”）导致产出大而全、偏离真实诉求的问题。
整体工作流（串行闭环）

7. 搞一个 tauri mini app ? OR base 在一个开源的 pi desktop 上？给开源 pi desktop 增加插件化能力？

8. 实测 Agent 生成 app 的效率。
