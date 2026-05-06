import { MagnifyingGlass } from "@phosphor-icons/react";

import { useSearch } from "@/features/drawers/hooks/useSearch";
import { useDrawersStore } from "@/features/drawers/state/drawersStore";

import { SearchResultRow } from "./SearchResultRow";

type SearchDrawerProps = {
  onOpenNote?: (id: string) => void;
};

export function SearchDrawer({ onOpenNote }: SearchDrawerProps) {
  const { query, setQuery, results, isSearching, error } = useSearch();
  const searchHistory = useDrawersStore((state) => state.searchHistory);
  const hasQuery = query.trim().length >= 2;

  return (
    <section role="region" aria-label="Search drawer" className="space-y-4 text-sm">
      <label className="relative block">
        <span className="sr-only">Search notes</span>
        <MagnifyingGlass className="absolute top-1/2 left-2 -translate-y-1/2 text-[var(--color-noxe-muted)]" size={15} />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search notes…"
          className="w-full rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-bg)] py-2 pr-3 pl-8 text-sm text-[var(--color-noxe-ink)] placeholder:text-[var(--color-noxe-muted)] focus:border-[var(--color-noxe-border-strong)] focus:ring-2 focus:ring-[var(--color-noxe-ring)] focus:outline-none"
        />
      </label>

      {!hasQuery ? <RecentSearches searches={searchHistory} onPick={setQuery} /> : null}
      {hasQuery && isSearching ? <p className="text-xs text-[var(--color-noxe-muted)]">Searching…</p> : null}
      {hasQuery && error ? <p className="text-xs text-red-600">{error}</p> : null}
      {hasQuery && !isSearching && !error && results.length === 0 ? (
        <p className="text-xs text-[var(--color-noxe-muted)]">No notes match this search.</p>
      ) : null}
      {hasQuery && results.length > 0 ? (
        <div className="space-y-1" aria-label="Search results">
          {results.map((result) => (
            <SearchResultRow key={result.id} result={result} query={query} onOpenNote={onOpenNote} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

type RecentSearchesProps = {
  searches: string[];
  onPick: (query: string) => void;
};

function RecentSearches({ searches, onPick }: RecentSearchesProps) {
  if (searches.length === 0) {
    return <p className="text-xs text-[var(--color-noxe-muted)]">Type at least 2 characters to search your vault.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[var(--color-noxe-muted)]">Recent searches</p>
      <div className="space-y-1">
        {searches.map((search) => (
          <button
            key={search}
            type="button"
            onClick={() => onPick(search)}
            className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)]"
          >
            {search}
          </button>
        ))}
      </div>
    </div>
  );
}
