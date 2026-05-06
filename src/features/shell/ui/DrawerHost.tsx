import { useEffect, useRef } from "react";
import { FocusTrap } from "focus-trap-react";
import { X } from "@phosphor-icons/react";

import { useShellStore } from "@/features/shell/state/shellStore";

import type { DrawerId } from "@/features/shell/state/shellStore";

type DrawerHostProps = {
  onOpenNote?: (id: string) => void;
};

const drawerTitles: Record<DrawerId, string> = {
  search: "Search",
  folders: "Folders",
  recent: "Recent",
  starred: "Starred",
  tags: "Tags",
};

export function DrawerHost({ onOpenNote }: DrawerHostProps) {
  const drawer = useShellStore((state) => state.drawer);
  const closeDrawer = useShellStore((state) => state.closeDrawer);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drawer) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
      }
    };
    const onMouseDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        closeDrawer();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown, true);
    };
  }, [closeDrawer, drawer]);

  if (!drawer) {
    return null;
  }

  return (
    <div className="absolute inset-y-0 left-0 z-20 flex" data-testid="drawer-layer">
      <FocusTrap
        active={drawer !== null}
        focusTrapOptions={{ fallbackFocus: "#noxe-drawer-host", initialFocus: "#noxe-drawer-close" }}
      >
        <div
          id="noxe-drawer-host"
          ref={panelRef}
          role="region"
          aria-label={drawerTitles[drawer]}
          tabIndex={-1}
          className="h-full w-[300px] border-r border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-4 shadow-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{drawerTitles[drawer]}</h2>
            <button
              id="noxe-drawer-close"
              type="button"
              aria-label="Close drawer"
              onClick={closeDrawer}
              className="rounded-md p-1 text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
            >
              <X size={16} />
            </button>
          </div>
          <DrawerBody drawer={drawer} onOpenNote={onOpenNote} />
        </div>
      </FocusTrap>
      <button
        type="button"
        aria-label="Close drawer overlay"
        className="h-full w-screen cursor-default bg-transparent"
        onClick={closeDrawer}
      />
    </div>
  );
}

type DrawerBodyProps = {
  drawer: DrawerId;
  onOpenNote?: (id: string) => void;
};

function DrawerBody({ drawer, onOpenNote }: DrawerBodyProps) {
  return (
    <div className="space-y-3 text-sm text-[var(--color-noxe-muted)]">
      <p>{drawerTitles[drawer]} drawer content will be populated by F07.</p>
      <button
        type="button"
        onClick={() => onOpenNote?.("placeholder")}
        className="rounded-md border border-[var(--color-noxe-border)] px-2 py-1 text-[12px] hover:border-[var(--color-noxe-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
      >
        Placeholder note
      </button>
    </div>
  );
}
