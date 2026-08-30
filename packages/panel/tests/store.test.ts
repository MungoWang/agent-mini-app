import { afterEach, describe, expect, it } from "vitest";

import { getPanelState, resetPanelState, setPanelState, subscribePanel } from "@monkey-mini-app/panel";

afterEach(() => {
  resetPanelState();
});

describe("panel store", () => {
  it("starts with the all tab and empty apps", () => {
    const s = resetPanelState();
    expect(s.tabs).toEqual([{ id: "all", title: "全部", kind: "all" }]);
    expect(s.active).toBe("all");
    expect(s.apps).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.capabilities.history).toBe(false);
    expect(s.locale).toBe("zh-CN");
  });

  it("patches state and notifies subscribers", () => {
    const seen: number[] = [];
    const unsub = subscribePanel(() => {
      seen.push(getPanelState().apps.length);
    });
    setPanelState({ apps: [{ id: "com.example.todo", name: "Todo" }] });
    expect(getPanelState().apps[0]?.name).toBe("Todo");
    expect(seen).toEqual([1]);
    unsub();
    setPanelState({ apps: [] });
    expect(seen).toEqual([1]);
  });

  it("resetPanelState restores defaults and applies a seed", () => {
    setPanelState({ query: "x", loading: true, dock: "side" });
    const s = resetPanelState({ query: "seed", locale: "en" });
    expect(s.query).toBe("seed");
    expect(s.loading).toBe(false);
    expect(s.dock).toBe("fill");
    expect(s.locale).toBe("en");
  });
});
