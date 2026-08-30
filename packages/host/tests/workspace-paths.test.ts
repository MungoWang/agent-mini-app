import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  HostError,
  asAbsolutePath,
  asAppId,
  assertNever,
  isAbsolutePath,
  isAppId,
  WorkspacePaths,
} from "@monkey-mini-app/host";

describe("AppId brand helpers", () => {
  it("accepts reverse-DNS ids", () => {
    const id = asAppId("com.example.todo");
    expect(id).toBe("com.example.todo");
    expect(isAppId("com.example.todo")).toBe(true);
  });

  it("rejects empty, path-like, and non reverse-DNS values", () => {
    expect(() => asAppId("")).toThrow(HostError);
    expect(() => asAppId("todo")).toThrow(HostError);
    expect(() => asAppId("../etc")).toThrow(HostError);
    expect(() => asAppId("com/example")).toThrow(HostError);
    expect(isAppId("com/example")).toBe(false);
  });
});

describe("AbsolutePath brand helpers", () => {
  it("accepts absolute paths and rejects relative ones", () => {
    const abs = asAbsolutePath("/tmp/runtime");
    expect(abs).toBe("/tmp/runtime");
    expect(isAbsolutePath("/tmp/runtime")).toBe(true);
    expect(isAbsolutePath("runtime")).toBe(false);
    expect(() => asAbsolutePath("runtime")).toThrow(HostError);
  });
});

describe("assertNever", () => {
  it("throws HostError", () => {
    expect(() => assertNever("nope" as never)).toThrow(HostError);
  });
});

describe("WorkspacePaths", () => {
  const root = asAbsolutePath("/tmp/mma-runtime");
  const id = asAppId("com.example.todo");

  it("joins appDir as apps/<id>", () => {
    const paths = new WorkspacePaths(root);
    expect(paths.appDir(id)).toBe(path.join(root, "apps", "com.example.todo"));
  });

  it("exposes appsDir, hostConfigFile, and appFile from Rel", () => {
    const paths = new WorkspacePaths(root);
    expect(WorkspacePaths.Rel.apps).toBe("apps");
    expect(WorkspacePaths.Rel.hostConfig).toBe("host.json");
    expect(WorkspacePaths.Rel.ui).toBe("ui.tsx");
    expect(WorkspacePaths.Rel.uiCache).toBe(".ui-cache");
    expect(paths.appsDir()).toBe(path.join(root, WorkspacePaths.Rel.apps));
    expect(paths.hostConfigFile()).toBe(path.join(root, WorkspacePaths.Rel.hostConfig));
    expect(paths.uiCacheDir()).toBe(path.join(root, WorkspacePaths.Rel.uiCache));
    expect(paths.appFile(id, WorkspacePaths.Rel.ui)).toBe(
      path.join(root, "apps", "com.example.todo", "ui.tsx"),
    );
    expect(paths.appFile(id, WorkspacePaths.Rel.api)).toBe(
      path.join(root, "apps", "com.example.todo", "main.api.ts"),
    );
    expect(paths.appFile(id, WorkspacePaths.Rel.manifest)).toBe(
      path.join(root, "apps", "com.example.todo", "manifest.json"),
    );
  });

  it("rejects a relative constructor root", () => {
    expect(() => new WorkspacePaths("runtime" as never)).toThrow(HostError);
  });

  it("rejects appFile paths that escape the app dir", () => {
    const paths = new WorkspacePaths(root);
    expect(() => paths.appFile(id, "../sibling")).toThrow(HostError);
    expect(() => paths.appFile(id, "/etc/passwd")).toThrow(HostError);
  });
});
