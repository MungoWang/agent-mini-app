import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseHostConfig } from "@monkey-mini-app/host";

import { writeHostConfig } from "../../../scripts/mma-init.ts";

describe("writeHostConfig", () => {
  it("writes a complete host.json via bootstrap and does not clobber a valid file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mma-init-"));
    const first = writeHostConfig({ runtimeRoot: dir, hostPort: 19111 });
    expect(first.wrote).toBe(true);
    const raw = JSON.parse(readFileSync(first.file, "utf8")) as unknown;
    const parsed = parseHostConfig(raw);
    expect(parsed.hostPort).toBe(19111);
    expect(parsed.theme).toBe("light");
    expect(parsed.locale).toBe("zh-CN");
    expect(parsed.llm).toBeNull();
    const second = writeHostConfig({ runtimeRoot: dir, hostPort: 0 });
    expect(second.wrote).toBe(false);
    expect(parseHostConfig(JSON.parse(readFileSync(first.file, "utf8"))).hostPort).toBe(19111);
  });
});
