import {
  CircleNotch,
  CloudArrowUp,
  CloudCheck,
  CloudSlash,
  GearSix,
  Warning,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { useShellStore } from "@/stores/shellStore";
import { useIndexStore } from "@/stores/indexStore";
import { useSettingsUiStore } from "@/stores/settingsUiStore";
import { startSyncPolling, useSyncStore } from "@/stores/syncStore";
import { VimIndicator } from "./VimIndicator";
import { VaultIndicator } from "@/components/sidebar/VaultIndicator";
import { NotificationsPopover } from "./NotificationsPopover";

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

/** Minimum time (ms) to keep showing the "syncing" state so it's visible. */
const MIN_SYNCING_DISPLAY_MS = 2000;

function SyncStatusIcon() {
  const remote = useSyncStore((s) => s.status?.remote ?? null);
  const openSettings = useSettingsUiStore((s) => s.openSettings);

  // Hold the syncing visual for at least MIN_SYNCING_DISPLAY_MS so users
  // can actually see the icon change even when sync finishes instantly.
  const [showSyncing, setShowSyncing] = useState(false);
  const syncingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const realStatus = remote?.syncStatus ?? null;

  useEffect(() => {
    if (realStatus === "syncing") {
      setShowSyncing(true);
      if (syncingTimer.current) clearTimeout(syncingTimer.current);
      syncingTimer.current = null;
    } else if (showSyncing) {
      // Real status left "syncing" — keep the visual for the remaining time
      if (!syncingTimer.current) {
        syncingTimer.current = setTimeout(() => {
          setShowSyncing(false);
          syncingTimer.current = null;
        }, MIN_SYNCING_DISPLAY_MS);
      }
    }
  }, [realStatus, showSyncing]);

  useEffect(() => {
    startSyncPolling();
    return () => {
      if (syncingTimer.current) clearTimeout(syncingTimer.current);
    };
  }, []);

  // Sync not configured — show muted cloud-slash
  if (!remote || !remote.enabled) {
    return (
      <button
        onClick={() => openSettings("sync")}
        className="rounded p-1 hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
        title="Sync not configured"
      >
        <CloudSlash size={14} className="text-[var(--color-cork-subtle)]" />
      </button>
    );
  }

  const displayStatus = showSyncing ? "syncing" : realStatus;

  let Icon = CloudCheck;
  let iconClass = "text-green-500";
  let label = `Synced — last push ${relTime(remote.lastPush)}`;

  if (displayStatus === "syncing") {
    Icon = CloudArrowUp;
    iconClass = "text-[var(--color-cork-primary)] animate-pulse";
    label = "Syncing...";
  } else if (displayStatus === "error") {
    Icon = Warning;
    iconClass = "text-red-500";
    label = remote.lastError ? `Sync error: ${remote.lastError}` : "Sync error";
  } else if (!remote.url) {
    Icon = CloudSlash;
    iconClass = "text-[var(--color-cork-subtle)]";
    label = "Sync enabled but no remote configured";
  }

  return (
    <button
      onClick={() => openSettings("sync")}
      className="rounded p-1 hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
      title={label}
    >
      <Icon
        size={14}
        weight={displayStatus === "error" ? "fill" : "regular"}
        className={iconClass}
      />
    </button>
  );
}

export function StatusBar() {
  const setSettingsOpen = useShellStore((s) => s.setSettingsOpen);
  const isIndexing = useIndexStore((s) => s.isIndexing);
  const indexProgress = useIndexStore((s) => s.indexProgress);
  return (
    <footer className="flex h-8 shrink-0 items-center justify-between rounded-b-[10px] border-t border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] px-3 text-[11px] text-[var(--color-cork-muted)]">
      <div className="flex items-center gap-2">
        <VaultIndicator />
        {isIndexing && indexProgress && (
          <span className="flex items-center gap-1 text-[var(--color-cork-subtle)]">
            <CircleNotch size={12} className="animate-spin" />
            Indexing {indexProgress.processed}/{indexProgress.total}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <VimIndicator />
        <div className="mx-0.5 h-3 w-px bg-[var(--color-cork-border)]" />
        <SyncStatusIcon />
        <NotificationsPopover />
        <button
          onClick={() => setSettingsOpen(true)}
          className="rounded p-1 hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
          title="Settings"
        >
          <GearSix size={14} />
        </button>
      </div>
    </footer>
  );
}
