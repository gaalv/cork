import { toast } from "sonner";
import { Bell, CheckCircle, GearSix, Megaphone } from "@phosphor-icons/react";

import { useShellStore } from "@/features/shell/state/shellStore";
import { VimIndicator } from "./VimIndicator";
import { VaultIndicator } from "./VaultIndicator";

export function StatusBar() {
  const setSettingsOpen = useShellStore((s) => s.setSettingsOpen);

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] px-3 text-[11px] text-[var(--color-cork-muted)]">
      <div className="flex items-center gap-2">
        <VaultIndicator />
      </div>
      <div className="flex items-center gap-1.5">
        <VimIndicator />
        <div className="mx-0.5 h-3 w-px bg-[var(--color-cork-border)]" />
        <button
          className="rounded p-1 hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
          title="Synced"
        >
          <CheckCircle size={14} weight="fill" className="text-green-500" />
        </button>
        <button
          onClick={() => toast.info("Feedback coming soon!")}
          className="rounded p-1 hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
          title="Feedback"
        >
          <Megaphone size={14} />
        </button>
        <button
          onClick={() => toast.info("Notifications coming soon!")}
          className="rounded p-1 hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
          title="Notifications"
        >
          <Bell size={14} />
        </button>
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
