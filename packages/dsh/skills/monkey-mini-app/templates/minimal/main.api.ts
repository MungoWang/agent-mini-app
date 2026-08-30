import { defineDashboard } from "@monkeyagent/dashboard";

export default defineDashboard({
  name: "骨架示例",
  description: "最小可运行：一次 call 往返 + 读 Host 配置",
  api: {
    // ⭐ 关键：每个方法都拿到同一个 ctx —— appId / appDir / storage / config / log / 能力(这页不用)
    async ping(ctx) {
      return {
        appId: ctx.appId,                      // 当前小程序 reverse-DNS id
        theme: ctx.config?.theme ?? "light",   // 跟随 Host 设置（设置页 / 顶栏可改）
        now: Date.now(),
      };
    },
  },
});
