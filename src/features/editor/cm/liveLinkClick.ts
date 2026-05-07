import { openUrl } from "@tauri-apps/plugin-opener";
import { EditorView } from "@codemirror/view";

export const liveLinkClick = EditorView.domEventHandlers({
  click(event) {
    if (!event.metaKey && !event.ctrlKey) {
      return false;
    }
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) {
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
