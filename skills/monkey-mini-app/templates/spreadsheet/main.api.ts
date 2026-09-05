// ⭐ This template needs ONE library the platform does not ship. Before `mini_app_reload`:
//    mini_app_install({ appId: "com.example.spreadsheet", packages: [{ name: "exceljs" }] })
// It lands in this app's own node_modules (--ignore-scripts, lockfile committed,
// node_modules not). `ui.tsx` still cannot import it — the browser bundle has its own
// closed surface, so the workbook is parsed here and the UI only sees JSON.
import ExcelJS from "exceljs";

// ⭐ Platform module: full lodash on both sides. Aggregates below are the case it pays for.
import { mean, sum } from "lodash";

import { defineApp } from "@monkey-mini-app/api";

type SheetData = {
  name: string;
  headers: string[];
  /** Capped preview rows; aggregates are computed over every row. */
  rows: Record<string, string | number>[];
  rowCount: number;
  columns: {
    header: string;
    numeric: boolean;
    count: number;
    min?: number;
    max?: number;
    total?: number;
    avg?: number;
  }[];
};

type Report = {
  id: string;
  fileName: string;
  createdAt: number;
  sheetCount: number;
  rowCount: number;
  digest?: { headline: string; bullets: string[] };
};

const PREVIEW_CAP = 300;

/**
 * An `.xlsx` cell is not always a primitive: formulas carry `{ result }`, rich text
 * carries `richText[]`, dates are `Date`, hyperlinks wrap `{ text }`. Passing those
 * straight to the UI gives `[object Object]` in half the columns.
 */
function cellText(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "boolean")
    return typeof value === "boolean" ? String(value) : value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("result" in v) return cellText(v.result);
    if ("text" in v) return cellText(v.text);
    if (Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[])
        .map((p) => p.text ?? "")
        .join("");
    }
  }
  return String(value);
}

function toNumberOrNull(value: string | number | null): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null) return null;
  const cleaned = String(value).replace(/[,\s%]/g, "");
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * ⭐ exceljs re-declares a **global** `interface Buffer extends ArrayBuffer`, which poisons the
 * `Buffer` *type name* everywhere it is imported — so the app works in `Uint8Array` and hands
 * the reader a plain ArrayBuffer. (`as any` would hide the next real mismatch.)
 */
function toArrayBuffer(b: Uint8Array): ArrayBuffer {
  return b.buffer.slice(
    b.byteOffset,
    b.byteOffset + b.byteLength,
  ) as ArrayBuffer;
}

async function parseWorkbook(
  data: Uint8Array,
): Promise<{ sheets: SheetData[] }> {
  const wb = new ExcelJS.Workbook();
  // exceljs parses the bytes in-process: no temp file on disk, nothing uploaded.
  await wb.xlsx.load(toArrayBuffer(data));
  const sheets: SheetData[] = [];
  wb.worksheets.forEach((ws) => {
    if (!ws.rowCount) return;
    const headerRow = ws.getRow(1);
    const width = headerRow.cellCount;
    const headers: string[] = [];
    for (let c = 1; c <= width; c++) {
      headers.push(String(cellText(headerRow.getCell(c).value) ?? `列${c}`));
    }

    const matrix: (string | number | null)[][] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const line: (string | number | null)[] = [];
      for (let c = 1; c <= width; c++)
        line.push(cellText(row.getCell(c).value));
      if (line.some((x) => x !== null && x !== "")) matrix.push(line);
    });

    const columns = headers.map((header, i) => {
      const nums = matrix
        .map((r) => toNumberOrNull(r[i] ?? null))
        .filter((n): n is number => n !== null);
      // A column is numeric when most of its cells parse as numbers: one stray text
      // cell in an amount column must not demote the whole column to text.
      const numeric = nums.length > 0 && nums.length >= matrix.length * 0.6;
      return {
        header,
        numeric,
        count: matrix.length,
        min: numeric ? Math.min(...nums) : undefined,
        max: numeric ? Math.max(...nums) : undefined,
        total: numeric ? Number(sum(nums).toFixed(2)) : undefined,
        avg: numeric ? Number(mean(nums).toFixed(2)) : undefined,
      };
    });

    sheets.push({
      name: ws.name,
      headers,
      rowCount: matrix.length,
      columns,
      rows: matrix.slice(0, PREVIEW_CAP).map((r) => {
        const obj: Record<string, string | number> = {};
        headers.forEach((h, i) => {
          obj[h] = (r[i] ?? "") as string | number;
        });
        return obj;
      }),
    });
  });
  return { sheets };
}

function digestPrompt(sheets: SheetData[]): string {
  const lines: string[] = [];
  for (const s of sheets.slice(0, 6)) {
    lines.push(`### ${s.name}（${s.rowCount} 行）`);
    for (const c of s.columns.slice(0, 12)) {
      lines.push(
        c.numeric
          ? `- ${c.header}: n=${c.count} 合计=${c.total} 均值=${c.avg} 最小=${c.min} 最大=${c.max}`
          : `- ${c.header}: 文本列，${c.count} 行`,
      );
    }
  }
  return [
    "下面是用户本机一份 Excel 的结构与数值汇总（已抽样，未逐行列出）。",
    "用中文写业务结论，不要复述列名清单，不要提 lodash / exceljs / storage 这些实现细节。",
    "",
    lines.join("\n"),
    "",
    "返回 JSON：{ headline: 一句话结论, bullets: 3-5 条值得关注的点（含具体数字） }",
  ].join("\n");
}

async function loadSheets(ctx, id: string): Promise<SheetData[]> {
  const stored = await ctx.storage.table("reports").get(id);
  if (!stored || !Array.isArray(stored.sheets)) {
    throw new Error("找不到该报表，请重新拖入文件");
  }
  return stored.sheets as SheetData[];
}

export default defineApp({
  name: "报表摘要",
  description: "本机 Excel 解析 + 模型摘要 + 历史记录",
  api: {
    /** ⭐ History survives reload: the parse result lives on disk, not in a tab. */
    async list(ctx) {
      const index = await ctx.storage.get("index");
      return Array.isArray(index) ? index : [];
    },

    async ingest(ctx, args) {
      const fileName = String(args?.fileName ?? "").trim() || "未命名报表";
      const base64 = String(args?.base64 ?? "");
      if (!base64) throw new Error("文件内容为空");

      const data = new Uint8Array(Buffer.from(base64, "base64"));
      let sheets: SheetData[];
      try {
        sheets = (await parseWorkbook(data)).sheets;
      } catch (cause) {
        throw new Error(
          `无法读取这个 Excel：${cause instanceof Error ? cause.message : String(cause)}（仅支持 .xlsx，旧版 .xls 需要先另存为 .xlsx）`,
        );
      }
      if (!sheets.length) throw new Error("工作簿里没有带数据的表");

      const id = "r_" + Date.now().toString(36);
      const report = {
        id,
        fileName,
        createdAt: Date.now(),
        sheetCount: sheets.length,
        rowCount: sheets.reduce((n, s) => n + s.rowCount, 0),
      };

      // ⭐ Big payload → its own table (one file per report); the index stays tiny so
      //    `list` is cheap. Same reason the UI gets preview rows, not the whole sheet.
      await ctx.storage.table("reports").set(id, { ...report, sheets });
      const index = [report, ...((await ctx.storage.get("index")) ?? [])].slice(
        0,
        30,
      );
      await ctx.storage.set("index", index);

      return { ...report, sheets };
    },

    /** ⭐ The host's model, called from a button. No API key in this file, no second SDK. */
    async digest(ctx, args) {
      const id = String(args?.id ?? "");
      const sheets = await loadSheets(ctx, id);
      const text = await ctx.llm(digestPrompt(sheets), {
        schema: {
          type: "object",
          properties: {
            headline: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
          },
          required: ["headline", "bullets"],
        },
      });
      let digest = { headline: "模型没有返回结论", bullets: [] as string[] };
      try {
        const parsed = JSON.parse(text);
        digest = {
          headline: String(parsed.headline ?? digest.headline),
          bullets: Array.isArray(parsed.bullets)
            ? parsed.bullets.map(String)
            : [],
        };
      } catch {
        digest = { headline: text.slice(0, 120), bullets: [] };
      }

      const stored = await ctx.storage.table("reports").get(id);
      await ctx.storage.table("reports").set(id, { ...stored, digest });
      const index = ((await ctx.storage.get("index")) ?? []).map((r) =>
        r.id === id ? { ...r, digest } : r,
      );
      await ctx.storage.set("index", index);
      return digest;
    },

    async remove(ctx, args) {
      const id = String(args?.id ?? "");
      await ctx.storage.table("reports").delete(id);
      await ctx.storage.set(
        "index",
        ((await ctx.storage.get("index")) ?? []).filter((r) => r.id !== id),
      );
      return { ok: true };
    },
  },
});
