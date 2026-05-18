import { useEffect, useState } from "react";
import { openPath } from "@tauri-apps/plugin-opener";

import { useShellStore } from "@/features/shell/state/shellStore";
import { client } from "@/shared/ipc/client";
import type { CrashEvent } from "@/shared/ipc/IpcContract";

import { SettingRow } from "./SettingRow";

export function DiagnosticsSection() {
  const pushToast = useShellStore((state) => state.pushToast);
  const [crashLogPath, setCrashLogPath] = useState<string | null>(null);
  const [recent, setRecent] = useState<CrashEvent[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const path = await client.diagnostics.crashLogPath();
        if (active) setCrashLogPath(path);
      } catch {
        // No-op — web preview doesn't have this command.
      }
      try {
        const events = await client.diagnostics.recent(20);
        if (active) setRecent(events);
      } catch {
        // No-op.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const openCrashLog = async () => {
    if (!crashLogPath) {
      pushToast({
        title: "Crash log not available",
        description: "Run Noxe natively to access the log file.",
      });
      return;
    }
    try {
      await openPath(crashLogPath);
    } catch (err) {
      pushToast({
        title: "Could not open crash log",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const refreshRecent = async () => {
    try {
      const events = await client.diagnostics.recent(20);
      setRecent(events);
    } catch (err) {
      pushToast({
        title: "Could not load crash log",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <div className="space-y-3">
      <SettingRow
        label="Local crash log"
        description={
          crashLogPath
            ? `Crashes and uncaught errors are appended locally. Nothing leaves your machine.`
            : "Run Noxe natively to access the crash log."
        }
        scope="app"
        control={
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2 text-sm font-medium text-[var(--color-noxe-ink)] hover:border-[var(--color-noxe-border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void openCrashLog()}
              disabled={!crashLogPath}
            >
              Open crash log
            </button>
            {crashLogPath ? (
              <code className="block truncate text-[11px] text-[var(--color-noxe-muted)]">
                {crashLogPath}
              </code>
            ) : null}
          </div>
        }
      />
      <SettingRow
        label="Recent events"
        description={
          recent.length === 0
            ? "No crash events recorded yet."
            : `${recent.length} recent event${recent.length === 1 ? "" : "s"} captured. Vault paths and tokens are redacted automatically.`
        }
        scope="app"
        control={
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2 text-sm font-medium text-[var(--color-noxe-ink)] hover:border-[var(--color-noxe-border-strong)]"
              onClick={() => void refreshRecent()}
            >
              Refresh
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2 text-sm font-medium text-[var(--color-noxe-ink)] hover:border-[var(--color-noxe-border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={recent.length === 0}
              onClick={() => setShowPreview(true)}
            >
              Preview
            </button>
          </div>
        }
      />
      <SettingRow
        label="Send crash reports"
        description="Crash reports stay on your machine. Remote reporting is not yet configured for this build — see ROADMAP."
        scope="app"
        control={
          <span className="rounded-md bg-[var(--color-noxe-panel-2)] px-2 py-1 text-xs font-medium text-[var(--color-noxe-muted)]">
            Off (local only)
          </span>
        }
      />
      {showPreview ? <PreviewModal events={recent} onClose={() => setShowPreview(false)} /> : null}
    </div>
  );
}

function PreviewModal({ events, onClose }: { events: CrashEvent[]; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crash report payload preview"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={onClose}
    >
      <section
        className="grid max-h-[80vh] w-[min(720px,100%)] grid-rows-[auto_1fr_auto] overflow-hidden rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="border-b border-[var(--color-noxe-border)] px-4 py-3">
          <h3 className="text-sm font-semibold text-[var(--color-noxe-ink)]">
            Crash report payload preview
          </h3>
          <p className="mt-1 text-xs text-[var(--color-noxe-muted)]">
            This is the exact JSON Noxe stores locally. If remote reporting becomes available, it
            will send the same redacted payload — never note bodies, never plaintext vault paths.
          </p>
        </header>
        <pre className="overflow-auto p-4 text-[11px] leading-relaxed text-[var(--color-noxe-ink)]">
          {JSON.stringify(events, null, 2)}
        </pre>
        <footer className="flex justify-end gap-2 border-t border-[var(--color-noxe-border)] px-4 py-3">
          <button
            type="button"
            className="rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2 text-sm font-medium text-[var(--color-noxe-ink)] hover:border-[var(--color-noxe-border-strong)]"
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
