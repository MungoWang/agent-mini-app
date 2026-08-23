import { defineDashboard } from "@monkeyagent/dashboard";

export default defineDashboard({
  name: "Hello",
  description: "Ping host clock",
  api: {
    async ping(ctx) {
      ctx.log("ping");
      return { now: Date.now(), theme: ctx.config?.theme ?? "light" };
    },
  },
});
