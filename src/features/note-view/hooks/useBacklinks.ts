import { useCallback, useEffect, useState } from "react";

import { client } from "@/shared/ipc/client";

import type { LinkRow } from "@/shared/ipc/IpcContract";
import type { NoteEntry } from "@/shared/ipc/types";

export type Backlink = LinkRow & {
  source: NoteEntry | null;
};

export function useBacklinks(noteId: string | null) {
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!noteId) {
      setBacklinks([]);
      return;
    }
    setIsLoading(true);
    try {
      const links = await client.links.incoming(noteId);
      const rows = await Promise.all(
        links.map(async (link) => ({ ...link, source: await client.notes.byId(link.srcNoteId) })),
      );
      setBacklinks(rows);
      setError(null);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    void client.events
      .on("vault.fileChanged", () => {
        if (!cancelled) {
          void load();
        }
      })
      .then((nextUnlisten) => {
        if (cancelled) {
          nextUnlisten();
          return;
        }
        unlisten = nextUnlisten;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [load]);

  return { backlinks, isLoading, error, refresh: load };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unable to load backlinks";
}
