import { useEffect, useMemo, useState } from "react";

import { useVaultStore } from "@/features/vault/state/vaultStore";
import { client } from "@/shared/ipc/client";

import type { NoteEntry } from "@/shared/ipc/types";

const HIDDEN_FOLDERS = new Set(["Templates"]);

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
  const [folders, setFolders] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await client.folders.list();
        if (!cancelled) {
          setFolders(result);
        }
      } catch {
        if (!cancelled) {
          setFolders([]);
        }
      }
    };
    void load();

    let unlistenFn: (() => void) | undefined;
    void client.events.on("vault:folderChanged", () => {
      void load();
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlistenFn = fn;
      }
    });

    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, []);

  return useMemo(() => buildFolderTree(notes, folders), [notes, folders]);
}

export function buildFolderTree(notes: NoteEntry[], extraFolders: string[] = []): FolderTreeNode[] {
  const roots = new Map<string, MutableFolderTreeNode>();

  function ensurePath(folderPath: string): MutableFolderTreeNode | null {
    const segments = folderPath.split("/").filter(Boolean);
    if (segments.length === 0) return null;
    if (HIDDEN_FOLDERS.has(segments[0])) return null;
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
      siblings = current.childrenByName;
    }
    return current;
  }

  for (const folder of extraFolders) {
    ensurePath(folder);
  }

  for (const note of notes) {
    const segments = note.folder.split("/").filter(Boolean);
    if (segments.length === 0) {
      continue;
    }
    if (HIDDEN_FOLDERS.has(segments[0])) {
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
