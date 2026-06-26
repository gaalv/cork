/**
 * Command palette — ⌘K modal for note search and command execution.
 *
 * @see F13 — Settings, Search & App Menu spec
 * @see F31 — Triage Fidelity (section ordering)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass, NotePencil, Plus, SidebarSimple, Sparkle } from "@phosphor-icons/react";

import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

const COMMANDS = [
  { id: "new-note", label: "Create new note", hint: "\u2318 N", icon: <Plus size={14} /> },
  {
    id: "ai-generate",
    label: "Generate note from topic",
    hint: "AI",
    icon: <Sparkle size={14} weight="fill" />,
  },
  {
    id: "toggle-inspector",
    label: "Toggle inspector",
    hint: "\u2318 .",
    icon: <SidebarSimple size={14} />,
  },
] as const;

export function CommandPalette() {
  const open = useShellStore((s) => s.paletteOpen);
  const close = useShellStore((s) => s.setPaletteOpen);
  const openNote = useShellStore((s) => s.openNote);
  const notes = useVaultStore((s) => s.notes);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when palette opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      // Focus input on next tick (after render)
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const matches = useMemo(() => {
    if (!query) return notes.slice(0, 8);
    const q = query.toLowerCase();
    return notes
      .filter((n) => n.title.toLowerCase().includes(q) || n.path.toLowerCase().includes(q))
      .slice(0, 10);
  }, [notes, query]);

  const totalItems = matches.length + COMMANDS.length;

  const handleSelect = useCallback(
    (index: number) => {
      if (index < matches.length) {
        openNote(matches[index].id);
        close(false);
      } else {
        const cmd = COMMANDS[index - matches.length];
        if (cmd.id === "ai-generate") {
          useShellStore.getState().setGenerateModalOpen(true);
        } else if (cmd.id === "toggle-inspector") {
          useShellStore.getState().toggleInspector();
        }
        close(false);
      }
    },
    [close, matches, openNote],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % totalItems);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + totalItems) % totalItems);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSelect(selectedIndex);
      }
    },
    [handleSelect, selectedIndex, totalItems],
  );

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-start justify-center bg-[var(--color-cork-ink)]/30 pt-[14vh]"
      onClick={() => close(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-[560px] overflow-hidden rounded-2xl border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-cork-border)] px-4 py-3">
          <MagnifyingGlass size={16} className="text-[var(--color-cork-muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Go to note, run command, or search..."
            className="w-full bg-transparent text-[14px] outline-none placeholder:text-[var(--color-cork-subtle)]"
          />
          <kbd className="rounded border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-1.5 py-0.5 text-[10px] text-[var(--color-cork-muted)]">
            ESC
          </kbd>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2 text-[13px]">
          {matches.length > 0 && (
            <PaletteSection title="Notes">
              {matches.map((n, i) => (
                <PaletteRow
                  key={n.id}
                  icon={<NotePencil size={14} />}
                  title={n.title}
                  hint={n.folder || "Inbox"}
                  selected={selectedIndex === i}
                  onClick={() => handleSelect(i)}
                />
              ))}
            </PaletteSection>
          )}
          {matches.length === 0 && query && (
            <div className="px-2.5 py-4 text-center text-[12px] text-[var(--color-cork-subtle)]">
              No notes found.
            </div>
          )}
          <PaletteSection title="Commands">
            {COMMANDS.map((cmd, i) => (
              <PaletteRow
                key={cmd.id}
                icon={cmd.icon}
                title={cmd.label}
                hint={cmd.hint}
                selected={selectedIndex === matches.length + i}
                onClick={() => handleSelect(matches.length + i)}
              />
            ))}
          </PaletteSection>
        </div>
      </div>
    </div>
  );
}

function PaletteSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-cork-subtle)]">
        {title}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function PaletteRow({
  icon,
  title,
  hint,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left ${
        selected ? "bg-[var(--color-cork-accent-soft)]" : "hover:bg-[var(--color-cork-panel-2)]"
      }`}
    >
      <span className="text-[var(--color-cork-muted)]">{icon}</span>
      <span className="flex-1 truncate text-[var(--color-cork-ink)]">{title}</span>
      {hint && <span className="text-[11px] text-[var(--color-cork-subtle)]">{hint}</span>}
    </button>
  );
}
