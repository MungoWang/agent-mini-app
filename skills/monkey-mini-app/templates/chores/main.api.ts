import { defineApp } from "@monkey-mini-app/api";

type Job = { id: string; title: string; command: string };

// ⭐ key: chores are named buttons with a known command — not a prompt for ctx.agent.
const JOBS: Job[] = [
  { id: "disk", title: "磁盘用量", command: "df -k / | tail -1" },
  { id: "top", title: "最耗 CPU", command: "ps -axo pid,pcpu,pmem,comm -r | head -n 6" },
  { id: "who", title: "这台机器", command: "uname -a" },
];

export default defineApp({
  name: "一键杂事",
  description: "三个按钮，在这台机器上跑已知脚本，结果回到 app",
  api: {
    async jobs() {
      return { jobs: JOBS.map(({ id, title }) => ({ id, title })) };
    },
    async run(ctx, args?: { id?: string }) {
      const job = JOBS.find((j) => j.id === args?.id);
      if (!job) throw new Error("没有这个按钮");
      // ⭐ key: ctx.bash is the point — stdout/stderr/exitCode come back into the UI, not a terminal window.
      const result = await ctx.bash(job.command);
      return {
        id: job.id,
        title: job.title,
        command: job.command,
        stdout: String(result.stdout ?? ""),
        stderr: String(result.stderr ?? ""),
        exitCode: result.exitCode,
        at: Date.now(),
      };
    },
  },
});
