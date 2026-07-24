import { useCallback, useEffect, useMemo, useState } from "react";
import { LinkSimple, Plus } from "@phosphor-icons/react";
import { toast } from "sonner";

import { useEditorStore } from "@/stores/editorStore";
import { useShellStore } from "@/stores/shellStore";
import { useVaultStore } from "@/stores/vaultStore";
import { client } from "@/ipc/client";
import type { Mention } from "@/ipc/IpcContract";
import { SectionHeader } from "./helpers";

/** Wrap the first whole-word, non-wikilinked occurrence of `title` in `[[ ]]`. */
function linkifyFirstMention(body: string, title: string): string | null {
  const spans = [...body.matchAll(/\[\[[^\]]*\]\]/g)].map(
    (m) => [m.index ?? 0, (m.index ?? 0) + m[0].length] as const,
  );
  const insideWikilink = (start: number, end: number) =>
    spans.some(([s, e]) => s <= start && end <= e);

  const lower = body.toLowerCase();
  const needle = title.toLowerCase();
  if (needle.length === 0) return null;

  let from = 0;
  for (;;) {
    const idx = lower.indexOf(needle, from);
    if (idx === -1) return null;
    const end = idx + needle.length;
    const before = idx === 0 ? "" : body[idx - 1];
    const after = end >= body.length ? "" : body[end];
    const wholeWord = !/\w/.test(before) && !/\w/.test(after);
    if (wholeWord && !insideWikilink(idx, end)) {
      return `${body.slice(0, idx)}[[${body.slice(idx, end)}]]${body.slice(end)}`;
    }
    from = idx + 1;
  }
}

export function UnlinkedMentionsSection() {
  const noteId = useEditorStore((s) => s.noteId);
  const notes = useVaultStore((s) => s.notes);
  const openNote = useShellStore((s) => s.openNote);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [linking, setLinking] = useState<string | null>(null);

  const title = useMemo(() => notes.find((n) => n.id === noteId)?.title ?? "", [notes, noteId]);

  const load = useCallback(() => {
    if (!noteId) {
      setMentions([]);
      return;
    }
    void client.links
      .unlinkedMentions(noteId)
      .then((res) => setMentions(res as Mention[]))
      .catch(() => setMentions([]));
  }, [noteId]);

  useEffect(() => {
    load();
  }, [load]);

  const link = useCallback(
    async (mention: Mention) => {
      if (!title) return;
      setLinking(mention.id);
      try {
        const file = await client.notes.read(mention.path);
        const next = linkifyFirstMention(file.body, title);
        if (!next) {
          toast.message("No plain-text mention left to link");
          setMentions((prev) => prev.filter((m) => m.id !== mention.id));
          return;
        }
        await client.notes.save({
          path: file.path,
          frontmatter: file.frontmatter,
          body: next,
          expectedMtime: file.mtime,
        });
        setMentions((prev) => prev.filter((m) => m.id !== mention.id));
        toast.success(`Linked from ${mention.title}`);
      } catch {
        toast.error("Could not link mention");
      } finally {
        setLinking(null);
      }
    },
    [title],
  );

  if (mentions.length === 0) return null;

  return (
    <section>
      <SectionHeader
        icon={<LinkSimple size={14} />}
        title={`Unlinked mentions (${mentions.length})`}
      />
      <ul className="flex flex-col gap-1.5">
        {mentions.map((mention) => (
          <li
            key={mention.id}
            className="group rounded px-2 py-1 hover:bg-[var(--color-cork-panel-2)]"
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => openNote(mention.id)}
                className="flex min-w-0 flex-1 items-center gap-2 truncate text-left text-[12px] text-[var(--color-cork-ink)]"
              >
                <span className="truncate">{mention.title}</span>
                {mention.folder && (
                  <span className="shrink-0 text-[10px] text-[var(--color-cork-subtle)]">
                    {mention.folder}
                  </span>
                )}
              </button>
              <button
                onClick={() => void link(mention)}
                disabled={linking === mention.id}
                title="Convert this mention to a wikilink"
                className="flex shrink-0 items-center gap-1 rounded border border-[var(--color-cork-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-cork-muted)] opacity-0 hover:text-[var(--color-cork-ink)] group-hover:opacity-100 disabled:opacity-40"
              >
                <Plus size={10} />
                Link
              </button>
            </div>
            {/* Snippet is plain text from the backend; React escapes it. */}
            <p className="mt-0.5 truncate text-[11px] text-[var(--color-cork-subtle)]">
              {mention.snippet}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
