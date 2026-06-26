/**
 * Drag-and-drop hooks for folder tree — wraps @dnd-kit.
 *
 * @see F08 — Folder Management spec
 */

import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";

type DragDropOptions = {
  onMoveNote?: (notePath: string, destFolder: string) => Promise<void>;
  onMoveFolder?: (srcPath: string, destParent: string) => Promise<void>;
};

export function useDragDropFolder(options: DragDropOptions) {
  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current as { type: string; path: string } | undefined;
    const overData = over.data.current as { type: string; path: string } | undefined;
    if (!activeData || !overData) return;

    if (activeData.type === "note" && overData.type === "folder") {
      await options.onMoveNote?.(activeData.path, overData.path);
    } else if (activeData.type === "folder" && overData.type === "folder") {
      await options.onMoveFolder?.(activeData.path, overData.path);
    }
  };

  return { onDragEnd };
}

export function useFolderDragSource(folderPath: string) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `folder:${folderPath}`,
    data: { type: "folder", path: folderPath },
  });
  return { attributes, listeners, setNodeRef, isDragging };
}

export function useFolderDropTarget(folderPath: string) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop:${folderPath}`,
    data: { type: "folder", path: folderPath },
  });
  return { setNodeRef, isOver };
}

export function useNoteDragSource(notePath: string) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `note:${notePath}`,
    data: { type: "note", path: notePath },
  });
  return { attributes, listeners, setNodeRef, isDragging };
}
