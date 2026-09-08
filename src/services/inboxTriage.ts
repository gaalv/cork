/**
 * Inbox triage — propose a home for notes that were never filed.
 *
 * The Inbox is where capture lands, which means it is also where notes go to
 * be forgotten. This asks the model to read each unfiled note and propose a
 * folder, tags and a better title; nothing is applied until the user accepts
 * it, one note at a time.
 */

import { client } from "@/ipc/client";
import { useVaultStore } from "@/stores/vaultStore";
import { vaultFolders } from "@/services/aiVault";
import { runAiSkill } from "@/services/aiRunner";

import type { NoteEntry } from "@/ipc/types";

export type TriageProposal = {
  note: NoteEntry;
  folder: string | null;
  /** True when the folder does not exist yet. */
  folderIsNew: boolean;
  tags: string[];
  title: string;
  /** True when the model wants the title changed. */
  retitle: boolean;
};

/** Notes with no folder — the sidebar's definition of the Inbox. */
export function inboxNotes(): NoteEntry[] {
  return useVaultStore
    .getState()
    .notes.filter((n) => !n.folder || n.folder.toLowerCase() === "inbox")
    .sort((a, b) => b.mtime - a.mtime);
}

/** Titles Cork or the user never really chose. */
function isPlaceholderTitle(title: string): boolean {
  return (
    /^untitled/i.test(title) ||
    /^quick capture/i.test(title) ||
    /^\d{4}-\d{2}-\d{2}/.test(title) ||
    title.trim().length === 0
  );
}

/**
 * Parse the skill's three-line answer.
 *
 * Exported because a misparse here moves and renames real files — this is the
 * one place where model output turns into a destructive filesystem action, so
 * it is worth being able to exercise directly.
 */
export function parseProposal(note: NoteEntry, output: string): TriageProposal | null {
  const lines = output.split("\n").map((l) => l.trim());
  const field = (name: string) =>
    lines
      .find((l) => l.toUpperCase().startsWith(`${name}:`))
      ?.slice(name.length + 1)
      .trim() ?? "";

  const rawFolder = field("FOLDER");
  const rawTags = field("TAGS");
  const rawTitle = field("TITLE");

  if (!rawFolder && !rawTags && !rawTitle) return null;

  const newMatch = /^NEW\s+(.+)$/i.exec(rawFolder);
  const folder =
    /^inbox$/i.test(rawFolder) || rawFolder === "" ? null : (newMatch?.[1] ?? rawFolder);

  const tags = /^none$/i.test(rawTags)
    ? []
    : rawTags
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean)
        .slice(0, 3);

  const title = rawTitle || note.title;

  return {
    note,
    folder,
    folderIsNew: Boolean(newMatch),
    tags,
    title,
    retitle: title !== note.title && isPlaceholderTitle(note.title),
  };
}

/** Ask the model where a single note belongs. */
export async function proposeFor(note: NoteEntry): Promise<TriageProposal | null> {
  const file = await client.notes.read(note.path);
  const body = (file as { body: string }).body;

  const tagList = useVaultStore.getState().notes.flatMap((n) => {
    const raw = (n as NoteEntry & { tags?: string[] }).tags;
    return Array.isArray(raw) ? raw : [];
  });

  const result = (await runAiSkill("triage-note", {
    title: note.title,
    body: body.slice(0, 4000),
    folders: vaultFolders().join("\n") || "(none yet)",
    tags: [...new Set(tagList)].slice(0, 40).join(", ") || "(none yet)",
  })) as { output: string };

  return parseProposal(note, result.output);
}

/** Apply an accepted proposal: move, retitle, then tag. */
export async function applyProposal(proposal: TriageProposal): Promise<void> {
  const vault = useVaultStore.getState();
  let path = proposal.note.path;

  if (proposal.retitle && proposal.title !== proposal.note.title) {
    const renamed = await client.notes.rename({ oldPath: path, newName: proposal.title });
    path = (renamed as { path: string }).path;
  }

  if (proposal.folder) {
    await client.notes.move({ notePath: path, destFolder: proposal.folder });
  }

  if (proposal.tags.length > 0) {
    const file = await client.notes.read(path);
    const current = file as { frontmatter: Record<string, unknown>; body: string };
    const existing = Array.isArray(current.frontmatter.tags)
      ? (current.frontmatter.tags as string[])
      : [];
    await client.notes.save({
      path,
      body: current.body,
      frontmatter: { ...current.frontmatter, tags: [...new Set([...existing, ...proposal.tags])] },
    });
  }

  await vault.loadNotes();
}
