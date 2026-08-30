import { defineDashboard } from "@monkeyagent/dashboard";

// ⭐ 关键：StatusBadge / health 类组件认的都是小写状态词（pass|fail|blocked|flaky|running|pending），
//         不要用 "PASS"/"FAIL" 之类大写 —— 会落到默认 pending 灰色、颜色全错。
type CaseStatus = "pass" | "fail" | "blocked";
type TestCase = { id: string; name: string; status: CaseStatus; duration: number };
type LogLine = { level: "info" | "debug" | "warn" | "error"; text: string };

const DEFAULT_BEFORE = `function fetchWithRetry(url) {
  const res = fetch(url); // 网络错误直接抛，无重试
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res;
}`;

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

const CASES: TestCase[] = [
  { id: "TC-01", name: "正常请求返回", status: "pass", duration: 42 },
  { id: "TC-02", name: "一次失败后重试成功", status: "pass", duration: 310 },
  { id: "TC-03", name: "重试耗尽抛错", status: "fail", duration: 1204 },
  { id: "TC-04", name: "非 2xx 状态码处理", status: "blocked", duration: 0 },
];

export default defineDashboard({
  name: "修复基准",
  description: "编辑 → diff 对比 → 用例表格，改完写回",
  api: {
    async get(ctx) {
      const saved = await ctx.storage.get("after");
      return {
        before: DEFAULT_BEFORE,
        after: typeof saved === "string" && saved ? saved : DEFAULT_AFTER,
        cases: CASES,
        logs: [
          { level: "info", text: "[10:00:01] 复现：无网络时 fetchWithRetry 直接抛错" },
          { level: "info", text: "[10:00:02] 分析：缺少异常捕获与重试逻辑" },
          { level: "debug", text: "[10:00:03] 方案：增加 retries 参数 + try/catch 循环" },
          { level: "warn", text: "[10:00:04] 回归结果：2 通过 / 1 失败 / 1 阻塞" },
        ] as LogLine[],
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
