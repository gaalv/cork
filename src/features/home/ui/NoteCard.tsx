import { Star, Tag } from "@phosphor-icons/react";

import { NoteCardMenu } from "./NoteCardMenu";

import { resolveNoteIcon } from "@/shared/ui/noteIcons";

import type { HomeNote } from "@/features/home/hooks/useHomeSections";
import type { MouseEvent } from "react";
import type { NoteEntry } from "@/shared/ipc/types";

type NoteCardProps = {
  note: NoteEntry | HomeNote;
  onOpen: (note: NoteEntry) => void;
  onPinToggle: (note: NoteEntry) => Promise<void> | void;
  onChanged?: () => void;
  selected?: boolean;
  onSelectClick?: (event: MouseEvent, note: NoteEntry) => boolean;
  flags?: { pinned: boolean; starred: boolean; icon?: string };
  compact?: boolean;
};

export function NoteCard({
  note,
  onOpen,
  onPinToggle,
  onChanged,
  selected = false,
  onSelectClick,
  flags,
  compact = false,
}: NoteCardProps) {
  const homeNote = isHomeNote(note) ? note : null;
  const pinned = flags?.pinned ?? homeNote?.pinned ?? false;
  const starred = flags?.starred ?? homeNote?.starred ?? false;
  const iconKey =
    flags?.icon ??
    (homeNote && typeof homeNote.frontmatter.icon === "string"
      ? (homeNote.frontmatter.icon as string)
      : undefined);
  const Icon = resolveNoteIcon(iconKey);
  const snippet = homeNote?.snippet ?? (note.folder || "No preview available");
  const tags = extractTags(homeNote);

  return (
    <article
      className={`group flex flex-col gap-2 rounded-xl border bg-[var(--color-noxe-panel)] p-3 transition hover:border-[var(--color-noxe-border-strong)] hover:shadow-sm ${selected ? "border-[var(--color-noxe-ring)] ring-2 ring-[var(--color-noxe-ring)]/30" : "border-[var(--color-noxe-border)]"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={(event) => {
            if (onSelectClick?.(event, note)) {
              return;
            }
            onOpen(note);
          }}
          className="flex min-w-0 flex-1 items-start gap-2 text-left focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
        >
          <Icon
            size={14}
            weight="duotone"
            className="mt-0.5 shrink-0 text-[var(--color-noxe-muted)]"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-[var(--color-noxe-ink)]">
              {note.title}
            </span>
            <span
              className={`mt-1 block text-[12px] leading-relaxed text-[var(--color-noxe-muted)] ${compact ? "line-clamp-2" : "line-clamp-3"}`}
            >
              {snippet}
            </span>
          </span>
        </button>
        <div className="flex items-start gap-1">
          {starred ? <Star size={12} weight="fill" className="mt-1 text-amber-500" /> : null}
          <NoteCardMenu
            note={note}
            pinned={pinned}
            starred={starred}
            onOpen={onOpen}
            onPinToggle={onPinToggle}
            onChanged={onChanged}
          />
        </div>
      </div>
      <div className="mt-auto flex items-center gap-1.5 pt-1">
        {tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-0.5 rounded-full bg-[var(--color-noxe-accent-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-noxe-accent)]"
          >
            <Tag size={9} weight="fill" />
            {tag}
          </span>
        ))}
        {note.folder ? (
          <span className="truncate text-[10px] text-[var(--color-noxe-muted)]">{note.folder}</span>
        ) : null}
        <time
          className="ml-auto text-[10px] text-[var(--color-noxe-muted)]"
          dateTime={new Date(note.mtime).toISOString()}
        >
          {formatDate(note.mtime)}
        </time>
      </div>
    </article>
  );
}

function isHomeNote(note: NoteEntry | HomeNote): note is HomeNote {
  return "frontmatter" in note;
}

function extractTags(note: HomeNote | null): string[] {
  if (!note) return [];
  const raw = note.frontmatter.tags;
  if (Array.isArray(raw)) {
    return raw.filter((value): value is string => typeof value === "string" && value.length > 0);
  }
  if (typeof raw === "string" && raw.length > 0) {
    return raw.split(/[,\s]+/).filter(Boolean);
  }
  return [];
}

function formatDate(mtime: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(mtime),
  );
}
