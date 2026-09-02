# @monkey-mini-app/api

Backend authoring contract for mini-apps (`main.api.ts`).

```ts
import { defineApp } from "@monkey-mini-app/api";

export default defineApp({
  name: "…",
  description: "…",
  api: {
    async list(ctx) {
      return (await ctx.storage.get("items")) ?? [];
    },
  },
});
```

**Runtime:** the host injects `defineApp` when loading `main.api.ts` — this package is for **types / IDE / `pnpm check:templates`**. Do not expect Node to load React from here; there is none.

UI authors use `@monkey-mini-app/ui` (`useApp` + components), not this package.
