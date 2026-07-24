/**
 * Debounced full-text search for the command palette (F42).
 *
 * Queries the FTS5 index via `indexStore.search` once the query reaches
 * two characters, debounced ~150ms. Failures degrade silently to an
 * empty result set so the palette falls back to title matches (SRCH-04).
 */

import { useEffect, useRef, useState } from "react";

import { useIndexStore } from "@/stores/indexStore";

import type { NoteEntry } from "@/ipc/types";

const DEBOUNCE_MS = 150;
const MIN_QUERY_LENGTH = 2;

/** Fetch extra results so the cap survives deduplication against title matches. */
const FETCH_LIMIT = 16;

export function usePaletteSearch(query: string, enabled: boolean): NoteEntry[] {
  const [results, setResults] = useState<NoteEntry[]>([]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const trimmed = query.trim();
    if (!enabled || trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      useIndexStore
        .getState()
        .search(trimmed, FETCH_LIMIT)
        .then((entries) => {
          if (requestIdRef.current === requestId) setResults(entries);
        })
        .catch(() => {
          // SRCH-04 — IPC failure degrades silently to title matches only.
          if (requestIdRef.current === requestId) setResults([]);
        });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, enabled]);

  return results;
}

export type SnippetSegment = {
  text: string;
  marked: boolean;
};

/**
 * Split an FTS5 snippet into plain/marked segments. The indexer wraps
 * matches in `<mark>…</mark>`; parsing (instead of injecting HTML) keeps
 * rendering safe (SRCH-02).
 */
export function parseSnippet(snippet: string): SnippetSegment[] {
  const segments: SnippetSegment[] = [];
  const pattern = /<mark>(.*?)<\/mark>/g;
  let lastIndex = 0;
  for (const match of snippet.matchAll(pattern)) {
    if (match.index > lastIndex) {
      segments.push({ text: snippet.slice(lastIndex, match.index), marked: false });
    }
    if (match[1]) segments.push({ text: match[1], marked: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < snippet.length) {
    segments.push({ text: snippet.slice(lastIndex), marked: false });
  }
  return segments;
}
