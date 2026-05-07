import { useEffect, useMemo, useState } from "react";

import { client } from "@/shared/ipc/client";

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

export function useTagTree() {
  const [tags, setTags] = useState<TagCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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
    void client.events.on("vault:fileChanged", () => void load()).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const tree = useMemo(() => buildTagTree(tags), [tags]);
  return { tree, isLoading, error };
}

export function buildTagTree(tags: TagCount[]): TagTreeNode[] {
  const roots = new Map<string, MutableTagTreeNode>();
  for (const tag of tags) {
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
