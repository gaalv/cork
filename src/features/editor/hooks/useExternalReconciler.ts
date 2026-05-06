import { useEffect } from "react";

import { useEditorStore } from "@/features/editor/state/editorStore";
import { client } from "@/shared/ipc/client";

export function useExternalReconciler() {
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void Promise.resolve()
      .then(() =>
        client.events.on("vault.fileChanged", async (event) => {
          if (disposed || event.source !== "external") {
            return;
          }
          const { activeNoteId, buffers } = useEditorStore.getState();
          const buffer = activeNoteId ? buffers.get(activeNoteId) : null;
          if (!buffer || buffer.path !== event.path) {
            return;
          }
          if (buffer.dirty) {
            useEditorStore.getState().setConflict(buffer.noteId, { externalMtime: event.mtime });
            return;
          }
          const file = await client.notes.read(buffer.path);
          if (!disposed) {
            useEditorStore.getState().replaceFromDisk(buffer.noteId, file);
          }
        }),
      )
      .then((stop) => {
        unlisten = stop;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
}
