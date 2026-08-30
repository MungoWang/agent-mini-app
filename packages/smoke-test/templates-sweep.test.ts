import { describe, expect, it } from "vitest";

import { startHost, readTemplate, templateId, TEMPLATES } from "./fixture.ts";

// ⭐ 每个模板的"代表调用"：S1 的目标是证明【注册 → 编译 → 调用真实 api 键】全链路通。
// 断言每个模板至少能编译出 UI、且其声明的一个 api 方法可调用并返回对象。
const PROBE: Record<string, { method: string; args?: Record<string, unknown>; check?: (v: unknown) => boolean }> = {
  minimal: { method: "ping", check: (v) => (v as { appId?: string })?.appId !== undefined },
  todo: { method: "list", args: { filter: "all" }, check: (v) => Array.isArray((v as { items?: unknown })?.items) },
  monitor: { method: "getSnapshot", check: (v) => (v as { cpu?: unknown })?.cpu !== undefined },
  review: { method: "get", check: (v) => (v as { before?: string })?.before !== undefined },
  insights: { method: "latest", check: (v) => Array.isArray((v as { items?: unknown })?.items) },
  agentrun: { method: "runStatus", check: (v) => typeof (v as { status?: string })?.status === "string" },
  jira: { method: "list", check: (v) => Array.isArray((v as { issues?: unknown })?.issues) },
};

describe("S1 · every skill template registers + compiles + answers a real call", () => {
  it.each(TEMPLATES)("%s", async (name) => {
    const id = templateId(name);
    const { host, services } = await startHost();
    try {
      await services.apps.register(id, readTemplate(name));

      // compile check: the UI bundle must build (no bad import / missing component)
      const url = `http://127.0.0.1:${host.port}/api/app/${encodeURIComponent(id)}/ui/entry.js`;
      const res = await fetch(url);
      expect(res.status).toBe(200);
      const bundle = await res.text();
      expect(bundle.startsWith('{"error"')).toBe(false);
      expect(bundle.length).toBeGreaterThan(1000);

      // real api call through the public path: call returns a string per contract? No — apps.call returns the value.
      const probe = PROBE[name];
      const value = await services.apps.call(id, probe.method, probe.args ?? {});
      expect(probe.check ? probe.check(value) : value !== null).toBe(true);
    } finally {
      await host.stop();
    }
  }, 60_000);
});
