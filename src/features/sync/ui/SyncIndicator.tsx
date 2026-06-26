import { CloudArrowUp, CloudCheck, CloudSlash, Warning } from "@phosphor-icons/react";
import { useEffect } from "react";

import { useSettingsUiStore } from "@/features/settings/state/settingsUiStore";
import { startSyncPolling, useSyncStore } from "@/features/sync/state/syncStore";

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
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function SyncIndicator() {
  const remote = useSyncStore((s) => s.status?.remote ?? null);
  const openSettings = useSettingsUiStore((s) => s.openSettings);

  useEffect(() => {
    startSyncPolling();
  }, []);

  if (!remote || !remote.enabled) return null;

  let Icon = CloudCheck;
  let className = "text-[var(--color-cork-muted)] hover:text-[var(--color-cork-ink)]";
  let label = `Synced • last push ${relTime(remote.lastPush)}`;
  let weight: "regular" | "fill" = "regular";

  if (remote.syncStatus === "syncing") {
    Icon = CloudArrowUp;
    className = "text-[var(--color-cork-primary)] animate-pulse";
    label = "Syncing…";
  } else if (remote.syncStatus === "error") {
    Icon = Warning;
    className = "text-red-500";
    label = remote.lastError ? `Sync error: ${remote.lastError}` : "Sync error";
    weight = "fill";
  } else if (!remote.url) {
    Icon = CloudSlash;
    label = "Sync enabled but no remote configured";
  }

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => openSettings("sync")}
      className={`rounded-full p-1.5 focus-visible:ring-2 focus-visible:ring-[var(--color-cork-ring)] focus-visible:outline-none ${className}`}
    >
      <Icon size={16} weight={weight} />
    </button>
  );
}
