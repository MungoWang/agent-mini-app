1. skill 强化，增加引导
目标：构建一套完整的Agent Skill，实现从用户模糊自然语言需求 → 挖掘真实意图 → 输出标准化产品PRD → 自动生成可直接运行的 ui.tsx + main.ts 原型应用，解决用户输入宽泛需求（例如“做一个Jira看板”）导致产出大而全、偏离真实诉求的问题。
整体工作流（串行闭环）

2. ui sdk 中增加开箱即用的 utils 和 motion 动画包？ 
   api 中增加 utils 包，最好跟 ui 适用同一个包，另外最好是 LLM 比较熟悉的。

3. 优化 templates，目前都 templates 仍然不够好，不具备差异化的代表性。我们的每个 template，需要有鲜明的特色和差异化特性，否则就是重复，浪费 tokens。
4. 优化 examples - 
   4.1. 尽量提供高级点的用法。 
   4.2. paradigms 目前不够专业，要使用专业的 ui ux skill 重新设计。 
   4.3. 提供常见的 OR 复杂点的 layouts presets。

5. 安全性和安全边界，以及 readme 声明和免责。

6. 加入如何 build 自定义 mini-app theme的引导

6. 实测 Agent 生成 app 的效率。

7. 搞一个 tauri mini app ? OR base 在一个开源的 pi desktop 上？给开源 pi desktop 增加插件化能力？