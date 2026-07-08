import { useEffect, useState } from "react";
import { Key } from "@phosphor-icons/react";
import { toast } from "sonner";

import { useSyncStore } from "@/stores/syncStore";

/**
 * F41/SYNC-03 — replace the stored GitHub token without re-setup.
 * One password field + confirm; rewrites only the credential file and
 * triggers an immediate sync to validate. Remote, URL, and history are
 * untouched. Auto-opens when the current sync error looks auth-related.
 */
export function UpdateTokenRow({ autoOpen }: { autoOpen: boolean }) {
  const updateToken = useSyncStore((s) => s.updateToken);
  const loading = useSyncStore((s) => s.loading);

  const [open, setOpen] = useState(autoOpen);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  const onConfirm = async () => {
    const trimmed = token.trim();
    if (!trimmed) return;
    try {
      const remote = await updateToken(trimmed);
      setToken("");
      if (remote.lastError) {
        toast.error("Token saved, but sync is still failing", {
          description: remote.lastError,
          duration: 12000,
        });
      } else {
        toast.success("Token updated — sync resumed");
        setOpen(false);
      }
    } catch (err) {
      toast.error("Could not update token", {
        description: err instanceof Error ? err.message : String(err),
        duration: 8000,
      });
    }
  };

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-3 py-2 text-[11px] leading-relaxed text-[var(--color-cork-muted)]"
    >
      <summary className="cursor-pointer text-[var(--color-cork-ink)]">
        <Key className="mr-1 inline-block align-[-2px]" size={12} />
        Update token
      </summary>
      <p className="mt-2">
        Paste a fresh fine-grained PAT (Contents: Read and write for this repo). Only the stored
        credential is replaced — remote, URL, and history stay untouched.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          type="password"
          autoComplete="off"
          placeholder="New personal access token"
          value={token}
          onChange={(e) => setToken(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onConfirm();
          }}
          className="w-full rounded-lg border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] px-3 py-1.5 text-xs text-[var(--color-cork-ink)]"
        />
        <button
          type="button"
          disabled={!token.trim() || loading}
          onClick={() => void onConfirm()}
          className="shrink-0 rounded-lg bg-[var(--color-cork-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-cork-primary-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Update
        </button>
      </div>
    </details>
  );
}
