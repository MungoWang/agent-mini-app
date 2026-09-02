import { defineApp } from "@monkey-mini-app/api";

export default defineApp({
  name: "组件库",
  description: "主流组件分区展示",
  api: {
    async ping() {
      return { ok: true, at: Date.now() };
    },
  },
});
