import { useEffect, useMemo, useState } from "react";
import { ArrowBendUpLeft, Link as LinkIcon } from "@phosphor-icons/react";

import { useEditorStore } from "@/stores/editorStore";
import { useShellStore } from "@/stores/shellStore";
import { useVaultStore } from "@/stores/vaultStore";
import { client } from "@/ipc/client";
import type { LinkRow } from "@/ipc/IpcContract";
import { SectionHeader } from "./helpers";

export function BacklinksSection() {
  const noteId = useEditorStore((s) => s.noteId);
  const notes = useVaultStore((s) => s.notes);
  const openNote = useShellStore((s) => s.openNote);
  const [backlinks, setBacklinks] = useState<LinkRow[]>([]);

  useEffect(() => {
    if (!noteId) {
      setBacklinks([]);
      return;
    }
    void client.links
      .incoming(noteId)
      .then((res) => setBacklinks(res as LinkRow[]))
      .catch(() => setBacklinks([]));
  }, [noteId]);

  const resolvedLinks = useMemo(() => {
    const noteMap = new Map(notes.map((n) => [n.id, n]));
    return backlinks
      .map((link) => {
        const source = noteMap.get(link.srcNoteId);
        return source ? { id: source.id, title: source.title, folder: source.folder } : null;
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }, [backlinks, notes]);

  const unique = useMemo(() => {
    const seen = new Set<string>();
    return resolvedLinks.filter((l) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
  }, [resolvedLinks]);

  return (
    <section>
      <SectionHeader icon={<ArrowBendUpLeft size={14} />} title={`Backlinks (${unique.length})`} />
      {unique.length === 0 && (
        <p className="text-[11px] text-[var(--color-cork-subtle)]">No notes link to this one</p>
      )}
      {unique.length > 0 && (
        <nav className="flex flex-col gap-0.5">
          {unique.map((link) => (
            <button
              key={link.id}
              onClick={() => openNote(link.id)}
              className="flex items-center gap-2 truncate rounded px-2 py-1 text-left text-[12px] text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
            >
              <LinkIcon size={12} className="shrink-0 text-[var(--color-cork-muted)]" />
              <span className="truncate">{link.title}</span>
              {link.folder && (
                <span className="ml-auto shrink-0 text-[10px] text-[var(--color-cork-subtle)]">
                  {link.folder}
                </span>
              )}
            </button>
          ))}
        </nav>
      )}
    </section>
  );
}
