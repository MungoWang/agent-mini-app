import * as React from "react";

import { useLabels } from "../i18n/context";
import { AppIdContext } from "./app-id";

/** Where a captured failure came from — drives the hint the human sees. */
export type AppErrorKind = "render" | "module" | "uncaught" | "async";

export type ReportedAppError = {
  kind: AppErrorKind;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  stack?: string;
  componentStack?: string;
};

/**
 * Hand an error to the host so `mini_app_errors` can see it.
 *
 * The app iframe is same-origin with the host, but the panel embedding it is not — so the
 * only channel that works in both directions is the iframe POSTing to its own host. This
 * is deliberately fire-and-forget: a diagnostic path must never be able to break the app
 * that is reporting through it.
 */
export function reportAppError(appId: string, err: ReportedAppError): void {
  if (!appId) return;
  try {
    const body = JSON.stringify(err);
    const url = `/api/app/${encodeURIComponent(appId)}/errors`;
    // sendBeacon survives the unmount that a crashing app often triggers right after.
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const sent = navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      if (sent) return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never throw from a failure handler */
  }
}

const HINT_KEY: Record<AppErrorKind, "renderHint" | "moduleHint" | "uncaughtHint" | "asyncHint"> = {
  render: "renderHint",
  module: "moduleHint",
  uncaught: "uncaughtHint",
  async: "asyncHint",
};

function ErrorCard(props: {
  appId: string;
  kind: AppErrorKind;
  message: string;
  stack?: string;
  componentStack?: string;
  onRetry: () => void;
}) {
  const t = useLabels("appError");
  const [open, setOpen] = React.useState(false);
  const detail = [props.componentStack, props.stack].filter(Boolean).join("\n");

  return (
    <div
      role="alert"
      style={{
        boxSizing: "border-box",
        margin: "24px",
        padding: "16px 18px",
        borderRadius: 12,
        border: "1px solid var(--destructive,#dc2626)",
        background: "var(--card,#fff)",
        color: "var(--foreground,#111)",
        font: "13px/1.6 var(--font-sans,ui-sans-serif,system-ui,sans-serif)",
        maxWidth: 720,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--destructive,#dc2626)",
            flex: "0 0 auto",
          }}
        />
        <strong style={{ fontSize: 14 }}>{t.title}</strong>
        <code
          style={{
            marginLeft: "auto",
            padding: "1px 6px",
            borderRadius: 6,
            background: "var(--muted,#f3f4f6)",
            color: "var(--muted-foreground,#6b7280)",
            fontSize: 11,
          }}
        >
          {props.appId}
        </code>
      </div>

      <p style={{ margin: "0 0 8px", color: "var(--muted-foreground,#6b7280)" }}>{t[HINT_KEY[props.kind]]}</p>

      <pre
        style={{
          margin: 0,
          padding: "10px 12px",
          borderRadius: 8,
          background: "var(--muted,#f3f4f6)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: "var(--font-mono,ui-monospace,SFMono-Regular,monospace)",
          fontSize: 12,
        }}
      >
        {props.message}
      </pre>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <button
          type="button"
          onClick={props.onRetry}
          style={{
            padding: "5px 12px",
            borderRadius: 8,
            border: "1px solid var(--border,#e5e7eb)",
            background: "var(--primary,#2563eb)",
            color: "var(--primary-foreground,#fff)",
            font: "inherit",
            cursor: "pointer",
          }}
        >
          {t.retry}
        </button>
        {detail ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              padding: "5px 12px",
              borderRadius: 8,
              border: "1px solid var(--border,#e5e7eb)",
              background: "transparent",
              color: "var(--foreground,#111)",
              font: "inherit",
              cursor: "pointer",
            }}
          >
            {open ? t.hideDetails : t.details}
          </button>
        ) : null}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground,#6b7280)" }}>
          {t.reported}
        </span>
      </div>

      {open && detail ? (
        <pre
          style={{
            margin: "10px 0 0",
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--muted,#f3f4f6)",
            color: "var(--muted-foreground,#6b7280)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 260,
            overflow: "auto",
            fontFamily: "var(--font-mono,ui-monospace,SFMono-Regular,monospace)",
            fontSize: 11,
          }}
        >
          {detail}
        </pre>
      ) : null}
    </div>
  );
}

type BoundaryProps = { children: React.ReactNode };
/** Never `null`: React types `state` as `Readonly<S>`, and a nullable S is not a valid JSX element type. */
type BoundaryState = { error?: Error; componentStack?: string };

class AppErrorBoundaryClass extends React.Component<
  BoundaryProps & { appId: string },
  BoundaryState
> {
  /** Required: without an initializer `this.state` is null and the first render throws. */
  state: BoundaryState = {};

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }): void {
    const componentStack = typeof info?.componentStack === "string" ? info.componentStack : undefined;
    this.setState({ componentStack });
    reportAppError(this.props.appId, {
      kind: "render",
      message: error?.message || String(error),
      stack: error?.stack,
      componentStack,
    });
  }

  render(): React.ReactNode {
    const error = this.state.error;
    if (error) {
      return (
        <ErrorCard
          appId={this.props.appId}
          kind="render"
          message={error.message || String(error)}
          stack={error.stack}
          componentStack={this.state.componentStack}
          onRetry={() => this.setState({ error: undefined, componentStack: undefined })}
        />
      );
    }
    return this.props.children;
  }
}

/**
 * Runtime crash guard for a mini-app UI. The host injects this around the app entry when
 * it compiles `ui.tsx`, so authors never have to add it — and an app that throws during
 * render shows a real message instead of a blank iframe.
 *
 * @when Not used from mini-app code: it is already wrapped around your `ui.tsx` by the host.
 * @family Feedback & status
 */
export function AppErrorBoundary(props: { children: React.ReactNode }) {
  const appId = React.useContext(AppIdContext);
  return <AppErrorBoundaryClass appId={appId} key={appId} {...props} />;
}
