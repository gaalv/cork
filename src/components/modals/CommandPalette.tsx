/**
 * Command palette — ⌘K modal for note search and command execution.
 *
 * @see F13 — Settings, Search & App Menu spec
 * @see F31 — Triage Fidelity (section ordering)
 * @see F42 — Full-text Search UI (content matches)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarBlank,
  CircleDashed,
  ClipboardText,
  FileArrowDown,
  FilePdf,
  FilePlus,
  Graph,
  MagnifyingGlass,
  NotePencil,
  Plus,
  SidebarSimple,
  Sparkle,
  TextIndent,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { getEditorView } from "@/cm/viewRef";
import { parseSnippet, usePaletteSearch } from "@/hooks/usePaletteSearch";
import { copyNoteAsMarkdown, exportNoteAsHtml, exportNoteAsPdf } from "@/services/exportNote";
import { openDailyNote } from "@/services/dailyNote";
import { useIndexStore } from "@/stores/indexStore";
import { useShellStore } from "@/stores/shellStore";
import { useVaultStore } from "@/stores/vaultStore";
import { cn } from "@/utils/cn";
import { NOTE_STATUSES, NOTE_STATUS_META, narrowNoteStatus } from "@/utils/noteStatus";

type PaletteCommand = {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
};

const COMMANDS: readonly PaletteCommand[] = [
  { id: "new-note", label: "Create new note", hint: "\u2318 N", icon: <Plus size={14} /> },
  {
    id: "new-from-template",
    label: "New note from template",
    hint: "Templates",
    icon: <FilePlus size={14} />,
  },
  {
    id: "insert-template",
    label: "Insert template",
    hint: "Templates",
    icon: <TextIndent size={14} />,
  },
  {
    id: "ai-generate",
    label: "Generate note from topic",
    hint: "AI",
    icon: <Sparkle size={14} weight="fill" />,
  },
  {
    id: "open-daily-note",
    label: "Open today's note",
    hint: "Daily",
    icon: <CalendarBlank size={14} />,
  },
  {
    id: "open-graph",
    label: "Open graph view",
    hint: "\u2318 \u21e7 G",
    icon: <Graph size={14} />,
  },
  {
    id: "toggle-inspector",
    label: "Toggle inspector",
    hint: "\u2318 .",
    icon: <SidebarSimple size={14} />,
  },
];

// Export commands only apply with an open note (appended like STATUS_COMMANDS).
const EXPORT_COMMANDS: readonly PaletteCommand[] = [
  {
    id: "export-html",
    label: "Export note as HTML",
    hint: "Export",
    icon: <FileArrowDown size={14} />,
  },
  {
    id: "export-pdf",
    label: "Export note as PDF",
    hint: "Export",
    icon: <FilePdf size={14} />,
  },
  {
    id: "copy-markdown",
    label: "Copy as Markdown",
    hint: "Export",
    icon: <ClipboardText size={14} />,
  },
];

const STATUS_COMMANDS: readonly PaletteCommand[] = [
  ...NOTE_STATUSES.map((s) => ({
    id: `set-status-${s}`,
    label: `Set status: ${NOTE_STATUS_META[s].label}`,
    hint: "Status",
    icon: (
      <span className={cn("inline-block h-2 w-2 rounded-full", NOTE_STATUS_META[s].dotClass)} />
    ),
  })),
  {
    id: "set-status-none",
    label: "Set status: None",
    hint: "Status",
    icon: <CircleDashed size={14} />,
  },
];

export function CommandPalette() {
  const open = useShellStore((s) => s.paletteOpen);
  const close = useShellStore((s) => s.setPaletteOpen);
  const openNote = useShellStore((s) => s.openNote);
  const view = useShellStore((s) => s.view);
  const notes = useVaultStore((s) => s.notes);

  // A template can only be inserted while a note is open in edit mode —
  // the CM6 view only exists then (preview unmounts it).
  const canInsertTemplate = view.kind === "note" && getEditorView() !== null;

  // Status commands only make sense with an open note
  const openNoteEntry = useMemo(
    () => (view.kind === "note" ? notes.find((n) => n.id === view.id) : undefined),
    [view, notes],
  );
  const commands = useMemo(
    () => (openNoteEntry ? [...COMMANDS, ...STATUS_COMMANDS, ...EXPORT_COMMANDS] : COMMANDS),
    [openNoteEntry],
  );

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

  // Full-text content matches (F42) — deduped against title matches, capped at 8.
  const searchResults = usePaletteSearch(query, open);
  const contentMatches = useMemo(() => {
    const titleIds = new Set(matches.map((n) => n.id));
    return searchResults.filter((n) => !titleIds.has(n.id)).slice(0, 8);
  }, [matches, searchResults]);

  const totalItems = matches.length + contentMatches.length + commands.length;

  // Content matches arrive async and can shrink the list under the cursor.
  useEffect(() => {
    setSelectedIndex((i) => (i >= totalItems ? 0 : i));
  }, [totalItems]);

  const handleSelect = useCallback(
    (index: number) => {
      if (index < matches.length + contentMatches.length) {
        const note =
          index < matches.length ? matches[index] : contentMatches[index - matches.length];
        openNote(note.id);
        close(false);
      } else {
        const cmd = commands[index - matches.length - contentMatches.length];
        if (cmd.id.startsWith("set-status-")) {
          if (openNoteEntry) {
            const status = narrowNoteStatus(cmd.id.slice("set-status-".length)) ?? null;
            void useIndexStore
              .getState()
              .setNoteStatus(openNoteEntry.id, openNoteEntry.path, status);
          }
        } else if (cmd.id === "ai-generate") {
          useShellStore.getState().setGenerateModalOpen(true);
        } else if (cmd.id === "open-daily-note") {
          void openDailyNote();
        } else if (cmd.id === "open-graph") {
          useShellStore.getState().setGraphOpen(true);
        } else if (cmd.id === "export-html") {
          void exportNoteAsHtml();
        } else if (cmd.id === "export-pdf") {
          void exportNoteAsPdf();
        } else if (cmd.id === "copy-markdown") {
          void copyNoteAsMarkdown();
        } else if (cmd.id === "toggle-inspector") {
          useShellStore.getState().toggleInspector();
        } else if (cmd.id === "new-from-template") {
          useShellStore.getState().setTemplatePickerMode("create");
        } else if (cmd.id === "insert-template") {
          if (!canInsertTemplate) {
            toast("Open a note in edit mode to insert a template");
            return;
          }
          useShellStore.getState().setTemplatePickerMode("insert");
        }
        close(false);
      }
    },
    [canInsertTemplate, close, commands, contentMatches, matches, openNote, openNoteEntry],
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
          {contentMatches.length > 0 && (
            <PaletteSection title="Content matches">
              {contentMatches.map((n, i) => (
                <PaletteRow
                  key={n.id}
                  icon={<MagnifyingGlass size={14} />}
                  title={n.title}
                  subtitle={<SnippetText snippet={n.snippet} />}
                  hint={n.folder || "Inbox"}
                  selected={selectedIndex === matches.length + i}
                  onClick={() => handleSelect(matches.length + i)}
                />
              ))}
            </PaletteSection>
          )}
          {matches.length === 0 && contentMatches.length === 0 && query && (
            <div className="px-2.5 py-4 text-center text-[12px] text-[var(--color-cork-subtle)]">
              No notes found.
            </div>
          )}
          <PaletteSection title="Commands">
            {commands.map((cmd, i) => (
              <PaletteRow
                key={cmd.id}
                icon={cmd.icon}
                title={cmd.label}
                hint={cmd.hint}
                selected={selectedIndex === matches.length + contentMatches.length + i}
                dimmed={cmd.id === "insert-template" && !canInsertTemplate}
                onClick={() => handleSelect(matches.length + contentMatches.length + i)}
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
  subtitle,
  hint,
  selected,
  dimmed,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  hint?: string;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left ${
        selected ? "bg-[var(--color-cork-accent-soft)]" : "hover:bg-[var(--color-cork-panel-2)]"
      } ${dimmed ? "opacity-50" : ""}`}
    >
      <span className="text-[var(--color-cork-muted)]">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[var(--color-cork-ink)]">{title}</span>
        {subtitle && (
          <span className="truncate text-[11px] text-[var(--color-cork-muted)]">{subtitle}</span>
        )}
      </span>
      {hint && <span className="text-[11px] text-[var(--color-cork-subtle)]">{hint}</span>}
    </button>
  );
}

/** Safe FTS snippet rendering — parsed segments, never raw HTML (SRCH-02). */
function SnippetText({ snippet }: { snippet: string }) {
  const segments = useMemo(() => parseSnippet(snippet), [snippet]);
  return (
    <>
      {segments.map((seg, i) =>
        seg.marked ? (
          <em key={i} className="not-italic font-semibold text-[var(--color-cork-ink)]">
            {seg.text}
          </em>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}
