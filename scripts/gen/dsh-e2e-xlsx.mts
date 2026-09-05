#!/usr/bin/env node
/**
 * Generate the real `.xlsx` that `apps/dsh-host/e2e/spreadsheet.spec.ts` uploads.
 *
 * It is a binary fixture on purpose: the point of that spec is that a real workbook (two
 * sheets, a date column, and a **formula** cell whose cached result is what we read) reaches
 * `exceljs` in the app's own `node_modules`. A hand-written stub would test the reader and
 * nothing else. Regenerate whenever the numbers below change — the spec asserts on them.
 *
 * Covered cell shapes (`cellText()` in the template):
 * number · float · empty→null · rich text? (no) · Date → `YYYY-MM-DD` · {formula,result} → result
 *
 * Inputs:       none (uses the repo's exceljs devDependency)
 * Writes:       apps/dsh-host/e2e/fixtures/运输明细.xlsx
 * Side effects: repo tracked file
 * Run as:       manual — `pnpm exec tsx scripts/gen/dsh-e2e-xlsx.mts`
 */
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = path.join(appDir, "apps/dsh-host/e2e/fixtures");
const outFile = path.join(outDir, "运输明细.xlsx");

/** 承运商 / 票数 / 运费 / 单票均价(formula) / 备注 / 发运日期 */
const ROWS: {
  carrier: string;
  trips: number;
  freight: number;
  note: string;
  date: string;
}[] = [
  { carrier: "顺丰", trips: 12, freight: 45230.5, note: "冷链", date: "2026-09-01" },
  { carrier: "中通", trips: 30, freight: 21980, note: "", date: "2026-09-01" },
  { carrier: "德邦", trips: 5, freight: 61212.25, note: "大件", date: "2026-09-02" },
  { carrier: "顺丰", trips: 18, freight: 39002, note: "", date: "2026-09-02" },
  { carrier: "圆通", trips: 44, freight: 15800, note: "促包", date: "2026-09-03" },
  { carrier: "德邦", trips: 7, freight: 51430.1, note: "", date: "2026-09-03" },
  { carrier: "中通", trips: 22, freight: 26300, note: "改派", date: "2026-09-04" },
  { carrier: "顺丰", trips: 9, freight: 71200.75, note: "大件", date: "2026-09-04" },
];

const DELAYS: { no: string; hours: number; owner: string }[] = [
  { no: "SO-1042", hours: 26, owner: "承运商" },
  { no: "SO-1088", hours: 9, owner: "仓库" },
  { no: "SO-1130", hours: 41, owner: "承运商" },
];

function sum(nums: number[]): number {
  return Number(nums.reduce((a, b) => a + b, 0).toFixed(2));
}
function mean(nums: number[]): number {
  return Number((sum(nums) / nums.length).toFixed(2));
}

async function main(): Promise<void> {
  const wb = new ExcelJS.Workbook();

  const ship = wb.addWorksheet("运输明细");
  ship.addRow(["承运商", "票数", "运费", "单票均价", "备注", "发运日期"]);
  ROWS.forEach((r, i) => {
    const row = ship.addRow([r.carrier, r.trips, r.freight, null, r.note, new Date(r.date)]);
    // ⭐ a formula cell: exceljs stores `{ formula, result }`, so the reader must take
    //    `result` — a naive `String(value)` here is what produces [object Object].
    row.getCell(4).value = { formula: `C${i + 2}/B${i + 2}`, result: Number((r.freight / r.trips).toFixed(2)) };
  });

  const bad = wb.addWorksheet("异常登记");
  bad.addRow(["单号", "延误小时", "责任方"]);
  DELAYS.forEach((d) => bad.addRow([d.no, d.hours, d.owner]));

  const buf = await wb.xlsx.writeBuffer();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, Buffer.from(buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf));

  const trips = ROWS.map((r) => r.trips);
  const freight = ROWS.map((r) => r.freight);
  const hours = DELAYS.map((d) => d.hours);
  console.log(`wrote ${path.relative(appDir, outFile)} (${statSync(outFile).size} bytes)`);
  console.log(
    JSON.stringify(
      {
        sheets: 2,
        rowsTotal: ROWS.length + DELAYS.length,
        票数: { total: sum(trips), avg: mean(trips), min: Math.min(...trips), max: Math.max(...trips) },
        运费: { total: sum(freight), avg: mean(freight), min: Math.min(...freight), max: Math.max(...freight) },
        延误小时: { total: sum(hours), avg: mean(hours), min: Math.min(...hours), max: Math.max(...hours) },
      },
      null,
      2,
    ),
  );
  console.log("→ paste these into e2e/spreadsheet.spec.ts if you change the data");
}

await main();
