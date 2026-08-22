import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Inline,
  Stack,
  Text,
  useDashboardApi,
} from "@monkeyagent/ui";

export default function Ui() {
  const { call } = useDashboardApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setData(await call("ping", {}));
    } catch (e) {
      setError(String((e && e.message) || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <Stack style={{ padding: 24, maxWidth: 520, margin: "0 auto", gap: 16 }}>
      <div>
        <Text variant="h2">Hello</Text>
        <Text variant="muted" style={{ marginTop: 4 }}>
          Smoke test · main.api.ping via Host RPC
        </Text>
      </div>

      <Card>
        <CardHeader>
          <Inline style={{ justifyContent: "space-between" }}>
            <CardTitle>API status</CardTitle>
            <Badge variant={error ? "destructive" : loading ? "secondary" : "default"}>
              {error ? "error" : loading ? "loading" : "ok"}
            </Badge>
          </Inline>
          <CardDescription>Round-trip through POST /api/call → main.api.ts</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Text variant="muted">{error}</Text>
          ) : loading && !data ? (
            <Text variant="muted">Calling ping…</Text>
          ) : data ? (
            <Stack gap={8}>
              <Inline style={{ justifyContent: "space-between" }}>
                <Text variant="muted">now</Text>
                <Text style={{ fontFamily: "ui-monospace, monospace" }}>{String(data.now)}</Text>
              </Inline>
              <Inline style={{ justifyContent: "space-between" }}>
                <Text variant="muted">theme</Text>
                <Badge variant="outline">{String(data.theme)}</Badge>
              </Inline>
            </Stack>
          ) : (
            <Text variant="muted">No data</Text>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={() => void reload()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </CardFooter>
      </Card>
    </Stack>
  );
}
