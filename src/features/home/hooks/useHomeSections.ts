import { useCallback, useEffect, useState } from "react";

import { useVaultStore } from "@/features/vault/state/vaultStore";
import { client } from "@/shared/ipc/client";

import type { TagCount } from "@/shared/ipc/IpcContract";
import type { JsonRecord, NoteEntry } from "@/shared/ipc/types";

const STARRED_LIMIT = 4;
const RECENTS_LIMIT = 8;
const TAG_LIMIT = 6;
const PAGE_SIZE = 30;

export type HomeNote = NoteEntry & {
  frontmatter: JsonRecord;
  snippet: string;
  pinned: boolean;
  starred: boolean;
};

export type HomeSections = {
  starred: HomeNote[];
  recents: NoteEntry[];
  tagsTop: TagCount[];
  allPage: NoteEntry[];
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => Promise<void>;
  flagsByPath: Map<string, { pinned: boolean; starred: boolean; icon?: string }>;
};

export function useHomeSections(): HomeSections {
  const vaultNotes = useVaultStore((state) => state.notes);
  const [starred, setStarred] = useState<HomeNote[]>([]);
  const [recents, setRecents] = useState<NoteEntry[]>([]);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [allPage, setAllPage] = useState<NoteEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flagsByPath, setFlagsByPath] = useState<Map<string, { pinned: boolean; starred: boolean; icon?: string }>>(new Map());

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [recentNotes, tagCounts, firstPage] = await Promise.all([
        client.notes.recent(200),
        client.tags.list(),
        client.notes.allPaged(0, PAGE_SIZE),
      ]);
      const enriched = await enrichNotes(recentNotes);
      const flags = buildFlagsMap(enriched);
      const starredNotes = enriched.filter((note) => note.starred).slice(0, STARRED_LIMIT);
      setStarred(starredNotes);
      setRecents(recentNotes.slice(0, RECENTS_LIMIT));
      setTags(tagCounts.slice(0, TAG_LIMIT));
      setAllPage(firstPage);
      setHasMore(firstPage.length === PAGE_SIZE);
      setPageCount(1);
      setFlagsByPath(flags);
      setError(null);
    } catch (nextError) {
      const fallback = [...vaultNotes].sort((left, right) => right.mtime - left.mtime);
      const enriched = await enrichNotes(fallback);
      const flags = buildFlagsMap(enriched);
      const fallbackStarred = enriched.filter((note) => note.starred).slice(0, STARRED_LIMIT);
      setStarred(fallbackStarred);
      setRecents(fallback.slice(0, RECENTS_LIMIT));
      setTags([]);
      setAllPage(fallback.slice(0, PAGE_SIZE));
      setHasMore(fallback.length > PAGE_SIZE);
      setFlagsByPath(flags);
      setError(errorMessage(nextError));
    } finally {
      setIsLoading(false);
    }
  }, [vaultNotes]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    void client.events
      .on("vault:fileChanged", () => {
        if (!cancelled) {
          void load();
        }
      })
      .then((nextUnlisten) => {
        if (cancelled) {
          nextUnlisten();
          return;
        }
        unlisten = nextUnlisten;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [load]);

  const loadMore = useCallback(() => setPageCount((count) => count + 1), []);

  useEffect(() => {
    if (pageCount === 1) {
      return;
    }
    let cancelled = false;
    void client.notes
      .allPaged((pageCount - 1) * PAGE_SIZE, PAGE_SIZE)
      .then((nextPage) => {
        if (cancelled) {
          return;
        }
        setAllPage((current) => [...current, ...nextPage]);
        setHasMore(nextPage.length === PAGE_SIZE);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(errorMessage(nextError));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pageCount]);

  return { starred, recents, tagsTop: tags, allPage, hasMore, isLoading, error, loadMore, refresh: load, flagsByPath };
}

async function enrichNotes(notes: NoteEntry[]): Promise<HomeNote[]> {
  const enriched = await Promise.all(
    notes.slice(0, 200).map(async (note) => {
      try {
        const file = await client.notes.read(note.path);
        return {
          ...note,
          frontmatter: file.frontmatter,
          snippet: firstLine(file.body),
          pinned: file.frontmatter.pinned === true,
          starred: file.frontmatter.starred === true,
        } satisfies HomeNote;
      } catch {
        const file = window.__noxe_test_readNote?.(note.path);
        if (!file) {
          return null;
        }
        return {
          ...note,
          frontmatter: file.frontmatter,
          snippet: firstLine(file.body),
          pinned: file.frontmatter.pinned === true,
          starred: file.frontmatter.starred === true,
        } satisfies HomeNote;
      }
    }),
  );
  return enriched
    .filter((note): note is HomeNote => note !== null)
    .sort((left, right) => right.mtime - left.mtime);
}

function buildFlagsMap(notes: HomeNote[]): Map<string, { pinned: boolean; starred: boolean; icon?: string }> {
  const map = new Map<string, { pinned: boolean; starred: boolean; icon?: string }>();
  for (const note of notes) {
    const icon = typeof note.frontmatter.icon === "string" ? note.frontmatter.icon : undefined;
    map.set(note.path, { pinned: note.pinned, starred: note.starred, icon });
  }
  return map;
}

function firstLine(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find((line) => line.length > 0) ?? "No preview available";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "Unable to load home sections";
}
