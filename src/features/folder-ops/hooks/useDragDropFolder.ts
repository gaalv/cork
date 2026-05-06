import { useDraggable, useDroppable } from "@dnd-kit/core";

import type { DragEndEvent } from "@dnd-kit/core";

type DragData =
  | { type: "note"; path: string }
  | { type: "folder"; path: string };

type UseDragDropFolderOptions = {
  onMoveNote: (notePath: string, destFolder: string) => Promise<void> | void;
  onMoveFolder: (srcPath: string, destParent: string) => Promise<void> | void;
};

export function useDragDropFolder({ onMoveNote, onMoveFolder }: UseDragDropFolderOptions) {
  async function onDragEnd(event: DragEndEvent) {
    const active = event.active.data.current as DragData | undefined;
    const over = event.over?.data.current as { folder: string } | undefined;
    if (!active || !over) {
      return;
    }
    if (active.type === "note") {
      await onMoveNote(active.path, over.folder);
      return;
    }
    if (active.path === over.folder || over.folder.startsWith(`${active.path}/`)) {
      return;
    }
    await onMoveFolder(active.path, over.folder);
  }

  return { onDragEnd };
}

export function useNoteDragSource(path: string): ReturnType<typeof useDraggable> {
  return useDraggable({
    id: `note:${path}`,
    data: { type: "note", path } satisfies DragData,
  });
}

export function useFolderDragSource(path: string): ReturnType<typeof useDraggable> {
  return useDraggable({
    id: `folder:${path}`,
    data: { type: "folder", path } satisfies DragData,
  });
}

export function useFolderDropTarget(folder: string): ReturnType<typeof useDroppable> {
  return useDroppable({
    id: `folder-drop:${folder}`,
    data: { folder },
  });
}
