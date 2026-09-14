import type { SkillPort } from "@monkey-mini-app/host";

import { defaultSkillDest, installSkillDir } from "./lifecycle.ts";

export class DshSkillPort implements SkillPort {
  constructor(private readonly dest: string = defaultSkillDest()) {}

  install(sourceDir: string): void {
    installSkillDir(sourceDir, this.dest);
  }
}
