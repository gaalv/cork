import { useEffect, useState } from "react";

import { useShellStore } from "@/features/shell/state/shellStore";
import { useSyncStore } from "@/features/sync/state/syncStore";

function relTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const diff = Math.max(0, Date.now() - then);
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function GitHubSyncSection() {
  const status = useSyncStore((s) => s.status);
  const refresh = useSyncStore((s) => s.refresh);
  const enable = useSyncStore((s) => s.enable);
  const disable = useSyncStore((s) => s.disable);
  const syncNow = useSyncStore((s) => s.syncNow);
  const loading = useSyncStore((s) => s.loading);
  const pushToast = useShellStore((s) => s.pushToast);

  const [showEnableForm, setShowEnableForm] = useState(false);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remote = status?.remote ?? null;
  const hasGh = status?.hasGh ?? false;
  const ghAccount = status?.ghAccount ?? null;
  const enabled = remote?.enabled ?? false;

  const onEnable = async (withUrl: boolean) => {
    try {
      await enable(withUrl ? { url: url.trim(), token: token.trim() || undefined } : undefined);
      setShowEnableForm(false);
      setUrl("");
      setToken("");
      pushToast({ title: "GitHub sync enabled" });
    } catch (err) {
      pushToast({
        title: "Could not enable sync",
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onDisable = async () => {
    if (!window.confirm("Disable GitHub sync? Your local notes are kept; the remote is unlinked."))
      return;
    try {
      await disable();
      pushToast({ title: "GitHub sync disabled" });
    } catch (err) {
      pushToast({
        title: "Could not disable sync",
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onSyncNow = async () => {
    try {
      await syncNow();
    } catch (err) {
      pushToast({
        title: "Sync failed",
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <div className="rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-[var(--color-noxe-ink)]">GitHub sync</div>
          <div className="text-xs text-[var(--color-noxe-muted)]">
            Sync your vault between devices via a private GitHub repo. Uses the <code>gh</code> CLI.
          </div>
        </div>
      </div>

      {!hasGh && (
        <div className="mb-2 rounded border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300">
          The <code>gh</code> CLI was not found on PATH. Install it from{" "}
          <a className="underline" href="https://cli.github.com" target="_blank" rel="noreferrer">
            cli.github.com
          </a>{" "}
          and run <code>gh auth login</code>.
        </div>
      )}

      {hasGh && ghAccount && !enabled && (
        <div className="mb-2 rounded border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2 text-xs text-[var(--color-noxe-muted)]">
          <div>
            <span className="text-[var(--color-noxe-ink)]">gh</span> is currently logged in as{" "}
            <span className="font-mono text-[var(--color-noxe-ink)]">
              {ghAccount.user}@{ghAccount.host}
            </span>
            . "Create new private repo" will use this account.
          </div>
          <div className="mt-1">
            To push to a different account (e.g. personal vs. work), create the repo on github.com
            from that account, then use <strong>"Use existing URL…"</strong> below and paste a
            personal access token. The token authenticates the push directly and bypasses the active{" "}
            <code>gh</code> login.
          </div>
        </div>
      )}

      {!enabled && !showEnableForm && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!hasGh || loading}
            onClick={() => void onEnable(false)}
            className="rounded-lg bg-[var(--color-noxe-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-noxe-primary-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create new private repo
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => setShowEnableForm(true)}
            className="rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-1.5 text-xs font-medium text-[var(--color-noxe-ink)] hover:border-[var(--color-noxe-border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use existing URL…
          </button>
        </div>
      )}

      {!enabled && showEnableForm && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="https://github.com/user/repo.git"
            value={url}
            onChange={(e) => setUrl(e.currentTarget.value)}
            className="w-full rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2 text-sm text-[var(--color-noxe-ink)]"
          />
          <input
            type="password"
            autoComplete="off"
            placeholder="Personal access token (optional — needed for a different account)"
            title="Fine-grained PAT scoped to this repo with Contents: Read and write"
            value={token}
            onChange={(e) => setToken(e.currentTarget.value)}
            className="w-full rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2 text-sm text-[var(--color-noxe-ink)]"
          />
          <details className="rounded border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2 text-[11px] leading-relaxed text-[var(--color-noxe-muted)]">
            <summary className="cursor-pointer text-[var(--color-noxe-ink)]">
              How to create the repo &amp; token
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>
                On github.com (target account), create a new <strong>private</strong> repo. Leave it
                empty — no README, no .gitignore, no license.
              </li>
              <li>
                Generate a{" "}
                <a
                  className="underline"
                  href="https://github.com/settings/personal-access-tokens/new"
                  target="_blank"
                  rel="noreferrer"
                >
                  fine-grained personal access token
                </a>{" "}
                with:
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  <li>
                    <strong>Resource owner:</strong> the account that owns the repo
                  </li>
                  <li>
                    <strong>Repository access:</strong> Only select repositories → pick this repo
                  </li>
                  <li>
                    <strong>Repository permissions:</strong> <code>Contents</code> →{" "}
                    <code>Read and write</code> (also auto-enables <code>Metadata: Read-only</code>)
                  </li>
                </ul>
              </li>
              <li>Paste the repo URL and the token above, then Connect.</li>
            </ol>
            <p className="mt-2">
              The token is stored only in this machine&apos;s <code>.git/config</code> and never
              committed.
            </p>
          </details>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!url.trim() || loading}
              onClick={() => void onEnable(true)}
              className="rounded-lg bg-[var(--color-noxe-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-noxe-primary-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Connect
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEnableForm(false);
                setUrl("");
                setToken("");
              }}
              className="rounded-lg border border-[var(--color-noxe-border)] px-3 py-1.5 text-xs text-[var(--color-noxe-muted)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {enabled && remote && (
        <div className="space-y-2 text-xs">
          <Row label="Remote" value={remote.url ?? "—"} mono />
          <Row label="Status" value={remote.syncStatus} />
          <Row label="Last push" value={relTime(remote.lastPush)} />
          <Row label="Last pull" value={relTime(remote.lastPull)} />
          {remote.lastError && (
            <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-700 dark:text-red-300">
              {remote.lastError}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={loading}
              onClick={() => void onSyncNow()}
              className="rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-1.5 font-medium text-[var(--color-noxe-ink)] hover:border-[var(--color-noxe-border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sync now
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void onDisable()}
              className="rounded-lg border border-[var(--color-noxe-border)] px-3 py-1.5 text-[var(--color-noxe-muted)] hover:text-red-500"
            >
              Disable sync
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[var(--color-noxe-muted)]">{label}</span>
      <span
        className={`truncate text-[var(--color-noxe-ink)] ${mono ? "font-mono text-[11px]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
