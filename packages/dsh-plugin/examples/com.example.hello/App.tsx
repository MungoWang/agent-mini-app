import { useEffect, useState } from "react";
import { ping } from "./main.api";

export default function App() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { void ping().then((r) => setNow(r.now)); }, []);
  return (
    <div style={{ padding: "var(--space-4)", color: "var(--color-foreground)", background: "var(--color-background)", fontFamily: "var(--font-sans)", minHeight: "100%" }}>
      <h1 style={{ color: "var(--color-primary)", marginTop: 0 }}>Hello mini-app</h1>
      <p style={{ color: "var(--color-muted-foreground)" }}>
        Frontend <code>App.tsx</code> + backend <code>main.api.ts</code> via host invoke.
      </p>
      <p>host time.now: {now ?? "…"}</p>
    </div>
  );
}
