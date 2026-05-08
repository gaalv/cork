import { useEffect, useMemo, useState } from "react";

import { client } from "@/shared/ipc/client";
import { useEditorStore } from "@/features/editor/state/editorStore";
import { useVaultSettingsStore } from "@/features/settings/state/vaultSettingsStore";

import type { TagCount } from "@/shared/ipc/IpcContract";

export type TagTreeNode = {
  id: string;
  name: string;
  tag: string;
  count: number;
  children: TagTreeNode[];
};

type MutableTagTreeNode = TagTreeNode & {
  childrenByName: Map<string, MutableTagTreeNode>;
  ownCount: number;
};

function readTagsFromValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

export function useTagTree() {
  const [tags, setTags] = useState<TagCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const libraryTags = useVaultSettingsStore((state) => state.settings.tagLibrary);
  const lastSavedTimestamps = useEditorStore((state) => {
    let max = 0;
    for (const buffer of state.buffers.values()) {
      if (buffer.lastSavedAt && buffer.lastSavedAt > max) max = buffer.lastSavedAt;
    }
    return max;
  });
  const bufferTagsKey = useEditorStore((state) => {
    const set = new Set<string>();
    for (const buffer of state.buffers.values()) {
      for (const tag of readTagsFromValue(buffer.frontmatter.tags)) {
        const normalized = tag.replace(/^#+/, "").trim();
        if (normalized) set.add(normalized);
      }
    }
    return Array.from(set).sort().join("|");
  });
  const bufferTags = useMemo(
    () => (bufferTagsKey ? bufferTagsKey.split("|") : []),
    [bufferTagsKey],
  );

  useEffect(() => {
    let cancelled = false;
    let unlistenChanged: (() => void) | undefined;
    let unlistenIndexed: (() => void) | undefined;

    const load = async () => {
      try {
        setIsLoading(true);
        const nextTags = await client.tags.list();
        if (!cancelled) {
          setTags(nextTags);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load tags");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    void client.events
      .on("vault:fileChanged", () => void load())
      .then((un) => {
        if (cancelled) un();
        else unlistenChanged = un;
      })
      .catch(() => undefined);
    void client.events
      .on("index:updated", () => void load())
      .then((un) => {
        if (cancelled) un();
        else unlistenIndexed = un;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      unlistenChanged?.();
      unlistenIndexed?.();
    };
  }, [lastSavedTimestamps]);

  const tree = useMemo(() => {
    const merged: TagCount[] = [...tags];
    const seen = new Set(tags.map((entry) => entry.tag));
    for (const tag of bufferTags) {
      if (!seen.has(tag)) {
        merged.push({ tag, count: 1 });
        seen.add(tag);
      }
    }
    return buildTagTree(merged, libraryTags ?? []);
  }, [tags, bufferTags, libraryTags]);
  return { tree, isLoading, error };
}

export function buildTagTree(tags: TagCount[], libraryTags: string[] = []): TagTreeNode[] {
  const merged: TagCount[] = [...tags];
  const seen = new Set(tags.map((tag) => tag.tag));
  for (const name of libraryTags) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    merged.push({ tag: name, count: 0 });
  }

  const roots = new Map<string, MutableTagTreeNode>();
  for (const tag of merged) {
    const segments = tag.tag.split("/").filter(Boolean).slice(0, 4);
    let siblings = roots;
    let currentTag = "";
    for (const segment of segments) {
      currentTag = currentTag ? `${currentTag}/${segment}` : segment;
      let node = siblings.get(segment);
      if (!node) {
        node = createNode(segment, currentTag);
        siblings.set(segment, node);
      }
      node.count += tag.count;
      if (currentTag === tag.tag) {
        node.ownCount += tag.count;
      }
      siblings = node.childrenByName;
    }
  }
  return sortNodes([...roots.values()].map(finalizeNode));
}

function createNode(name: string, tag: string): MutableTagTreeNode {
  return { id: tag, name, tag, count: 0, ownCount: 0, children: [], childrenByName: new Map() };
}

function finalizeNode(node: MutableTagTreeNode): TagTreeNode {
  return {
    id: node.id,
    name: node.name,
    tag: node.tag,
    count: node.count,
    children: sortNodes([...node.childrenByName.values()].map(finalizeNode)),
  };
}

function sortNodes(nodes: TagTreeNode[]): TagTreeNode[] {
  return nodes.sort((a, b) => a.name.localeCompare(b.name));
}
