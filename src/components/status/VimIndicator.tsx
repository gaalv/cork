/**
 * Vim mode indicator — shows current mode (NORMAL/INSERT/VISUAL/REPLACE)
 * in the status bar with a cheat sheet popover for new users.
 */

import { useState, useRef, useEffect } from "react";
import { Question } from "@phosphor-icons/react";

import { useVimModeStore } from "@/stores/vimModeStore";
import { useAppSettingsStore } from "@/stores/appSettingsStore";

const MODE_COLORS: Record<string, string> = {
  NORMAL: "text-[var(--color-cork-muted)]",
  INSERT: "text-[var(--color-cork-success)]",
  VISUAL: "text-[var(--color-cork-accent)]",
  REPLACE: "text-[var(--color-cork-danger)]",
};

const MODE_BG: Record<string, string> = {
  NORMAL: "bg-[var(--color-cork-panel-2)]",
  INSERT: "bg-[var(--color-cork-success-tint)]",
  VISUAL: "bg-[var(--color-cork-accent-soft)]",
  REPLACE: "bg-[var(--color-cork-danger-tint)]",
};

const CHEAT_SHEET = [
  {
    category: "Modes",
    items: [
      { keys: "i", desc: "Enter Insert mode" },
      { keys: "Esc", desc: "Back to Normal mode" },
      { keys: "v", desc: "Enter Visual mode" },
      { keys: "V", desc: "Visual line mode" },
      { keys: "R", desc: "Enter Replace mode" },
    ],
  },
  {
    category: "Navigation",
    items: [
      { keys: "h j k l", desc: "Left, down, up, right" },
      { keys: "w / b", desc: "Next / previous word" },
      { keys: "0 / $", desc: "Start / end of line" },
      { keys: "gg / G", desc: "Top / bottom of file" },
      { keys: "Ctrl+d/u", desc: "Half page down / up" },
    ],
  },
  {
    category: "Editing",
    items: [
      { keys: "dd", desc: "Delete line" },
      { keys: "yy", desc: "Yank (copy) line" },
      { keys: "p", desc: "Paste after cursor" },
      { keys: "u", desc: "Undo" },
      { keys: "Ctrl+r", desc: "Redo" },
      { keys: "ciw", desc: "Change inner word" },
      { keys: "o / O", desc: "New line below / above" },
    ],
  },
  {
    category: "Search",
    items: [
      { keys: "/text", desc: "Search forward" },
      { keys: "n / N", desc: "Next / previous match" },
      { keys: ":w", desc: "Save (triggers auto-save)" },
    ],
  },
];

export function VimIndicator() {
  const vimMode = useAppSettingsStore((s) => s.settings.editor.vimMode);
  const mode = useVimModeStore((s) => s.mode);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCheatSheet) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowCheatSheet(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCheatSheet]);

  if (!vimMode) return null;

  return (
    <div className="relative flex items-center gap-1" ref={popoverRef}>
      <span
        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide ${MODE_BG[mode]} ${MODE_COLORS[mode]}`}
      >
        {mode}
      </span>
      <button
        onClick={() => setShowCheatSheet((v) => !v)}
        className="rounded p-0.5 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
        title="Vim cheat sheet"
      >
        <Question size={12} weight="bold" />
      </button>

      {showCheatSheet && (
        <div className="absolute bottom-full right-0 z-50 mb-2 w-[340px] rounded-xl border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] p-4 shadow-lg">
          <h3 className="mb-3 text-[13px] font-semibold text-[var(--color-cork-ink)]">
            Vim quick reference
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {CHEAT_SHEET.map((group) => (
              <div key={group.category}>
                <h4 className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--color-cork-subtle)]">
                  {group.category}
                </h4>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <div key={item.keys} className="flex items-baseline gap-2 text-[11px]">
                      <kbd className="shrink-0 rounded border border-[var(--color-cork-border)] bg-[var(--color-cork-kbd)] px-1 py-px font-mono text-[10px] text-[var(--color-cork-muted)]">
                        {item.keys}
                      </kbd>
                      <span className="text-[var(--color-cork-muted)]">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-[var(--color-cork-border)] pt-2 text-[10px] text-[var(--color-cork-subtle)]">
            Disable vim mode in Settings &rarr; Editor
          </p>
        </div>
      )}
    </div>
  );
}
