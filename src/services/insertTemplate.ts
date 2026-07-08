/**
 * Insert a rendered template body at the editor cursor.
 * Template frontmatter is ignored — only the body is inserted.
 *
 * @see F39 — Note Templates (insert flow)
 */

import { toast } from "sonner";

import { getEditorView } from "@/cm/viewRef";
import { client } from "@/ipc/client";
import { useShellStore } from "@/stores/shellStore";
import { useVaultStore } from "@/stores/vaultStore";

export async function insertTemplate(templatePath: string) {
  const view = getEditorView();
  if (!view) {
    toast("Open a note in edit mode to insert a template");
    return;
  }

  const shellView = useShellStore.getState().view;
  const title =
    shellView.kind === "note"
      ? useVaultStore.getState().notes.find((n) => n.id === shellView.id)?.title
      : undefined;

  try {
    const rendered = await client.templates.render(templatePath, title);
    const { from, to } = view.state.selection.main;
    // Caret lands at the template's {{cursor}} position, or after the
    // inserted body when the template has none.
    const anchor = from + (rendered.cursorOffset ?? rendered.body.length);
    view.dispatch({
      changes: { from, to, insert: rendered.body },
      selection: { anchor },
      scrollIntoView: true,
    });
    view.focus();
  } catch (err) {
    toast.error(`Failed to insert template: ${err instanceof Error ? err.message : String(err)}`);
  }
}
