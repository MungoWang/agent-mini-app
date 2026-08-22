import React from "react";

export default function App() {
  return (
    <div
      style={{
        padding: "var(--space-4)",
        color: "var(--color-foreground)",
        background: "var(--color-background)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
      }}
    >
      <h1 style={{ color: "var(--color-primary)" }}>Hello mini-app</h1>
    </div>
  );
}
