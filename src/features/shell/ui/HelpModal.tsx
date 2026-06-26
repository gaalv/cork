/**
 * HelpModal — keyboard shortcuts reference.
 *
 * @see F13 — Settings spec (ShortcutsList)
 */

import { X } from "@phosphor-icons/react";

import { useShellStore } from "@/features/shell/state/shellStore";

const SHORTCUT_GROUPS = [
  {
    title: "General",
    shortcuts: [
      { keys: "⌘ K", label: "Command palette" },
      { keys: "⌘ ,", label: "Settings" },
      { keys: "⌘ N", label: "New note" },
      { keys: "⌘ O", label: "Open vault" },
      { keys: "⌘ ⇧ L", label: "Toggle theme" },
    ],
  },
  {
    title: "Editor",
    shortcuts: [
      { keys: "⌘ S", label: "Save note" },
      { keys: "⌘ .", label: "Toggle inspector" },
      { keys: "⌘ F", label: "Find in note" },
      { keys: "⌘ ⇧ F", label: "Find & replace" },
      { keys: "⌘ D", label: "Open daily note" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: "Esc", label: "Close overlay" },
      { keys: "⌘ [", label: "Go back" },
      { keys: "⌘ ]", label: "Go forward" },
    ],
  },
];

export function HelpModal() {
  const open = useShellStore((s) => s.helpOpen);
  const close = useShellStore((s) => s.setHelpOpen);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--color-cork-ink)]/30"
      onClick={() => close(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[480px] overflow-hidden rounded-2xl border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-cork-border)] px-5 py-3">
          <h2 className="text-[14px] font-semibold">Keyboard Shortcuts</h2>
          <button
            onClick={() => close(false)}
            className="rounded p-1 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)]"
          >
            <X size={14} />
          </button>
        </div>
        <div className="max-h-[400px] overflow-y-auto px-5 py-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="mb-5 last:mb-0">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-cork-muted)]">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.shortcuts.map((s) => (
                  <div key={s.keys} className="flex items-center justify-between py-1">
                    <span className="text-[13px]">{s.label}</span>
                    <kbd className="rounded border border-[var(--color-cork-border)] bg-[var(--color-cork-kbd)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-cork-muted)]">
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
