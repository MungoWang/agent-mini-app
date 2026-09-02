import { defineApp } from "@monkey-mini-app/sdk";

export default defineApp({
  name: "骨架示例",
  description: "最小可运行：一次 call 往返 + 读 Host 配置",
  api: {
    // ⭐ key: every method receives the same ctx — appId / appDir / storage / config / log / capabilities (unused on this page)
    async ping(ctx) {
      return {
        appId: ctx.appId,                      // reverse-DNS id of the current mini-app
        theme: ctx.config?.theme ?? "light",   // follows the Host theme (changeable in Settings / top bar)
        now: Date.now(),
      };
    },
  },
});
