import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";

import { useAppSettingsStore } from "@/features/shell/state/appSettingsStore";
import { useShellStore } from "@/features/shell/state/shellStore";

const shortcutGroups = [
  { title: "Navigation", shortcuts: [["⌘K", "Open command palette"], ["⌘[", "Back"], ["⌘]", "Forward"], ["⌘⇧G", "Open Graph view"]] },
  { title: "Vault", shortcuts: [["⌘O", "Open vault"], ["⌘N", "New note"]] },
  { title: "Shell", shortcuts: [["⌘\\", "Toggle last drawer"], ["?", "Show shortcuts"]] },
];

export function HelpModal() {
  const open = useShellStore((state) => state.helpOpen);
  const closeHelp = useShellStore((state) => state.closeHelp);
  const autoRewrite = useAppSettingsStore((state) => state.autoRewriteLinksOnRename);
  const setAutoRewrite = useAppSettingsStore((state) => state.setAutoRewriteLinksOnRename);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeHelp();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeHelp, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4" role="presentation" onMouseDown={closeHelp}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="w-[min(520px,100%)] rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close shortcuts"
            onClick={closeHelp}
            className="rounded-md p-1 text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2 text-sm">
            <span>
              <span className="block font-medium">Rewrite wikilinks on rename</span>
              <span className="text-[12px] text-[var(--color-noxe-muted)]">Keep [[Old]] links pointing at renamed notes.</span>
            </span>
            <input
              type="checkbox"
              checked={autoRewrite}
              onChange={(event) => setAutoRewrite(event.currentTarget.checked)}
              aria-label="Rewrite wikilinks on rename"
            />
          </label>
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-noxe-muted)]">{group.title}</h3>
              <dl className="space-y-2">
                {group.shortcuts.map(([keys, label]) => (
                  <div key={keys} className="flex items-center justify-between gap-4 text-sm">
                    <dt>{label}</dt>
                    <dd className="rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-2 py-1 text-[12px] font-medium">{keys}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
