import { defineDashboard } from "@monkeyagent/dashboard";

/** 修复前的代码（有 bug 的版本） */
const DEFAULT_BEFORE = `function fetchWithRetry(url) {
  const res = fetch(url); // 网络错误直接抛，无重试
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res;
}`;

/** 修复后的代码（带重试与异常处理） */
const DEFAULT_AFTER = `function fetchWithRetry(url, retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = fetch(url);
      if (res.ok) return res;
      lastErr = new Error("HTTP " + res.status);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}`;

const LOGS = [
  { level: "info", text: "[10:00:01] 复现：无网络时 fetchWithRetry 直接抛错" },
  { level: "info", text: "[10:00:02] 分析：缺少异常捕获与重试逻辑" },
  { level: "debug", text: "[10:00:03] 方案：增加 retries 参数 + try/catch 循环" },
  { level: "warn", text: "[10:00:04] 回归结果：2 通过 / 1 失败 / 1 阻塞" },
];

const CASES = [
  { id: "TC-01", name: "正常请求返回", status: "PASS", duration: 42 },
  { id: "TC-02", name: "一次失败后重试成功", status: "PASS", duration: 310 },
  { id: "TC-03", name: "重试耗尽抛错", status: "FAIL", duration: 1204 },
  { id: "TC-04", name: "非 2xx 状态码处理", status: "BLOCKED", duration: 0 },
];

export default defineDashboard({
  name: "修复工坊",
  description: "修复前后 diff 对比、执行日志与用例结果",
  api: {
    async get(ctx) {
      const saved = await ctx.storage.get("after");
      return {
        before: DEFAULT_BEFORE,
        after: typeof saved === "string" && saved ? saved : DEFAULT_AFTER,
        logs: LOGS,
        cases: CASES,
        savedAt: (await ctx.storage.get("savedAt")) || 0,
      };
    },
    async save(ctx, args?: { after?: string }) {
      const code = String(args?.after ?? "").trim();
      if (!code) throw new Error("代码不能为空");
      await ctx.storage.set("after", code);
      await ctx.storage.set("savedAt", Date.now());
      return { ok: true, savedAt: Date.now() };
    },
    async reset(ctx) {
      await ctx.storage.set("after", DEFAULT_AFTER);
      await ctx.storage.set("savedAt", 0);
      return { ok: true, savedAt: 0 };
    },
  },
});
