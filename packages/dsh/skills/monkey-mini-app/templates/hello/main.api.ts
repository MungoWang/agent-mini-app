import { defineDashboard } from "@monkeyagent/dashboard";

export default defineDashboard({
  name: "连通检查",
  description: "确认小程序已经连上 Host",
  api: {
    async ping(ctx) {
      return {
        now: Date.now(),
        theme: ctx.config?.theme ?? "light",
      };
    },
  },
});
