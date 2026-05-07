import { useEffect, useMemo, useRef, useState } from "react";
import { Command } from "cmdk";
import fuzzysort from "fuzzysort";

import { openOrCreateToday } from "@/features/daily/services/dailyService";
import { useGenerateNoteStore } from "@/features/ai/state/generateNoteStore";
import { createAndOpenNote } from "@/features/note-ops/services/createAndOpenNote";
import { cycleTheme } from "@/features/settings/runtime/themeRuntime";
import { useSettingsUiStore } from "@/features/settings/state/settingsUiStore";
import { commandsRegistry } from "@/features/shell/commands/registry";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useIndexStore } from "@/features/index/state/indexStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import type { CommandActionId, CommandRegistryItem } from "@/features/shell/commands/registry";
import type { TagCount } from "@/shared/ipc/IpcContract";
import type { NoteEntry } from "@/shared/ipc/types";

type PaletteItem =
  | { kind: "note"; id: string; title: string; folder: string; section: "Recents" | "Pinned" | "Notes" }
  | { kind: "tag"; tag: string; count: number; section: "Tags" }
  | CommandRegistryItem;

type CommandPaletteProps = {
  onCreateNote?: (title: string) => void;
};

export function CommandPalette({ onCreateNote }: CommandPaletteProps) {
  const open = useShellStore((state) => state.paletteOpen);
  const closePalette = useShellStore((state) => state.closePalette);
  const navigate = useShellStore((state) => state.navigate);
  const toggleDrawer = useShellStore((state) => state.toggleDrawer);
  const notes = useVaultStore((state) => state.notes);
  const recentNotes = useIndexStore((state) => state.recentNotes);
  const tags = useIndexStore((state) => state.tags);
  const rebuild = useIndexStore((state) => state.rebuild);
  const openVault = useVaultStore((state) => state.openVault);
  const openSettings = useSettingsUiStore((state) => state.openSettings);
  const [query, setQuery] = useState("");
  const previousFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement;
      setQuery("");
      return undefined;
    }
    if (previousFocus.current instanceof HTMLElement) {
      previousFocus.current.focus();
    }
    return undefined;
  }, [open]);

  const items = useMemo(() => buildPaletteItems(notes, recentNotes, tags), [notes, recentNotes, tags]);
  const visibleItems = useMemo(() => filterPaletteItems(items, query), [items, query]);

  if (!open) {
    return null;
  }

  const sections = groupItems(visibleItems, query);
  const hasResults = visibleItems.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[12vh]" onMouseDown={closePalette}>
      <Command
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-[min(680px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] shadow-2xl"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closePalette();
          }
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <Command.Input
          autoFocus
          aria-label="Command palette"
          value={query}
          onValueChange={setQuery}
          placeholder="Go to note, command or search…"
          className="w-full border-b border-[var(--color-noxe-border)] bg-transparent px-4 py-3 text-sm outline-none"
        />
        <Command.List className="max-h-[420px] overflow-y-auto p-2">
          {!hasResults && (
            <Command.Empty className="p-4 text-sm text-[var(--color-noxe-muted)]">
              <p>No matches</p>
              {query.trim() && (
                <button
                  type="button"
                  className="mt-3 rounded-md border border-[var(--color-noxe-border)] px-3 py-1.5 text-[12px] text-[var(--color-noxe-ink)] hover:border-[var(--color-noxe-border-strong)]"
                  onClick={() => {
                    onCreateNote?.(query.trim());
                    closePalette();
                  }}
                >
                  Create note “{query.trim()}”
                </button>
              )}
            </Command.Empty>
          )}
          {sections.map(([section, sectionItems]) => (
            <Command.Group key={section} heading={section} className="p-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-noxe-muted)]">
              {sectionItems.map((item) => (
                <PaletteRow
                  key={itemKey(item)}
                  item={item}
                  onSelect={() => {
                    runPaletteItem(item, { closePalette, navigate, toggleDrawer, openVault, openSettings, rebuild, openDaily: openOrCreateToday });
                  }}
                />
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}

function PaletteRow({ item, onSelect }: { item: PaletteItem; onSelect: () => void }) {
  return (
    <Command.Item
      value={itemSearchText(item)}
      onSelect={onSelect}
      className="flex cursor-default items-center justify-between rounded-lg px-3 py-2 text-sm normal-case text-[var(--color-noxe-ink)] aria-selected:bg-[var(--color-noxe-panel-2)]"
    >
      <span>{itemLabel(item)}</span>
      <span className="text-[11px] text-[var(--color-noxe-muted)]">{itemHint(item)}</span>
    </Command.Item>
  );
}

function buildPaletteItems(notes: NoteEntry[], recentNotes: NoteEntry[], tags: TagCount[]): PaletteItem[] {
  const recent = (recentNotes.length > 0 ? recentNotes : notes).slice(0, 5).map((note) => toNoteItem(note, "Recents"));
  const pinned = notes.slice(0, 5).map((note) => toNoteItem(note, "Pinned"));
  const allNotes = notes.map((note) => toNoteItem(note, "Notes"));
  return [...recent, ...pinned, ...commandsRegistry.slice(0, 8), ...tags.slice(0, 5).map(toTagItem), ...allNotes];
}

function filterPaletteItems(items: PaletteItem[], query: string): PaletteItem[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return dedupeItems(items.filter((item) => item.section !== "Notes"));
  }
  return fuzzysort.go(trimmed, dedupeItems(items), { key: "search", limit: 30 }).map((result) => result.obj);
}

function groupItems(items: PaletteItem[], query: string): Array<[string, PaletteItem[]]> {
  const order = query.trim()
    ? ["Notes", "Commands", "AI", "Tags", "Vault Actions", "Recents", "Pinned"]
    : ["Recents", "Pinned", "Commands", "AI", "Tags", "Vault Actions"];
  return order
    .map((section) => [section, items.filter((item) => item.section === section)] as [string, PaletteItem[]])
    .filter(([, sectionItems]) => sectionItems.length > 0);
}

function dedupeItems(items: PaletteItem[]): Array<PaletteItem & { search: string }> {
  const seen = new Set<string>();
  return items.flatMap((item) => {
    const key = itemKey(item);
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [{ ...item, search: itemSearchText(item) }];
  });
}

function toNoteItem(note: NoteEntry, section: "Recents" | "Pinned" | "Notes"): PaletteItem {
  return { kind: "note", id: note.id, title: note.title, folder: note.folder, section };
}

function toTagItem(tag: TagCount): PaletteItem {
  return { kind: "tag", tag: tag.tag, count: tag.count, section: "Tags" };
}

function itemKey(item: PaletteItem): string {
  if (item.kind === "note") {
    return `note:${item.id}`;
  }
  if (item.kind === "tag") {
    return `tag:${item.tag}`;
  }
  return `command:${item.id}`;
}

function itemLabel(item: PaletteItem): string {
  if (item.kind === "note") {
    return item.title;
  }
  if (item.kind === "tag") {
    return `#${item.tag}`;
  }
  return item.label;
}

function itemHint(item: PaletteItem): string {
  if (item.kind === "note") {
    return item.folder || "Inbox";
  }
  if (item.kind === "tag") {
    return `${item.count} notes`;
  }
  return item.section;
}

function itemSearchText(item: PaletteItem): string {
  if (item.kind === "note") {
    return `${item.title} ${item.folder}`;
  }
  if (item.kind === "tag") {
    return `${item.tag} tag`;
  }
  return item.label;
}

function runPaletteItem(
  item: PaletteItem,
  actions: {
    closePalette: () => void;
    navigate: (view: { kind: "home" } | { kind: "note"; id: string } | { kind: "graph" }) => void;
    toggleDrawer: (drawer: "search" | "folders" | "recent" | "starred" | "tags") => void;
    openVault: () => Promise<void>;
    openSettings: () => void;
    rebuild: () => Promise<void>;
    openDaily: () => Promise<void>;
  },
) {
  if (item.kind === "note") {
    actions.navigate({ kind: "note", id: item.id });
  } else if (item.kind === "tag") {
    actions.toggleDrawer("tags");
  } else {
    runCommand(item.id, actions);
  }
  actions.closePalette();
}

function runCommand(
  id: CommandActionId,
  actions: {
    navigate: (view: { kind: "home" } | { kind: "note"; id: string } | { kind: "graph" }) => void;
    openVault: () => Promise<void>;
    openSettings: () => void;
    rebuild: () => Promise<void>;
    openDaily: () => Promise<void>;
  },
) {
  if (id === "go-home") {
    actions.navigate({ kind: "home" });
  }
  if (id === "open-graph") {
    actions.navigate({ kind: "graph" });
  }
  if (id === "new-note") {
    void createAndOpenNote();
  }
  if (id === "open-vault") {
    void actions.openVault();
  }
  if (id === "open-daily") {
    void actions.openDaily();
  }
  if (id === "open-settings") {
    actions.openSettings();
  }
  if (id === "rebuild-index") {
    void actions.rebuild();
  }
  if (id === "toggle-theme") {
    cycleTheme();
  }
  if (id === "ai-generate-note") {
    useGenerateNoteStore.getState().openModal();
  }
}
