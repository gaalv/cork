import { autocompletion, CompletionContext } from "@codemirror/autocomplete";

import { useIndexStore } from "@/features/index/state/indexStore";

import type { Completion, CompletionResult } from "@codemirror/autocomplete";

export const tagAutocomplete = autocompletion({ override: [tagCompletionSource] });

export function tagCompletionSource(context: CompletionContext): CompletionResult | null {
  const before = context.matchBefore(/(^|\s)#[\w-]*/);
  if (!before) {
    return null;
  }
  const hashIndex = before.text.lastIndexOf("#");
  const query = before.text.slice(hashIndex + 1).toLowerCase();
  const from = before.from + hashIndex;
  const options: Completion[] = useIndexStore
    .getState()
    .tags.filter((tag) => tag.tag.toLowerCase().includes(query))
    .sort((left, right) => right.count - left.count)
    .slice(0, 10)
    .map((tag) => ({ label: `#${tag.tag}`, apply: `#${tag.tag}`, detail: `${tag.count}` }));
  return { from, to: before.to, options, filter: false };
}
