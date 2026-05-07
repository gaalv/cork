import { openUrl } from "@tauri-apps/plugin-opener";
import { EditorView } from "@codemirror/view";

import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { liveModeFacet } from "./liveModeFacet";

function resolveWikilinkTargetId(target: string): string | null {
  const notes = useVaultStore.getState().notes;
  const trimmed = target.trim();
  if (!trimmed) return null;
  const exact = notes.find((note) => note.title === trimmed);
  if (exact) return exact.id;
  const lower = trimmed.toLowerCase();
  const ci = notes.find((note) => note.title.toLowerCase() === lower);
  return ci?.id ?? null;
}

export const liveLinkClick = EditorView.domEventHandlers({
  click(event, view) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) {
      return false;
    }
    const wikilink = target.closest("[data-wikilink]");
    const liveMode = view.state.facet(liveModeFacet);
    if (wikilink && (liveMode === "live" || event.metaKey || event.ctrlKey)) {
      const name = wikilink.getAttribute("data-wikilink");
      if (!name) return false;
      const noteId = resolveWikilinkTargetId(name);
      if (!noteId) return false;
      event.preventDefault();
      event.stopPropagation();
      useShellStore.getState().navigate({ kind: "note", id: noteId });
      return true;
    }
    if (!event.metaKey && !event.ctrlKey) {
      return false;
    }
    const node = target.closest("[data-md-href]");
    if (!node) {
      return false;
    }
    const href = node.getAttribute("data-md-href");
    if (!href) {
      return false;
    }
    event.preventDefault();
    void openUrl(href).catch(() => undefined);
    return true;
  },
});
