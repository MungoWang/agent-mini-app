import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EnvTable } from "./env-table";

describe("EnvTable", () => {
  it("renders reveal and copy controls", () => {
    render(
      <EnvTable
        title="Secrets"
        variables={[
          {
            key: "API_URL",
            value: "https://example.com",
            environment: "production",
          },
        ]}
      />
    );

    expect(screen.getByTestId("env-table")).toBeInTheDocument();
    expect(screen.getByLabelText("Reveal API_URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Copy API_URL value")).toBeInTheDocument();
    expect(screen.getByLabelText("Reveal all values")).toBeInTheDocument();
    expect(screen.getByLabelText("Copy .env")).toBeInTheDocument();
  });
});
