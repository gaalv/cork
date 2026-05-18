import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

import { client } from "@/shared/ipc/client";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  error: Error | null;
};

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void reportFrontendError({
      source: "react-error-boundary",
      message: error.message || String(error),
      stack: error.stack ?? info.componentStack ?? undefined,
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          role="alert"
          style={{
            padding: "2rem",
            margin: "2rem auto",
            maxWidth: 560,
            borderRadius: 12,
            border: "1px solid var(--color-noxe-border, #e4e4e7)",
            background: "var(--color-noxe-panel, #fff)",
            color: "var(--color-noxe-ink, #0F172A)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: 18, marginTop: 0 }}>Something went wrong.</h1>
          <p style={{ color: "var(--color-noxe-muted, #6b7280)", fontSize: 14 }}>
            Noxe caught an unexpected error and saved it locally. Your notes are safe.
          </p>
          <pre
            style={{
              fontSize: 12,
              padding: "0.75rem",
              borderRadius: 6,
              background: "var(--color-noxe-panel-2, #f4f4f5)",
              overflow: "auto",
              maxHeight: 200,
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={this.reset}
            style={{
              marginTop: "0.75rem",
              padding: "0.5rem 1rem",
              borderRadius: 8,
              border: "1px solid var(--color-noxe-border, #e4e4e7)",
              background: "var(--color-noxe-accent, #3F3DFF)",
              color: "white",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export async function reportFrontendError(input: {
  source: string;
  message: string;
  stack?: string;
  route?: string;
}): Promise<void> {
  try {
    await client.diagnostics.reportError({
      ...input,
      version: __APP_VERSION__,
    });
  } catch {
    // Diagnostics is best-effort — never throw.
  }
}

/**
 * Install global error listeners that forward uncaught errors and unhandled
 * promise rejections to the Rust crash log. Idempotent.
 */
export function installGlobalErrorReporters(): void {
  if (typeof window === "undefined") return;
  if ((window as { __noxeErrorReportersInstalled?: boolean }).__noxeErrorReportersInstalled) {
    return;
  }
  (window as { __noxeErrorReportersInstalled?: boolean }).__noxeErrorReportersInstalled = true;

  window.addEventListener("error", (event) => {
    void reportFrontendError({
      source: "window-error",
      message: event.message || "Uncaught error",
      stack: event.error instanceof Error ? event.error.stack : undefined,
      route: window.location.pathname,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    void reportFrontendError({
      source: "unhandled-rejection",
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      route: window.location.pathname,
    });
  });
}
