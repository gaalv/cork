import { useEffect, useState } from "react";

import { deriveOutline } from "@/features/note-view/worker/outlineWorker";

import type { OutlineItem } from "@/features/note-view/worker/outlineWorker";

export type { OutlineItem };

export function useOutline(markdown: string): OutlineItem[] {
  const [outline, setOutline] = useState<OutlineItem[]>(() => deriveOutline(markdown));

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      const nextOutline = deriveOutline(markdown);
      if (!cancelled) {
        setOutline(nextOutline);
      }
    };
    const timer = window.setTimeout(run, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [markdown]);

  return outline;
}
