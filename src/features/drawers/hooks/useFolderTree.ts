import { useMemo } from "react";

import { useVaultStore } from "@/features/vault/state/vaultStore";

import type { NoteEntry } from "@/shared/ipc/types";

export type FolderTreeNode = {
  id: string;
  name: string;
  path: string;
  count: number;
  notes: NoteEntry[];
  children: FolderTreeNode[];
};

type MutableFolderTreeNode = FolderTreeNode & {
  childrenByName: Map<string, MutableFolderTreeNode>;
};

export function useFolderTree(): FolderTreeNode[] {
  const notes = useVaultStore((state) => state.notes);
  return useMemo(() => buildFolderTree(notes), [notes]);
}

export function buildFolderTree(notes: NoteEntry[]): FolderTreeNode[] {
  const roots = new Map<string, MutableFolderTreeNode>();

  for (const note of notes) {
    const segments = note.folder.split("/").filter(Boolean);
    if (segments.length === 0) {
      continue;
    }
    let siblings = roots;
    let current: MutableFolderTreeNode | null = null;
    let currentPath = "";

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const existing = siblings.get(segment);
      if (existing) {
        current = existing;
      } else {
        current = createNode(segment, currentPath);
        siblings.set(segment, current);
      }
      current.count += 1;
      siblings = current.childrenByName;
    }

    current?.notes.push(note);
  }

  return sortNodes([...roots.values()].map(finalizeNode));
}

function createNode(name: string, path: string): MutableFolderTreeNode {
  return { id: path, name, path, count: 0, notes: [], children: [], childrenByName: new Map() };
}

function finalizeNode(node: MutableFolderTreeNode): FolderTreeNode {
  return {
    id: node.id,
    name: node.name,
    path: node.path,
    count: node.count,
    notes: [...node.notes].sort(compareNotes),
    children: sortNodes([...node.childrenByName.values()].map(finalizeNode)),
  };
}

function sortNodes(nodes: FolderTreeNode[]): FolderTreeNode[] {
  return nodes.sort((a, b) => a.name.localeCompare(b.name));
}

function compareNotes(a: NoteEntry, b: NoteEntry): number {
  return a.title.localeCompare(b.title);
}
