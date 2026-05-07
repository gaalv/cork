import { CalendarBlank, ClockCounterClockwise, FolderSimple, GearSix, Hash, House, MagnifyingGlass, Star } from "@phosphor-icons/react";

import { useSettingsUiStore } from "@/features/settings/state/settingsUiStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import type { ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

import type { DrawerId } from "@/features/shell/state/shellStore";

type RailProps = {
  className?: string;
};

const drawerButtons: Array<{ id: DrawerId; label: string; icon: ReactNode }> = [
  { id: "search", label: "Search", icon: <MagnifyingGlass size={18} /> },
  { id: "folders", label: "Folders", icon: <FolderSimple size={18} /> },
  { id: "recent", label: "Recent", icon: <ClockCounterClockwise size={18} /> },
  { id: "starred", label: "Starred", icon: <Star size={18} /> },
  { id: "tags", label: "Tags", icon: <Hash size={18} /> },
];

export function Rail({ className }: RailProps) {
  const view = useShellStore((state) => state.view);
  const drawer = useShellStore((state) => state.drawer);
  const toggleDrawer = useShellStore((state) => state.toggleDrawer);
  const navigate = useShellStore((state) => state.navigate);
  const openSettings = useSettingsUiStore((state) => state.openSettings);

  return (
    <aside
      data-testid="rail"
      className={cn(
        "z-10 flex h-full flex-col items-center justify-between border-r border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] py-4",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <RailButton
          icon={<House size={18} />}
          label="Home"
          active={view.kind === "home" && drawer === null}
          onClick={() => navigate({ kind: "home" })}
        />
        <RailButton
          icon={<CalendarBlank size={18} />}
          label="Calendar"
          active={view.kind === "calendar" && drawer === null}
          onClick={() => navigate({ kind: "calendar" })}
        />
        {drawerButtons.map((button) => (
          <RailButton
            key={button.id}
            icon={button.icon}
            label={button.label}
            active={drawer === button.id}
            onClick={() => toggleDrawer(button.id)}
          />
        ))}
      </div>
      <div className="flex flex-col items-center gap-2">
        <RailButton icon={<GearSix size={18} />} label="Settings" active={false} onClick={() => openSettings()} />
      </div>
    </aside>
  );
}

type RailButtonProps = {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
};

function RailButton({ icon, label, active, onClick }: RailButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-9 items-center justify-center rounded-xl text-[var(--color-noxe-muted)] transition hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none",
        active && "bg-[var(--color-noxe-panel-2)] text-[var(--color-noxe-ink)] shadow-sm",
      )}
    >
      {icon}
    </button>
  );
}
