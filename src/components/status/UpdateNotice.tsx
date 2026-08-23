/**
 * Update notice.
 *
 * Cork installs through package managers, so the useful thing to show is not a
 * download button but the exact command for the channel this copy came from.
 * Dismissing hides the notice for that version only — the next release asks
 * again.
 */

import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Copy, X } from "@phosphor-icons/react";

import { checkForUpdate, type UpdateInfo } from "@/services/updateCheck";
import { recordActivity } from "@/stores/activityStore";
import { cn } from "@/utils/cn";

const DISMISSED_KEY = "cork-update-dismissed";

function dismissedVersion(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

export function UpdateNotice() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Deliberately not awaited on mount — a slow or blocked network must never
    // hold up the shell.
    void checkForUpdate().then((update) => {
      if (cancelled || !update) return;
      // Logged even when the banner is dismissed, so the update stays findable.
      recordActivity(
        "update",
        `Cork ${update.latest} is available`,
        update.command ? `Run: ${update.command}` : "Download from the releases page",
      );
      if (dismissedVersion() === update.latest) return;
      setInfo(update);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, info.latest);
    } catch {
      // best-effort
    }
    setInfo(null);
  };

  const copy = () => {
    if (!info.command) return;
    void navigator.clipboard.writeText(info.command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="mx-2 mb-2 rounded-lg border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[12px] font-medium text-[var(--color-cork-ink)]">
          Cork {info.latest} available
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss update notice"
          className="-mt-0.5 rounded p-0.5 text-[var(--color-cork-subtle)] hover:text-[var(--color-cork-ink)]"
        >
          <X size={12} weight="bold" />
        </button>
      </div>

      {info.command ? (
        <button
          onClick={copy}
          title="Copy command"
          className={cn(
            "mt-1.5 flex w-full items-center justify-between gap-2 rounded-md",
            "border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] px-2 py-1",
            "text-left font-mono text-[11px] text-[var(--color-cork-muted)]",
            "hover:border-[var(--color-cork-border-strong)]",
          )}
        >
          <span className="truncate">{info.command}</span>
          {copied ? (
            <Check size={12} weight="bold" className="shrink-0 text-[var(--color-cork-success)]" />
          ) : (
            <Copy size={12} className="shrink-0" />
          )}
        </button>
      ) : (
        <a
          href={info.releasesUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 flex items-center gap-1 text-[11px] text-[var(--color-cork-muted)] hover:text-[var(--color-cork-ink)]"
        >
          Download from releases
          <ArrowUpRight size={11} />
        </a>
      )}
    </div>
  );
}
