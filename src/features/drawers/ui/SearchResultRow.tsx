import type { ReactNode } from "react";

import type { SearchResult } from "@/shared/ipc/IpcContract";

type SearchResultRowProps = {
  result: SearchResult;
  query: string;
  onOpenNote?: (id: string) => void;
};

export function SearchResultRow({ result, query, onOpenNote }: SearchResultRowProps) {
  return (
    <button
      type="button"
      className="w-full rounded-lg px-2 py-2 text-left hover:bg-[var(--color-noxe-panel-2)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
      onClick={() => onOpenNote?.(result.id)}
    >
      <span className="block text-sm font-medium text-[var(--color-noxe-ink)]">{highlightText(result.title, query)}</span>
      <span className="mt-1 line-clamp-1 block text-xs text-[var(--color-noxe-muted)]">
        {renderSnippet(result.snippet)}
      </span>
      <span className="mt-1 block text-[11px] text-[var(--color-noxe-muted)]">{result.folder || "Inbox"}</span>
    </button>
  );
}

function highlightText(text: string, query: string): ReactNode[] {
  const token = query.trim().split(/\s+/)[0]?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!token) {
    return [text];
  }
  const pattern = new RegExp(`(${token})`, "ig");
  return text.split(pattern).map((part, index) =>
    index % 2 === 1 ? (
      <mark key={`${part}-${index}`} className="rounded bg-yellow-200 px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function renderSnippet(snippet: string): ReactNode[] {
  return snippet.split(/(<mark>|<\/mark>)/g).reduce<ReactNode[]>((nodes, part, index, parts) => {
    if (part === "<mark>" || part === "</mark>") {
      return nodes;
    }
    if (parts[index - 1] === "<mark>") {
      nodes.push(
        <mark key={`${part}-${index}`} className="rounded bg-yellow-200 px-0.5 text-inherit">
          {part}
        </mark>,
      );
    } else {
      nodes.push(part);
    }
    return nodes;
  }, []);
}
