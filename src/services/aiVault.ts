/**
 * Vault context for the AI skills.
 *
 * The skills themselves only see text, so the interesting work is choosing
 * *which* text. Everything here narrows the vault down to a few relevant notes
 * before a model is involved — the SQLite FTS5 index does the retrieval, which
 * is both far cheaper than embedding the vault and honest about why a note was
 * picked.
 */

import { client } from "@/ipc/client";
import { useVaultStore } from "@/stores/vaultStore";

import type { NoteEntry } from "@/ipc/types";
import type { SearchResult } from "@/ipc/IpcContract";

/** Words too common to be worth searching on. */
const STOPWORDS = new Set([
  // English
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "from",
  "have",
  "has",
  "was",
  "were",
  "are",
  "but",
  "not",
  "you",
  "your",
  "our",
  "their",
  "its",
  "it's",
  "can",
  "will",
  "would",
  "should",
  "could",
  "all",
  "any",
  "how",
  "why",
  "what",
  "when",
  "where",
  "who",
  "into",
  "than",
  "then",
  "them",
  // Portuguese
  "que",
  "para",
  "com",
  "uma",
  "um",
  "dos",
  "das",
  "por",
  "mais",
  "como",
  "mas",
  "ele",
  "ela",
  "isso",
  "está",
  "são",
  "foi",
  "ser",
  "ter",
  "sem",
  "sobre",
  "quando",
  "onde",
  "pelo",
  "pela",
]);

/** The most distinctive terms in a note, for use as a search query. */
export function keyTerms(text: string, limit = 12): string[] {
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}'-]+/u)) {
    const word = raw.replace(/^[-']+|[-']+$/g, "");
    if (word.length < 4 || STOPWORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

/** Titles this note already links to, so they are not suggested again. */
export function existingLinks(body: string): string[] {
  const links = new Set<string>();
  const pattern = /\[\[([^[\]|]+?)(?:\|[^[\]]+?)?\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) links.add(match[1].trim());
  return [...links];
}

/**
 * Notes worth showing the model alongside `note`.
 *
 * Runs one search per key term and merges by rank, which surfaces notes that
 * match several terms rather than one term strongly.
 */
export async function findCandidates(
  body: string,
  excludeId: string | null,
  limit = 25,
): Promise<SearchResult[]> {
  const terms = keyTerms(body, 8);
  if (terms.length === 0) return [];

  const scored = new Map<string, { note: SearchResult; score: number }>();
  const searches = await Promise.all(
    terms.map((term) =>
      client.index
        .search(term, 10)
        .then((r) => r as SearchResult[])
        .catch(() => [] as SearchResult[]),
    ),
  );

  for (const results of searches) {
    results.forEach((note, position) => {
      if (note.id === excludeId) return;
      const existing = scored.get(note.id);
      // Earlier positions are worth more; appearing in several searches wins.
      const points = 1 / (position + 1);
      if (existing) existing.score += points;
      else scored.set(note.id, { note, score: points });
    });
  }

  return [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.note);
}

/** `- Title (Folder) — snippet` lines, the shape every candidate list uses. */
export function formatCandidates(notes: { title: string; folder: string; snippet?: string }[]) {
  return notes
    .map((n) => {
      const where = n.folder ? ` (${n.folder})` : "";
      const snippet = n.snippet ? ` — ${n.snippet.replace(/\s+/g, " ").slice(0, 160)}` : "";
      return `- ${n.title}${where}${snippet}`;
    })
    .join("\n");
}

/** Distinct folders in the vault, most populated first. */
export function vaultFolders(): string[] {
  const counts = new Map<string, number>();
  for (const note of useVaultStore.getState().notes) {
    if (note.folder) counts.set(note.folder, (counts.get(note.folder) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([folder]) => folder);
}

/** Notes modified within the last `days`, newest first. */
export function recentNotes(days = 7, limit = 12): NoteEntry[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return useVaultStore
    .getState()
    .notes.filter((n) => n.mtime * 1000 >= cutoff)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);
}

/**
 * Parses `TITLE :: detail` lines, the output shape shared by the
 * suggest-links and find-overlap skills.
 */
export function parsePairs(output: string): { title: string; detail: string }[] {
  const trimmed = output.trim();
  if (!trimmed || /^none$/i.test(trimmed)) return [];
  return trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("::"))
    .map((line) => {
      const [title, ...rest] = line.split("::");
      return { title: title.trim().replace(/^[-*\d.\s]+/, ""), detail: rest.join("::").trim() };
    })
    .filter((pair) => pair.title.length > 0);
}
