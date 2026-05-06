import { useEffect, useState } from "react";

import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { client } from "@/shared/ipc/client";

import type { SearchResult } from "@/shared/ipc/IpcContract";

type SearchState = {
  query: string;
  setQuery: (query: string) => void;
  results: SearchResult[];
  isSearching: boolean;
  error: string | null;
};

const SEARCH_DEBOUNCE_MS = 120;

export function useSearch(): SearchState {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addSearchHistory = useDrawersStore((state) => state.addSearchHistory);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = window.setTimeout(() => {
      void client.notes
        .search(trimmed, 30)
        .then((nextResults) => {
          if (cancelled) {
            return;
          }
          setResults(nextResults);
          setError(null);
          addSearchHistory(trimmed);
        })
        .catch((searchError: unknown) => {
          if (cancelled) {
            return;
          }
          setResults([]);
          setError(errorMessage(searchError));
        })
        .finally(() => {
          if (!cancelled) {
            setIsSearching(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [addSearchHistory, query]);

  return { query, setQuery, results, isSearching, error };
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
  return "Search failed";
}
