import path from "node:path";

import { asAbsolutePath, asAppId, type AbsolutePath, type AppId } from "../brand.ts";
import { HostError } from "../errors.ts";

function joinUnder(root: AbsolutePath, ...parts: string[]): AbsolutePath {
  return asAbsolutePath(path.join(root, ...parts));
}

/** Owns all path composition under a validated absolute runtime root. */
export class WorkspacePaths {
  static readonly Rel = {
    apps: "apps",
    hostConfig: "host.json",
    ui: "ui.tsx",
    api: "main.api.ts",
    manifest: "manifest.json",
    storage: "storage",
    uiCache: ".ui-cache",
  } as const;

  readonly root: AbsolutePath;

  constructor(root: AbsolutePath) {
    this.root = asAbsolutePath(path.resolve(asAbsolutePath(root)));
  }

  appsDir(): AbsolutePath {
    return joinUnder(this.root, WorkspacePaths.Rel.apps);
  }

  appDir(id: AppId): AbsolutePath {
    return joinUnder(this.root, WorkspacePaths.Rel.apps, asAppId(id));
  }

  hostConfigFile(): AbsolutePath {
    return joinUnder(this.root, WorkspacePaths.Rel.hostConfig);
  }

  uiCacheDir(): AbsolutePath {
    return joinUnder(this.root, WorkspacePaths.Rel.uiCache);
  }

  appFile(id: AppId, rel: string): AbsolutePath {
    const base = this.appDir(id);
    if (!rel || path.isAbsolute(rel)) {
      throw new HostError("INVALID_PATH", `unsafe relative path: ${rel}`);
    }
    const resolved = path.resolve(base, rel);
    const prefix = base.endsWith(path.sep) ? base : `${base}${path.sep}`;
    if (resolved !== base && !resolved.startsWith(prefix)) {
      throw new HostError("INVALID_PATH", `unsafe relative path: ${rel}`);
    }
    return asAbsolutePath(resolved);
  }
}
