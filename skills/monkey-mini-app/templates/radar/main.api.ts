import { defineApp } from "@monkey-mini-app/api";

import { runRefresh } from "./api/scan";
import { type Payload, type Progress } from "./shared/events";
import { SAMPLE_ITEMS } from "./shared/sample";

export default defineApp({
  name: "信息雷达",
  description: "拉源、做简报、长任务可取消",
  api: {
    async latest(ctx): Promise<Payload> {
      return (await ctx.storage.get("latest")) || { items: SAMPLE_ITEMS, digest: null, at: 0 };
    },

    // fire-and-forget: returns immediately; api/scan.ts pushes progress over SSE
    async scan(ctx) {
      void runRefresh(ctx);
      return { ok: true };
    },

    async scanStatus(ctx): Promise<Progress> {
      return (await ctx.storage.get("progress")) || { running: false, step: "idle", done: 0, total: 3 };
    },

    async refresh(ctx) {
      return runRefresh(ctx);
    },
  },
});
