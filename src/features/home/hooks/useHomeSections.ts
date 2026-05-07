import { useCallback, useEffect, useState } from "react";

import { useVaultStore } from "@/features/vault/state/vaultStore";
import { client } from "@/shared/ipc/client";

import type { TagCount } from "@/shared/ipc/IpcContract";
import type { JsonRecord, NoteEntry } from "@/shared/ipc/types";

const PINNED_LIMIT = 6;
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
  pinned: HomeNote[];
  recents: NoteEntry[];
  tagsTop: TagCount[];
  allPage: NoteEntry[];
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => Promise<void>;
};

export function useHomeSections(): HomeSections {
  const vaultNotes = useVaultStore((state) => state.notes);
  const [pinned, setPinned] = useState<HomeNote[]>([]);
  const [recents, setRecents] = useState<NoteEntry[]>([]);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [allPage, setAllPage] = useState<NoteEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [recentNotes, tagCounts, firstPage] = await Promise.all([
        client.notes.recent(200),
        client.tags.list(),
        client.notes.allPaged(0, PAGE_SIZE),
      ]);
      const pinnedNotes = await derivePinnedNotes(recentNotes);
      setPinned(pinnedNotes);
      setRecents(recentNotes.slice(0, RECENTS_LIMIT));
      setTags(tagCounts.slice(0, TAG_LIMIT));
      setAllPage(firstPage);
      setHasMore(firstPage.length === PAGE_SIZE);
      setPageCount(1);
      setError(null);
    } catch (nextError) {
      const fallback = [...vaultNotes].sort((left, right) => right.mtime - left.mtime);
      const fallbackPinned = await derivePinnedNotes(fallback);
      setPinned(fallbackPinned);
      setRecents(fallback.slice(0, RECENTS_LIMIT));
      setTags([]);
      setAllPage(fallback.slice(0, PAGE_SIZE));
      setHasMore(fallback.length > PAGE_SIZE);
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

  return { pinned, recents, tagsTop: tags, allPage, hasMore, isLoading, error, loadMore, refresh: load };
}

async function derivePinnedNotes(notes: NoteEntry[]): Promise<HomeNote[]> {
  const enriched = await Promise.all(
    notes.slice(0, 200).map(async (note) => {
      try {
        const file = await client.notes.read(note.path);
        const pinned = file.frontmatter.pinned === true;
        return {
          ...note,
          frontmatter: file.frontmatter,
          snippet: firstLine(file.body),
          pinned,
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
    .filter((note): note is HomeNote => note !== null && note.pinned)
    .sort((left, right) => right.mtime - left.mtime)
    .slice(0, PINNED_LIMIT);
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
