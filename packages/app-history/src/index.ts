import type { HistoryPort } from "@monkey-mini-app/host-port";

export type { HistoryPort, CommitTree, CommitNode } from "@monkey-mini-app/host-port";

export function createHistory(adapter: HistoryPort): HistoryPort {
  return adapter;
}
