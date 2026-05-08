import { client } from "@/shared/ipc/client";

import type { JsonRecord, NoteEntry } from "@/shared/ipc/types";

export type EnrichedNote = NoteEntry & {
  frontmatter: JsonRecord;
  snippet: string;
  tags: string[];
  pinned: boolean;
  starred: boolean;
};

export async function enrichNotes(notes: NoteEntry[], limit = 200): Promise<EnrichedNote[]> {
  const results = await Promise.all(
    notes.slice(0, limit).map(async (note) => {
      const file = await readNote(note.path);
      if (!file) return null;
      return {
        ...note,
        frontmatter: file.frontmatter,
        snippet: firstMeaningfulLine(file.body),
        tags: extractTags(file.frontmatter),
        pinned: file.frontmatter.pinned === true,
        starred: file.frontmatter.starred === true,
      } satisfies EnrichedNote;
    }),
  );
  return results.filter((value): value is EnrichedNote => value !== null);
}

async function readNote(path: string) {
  try {
    return await client.notes.read(path);
  } catch {
    return window.__noxe_test_readNote?.(path) ?? null;
  }
}

export function firstMeaningfulLine(markdown: string): string {
  return (
    markdown
      .split("\n")
      .map((line) => line.replace(/^#+\s*/, "").trim())
      .find((line) => line.length > 0) ?? "No preview available"
  );
}

export function extractTags(frontmatter: JsonRecord): string[] {
  const raw = frontmatter.tags;
  if (Array.isArray(raw)) {
    return raw.filter((value): value is string => typeof value === "string" && value.length > 0);
  }
  if (typeof raw === "string" && raw.length > 0) {
    return raw.split(/[,\s]+/).filter(Boolean);
  }
  return [];
}
