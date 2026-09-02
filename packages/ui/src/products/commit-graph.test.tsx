import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Commit } from "./commit-graph";
import { CommitGraph } from "./commit-graph";

const commits: Commit[] = [
  {
    hash: "abc1234",
    message: "Merge feature branch",
    author: { name: "Ada Lovelace" },
    date: "2026-03-01T12:00:00Z",
    parents: ["def5678", "ghi9012"],
    refs: ["main"],
  },
  {
    hash: "def5678",
    message: "Add login form",
    author: { name: "Grace Hopper" },
    date: "2026-02-28T09:00:00Z",
    parents: ["ghi9012"],
  },
  {
    hash: "ghi9012",
    message: "Initial commit",
    author: { name: "Alan Turing" },
    date: "2026-02-27T08:00:00Z",
    parents: [],
    tag: "v0.1.0",
  },
];

describe("CommitGraph", () => {
  it("renders commits with data-testid", () => {
    render(<CommitGraph commits={commits} />);
    expect(screen.getByTestId("commit-graph")).toBeInTheDocument();
    expect(screen.getByText("Merge feature branch")).toBeInTheDocument();
    expect(screen.getByText("Initial commit")).toBeInTheDocument();
  });
});
