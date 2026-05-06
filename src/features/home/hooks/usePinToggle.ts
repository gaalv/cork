import { useCallback, useState } from "react";

import { togglePin } from "@/features/home/services/pinService";

import type { NoteEntry } from "@/shared/ipc/types";

export function usePinToggle(onChanged?: () => Promise<void> | void) {
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(
    async (note: NoteEntry) => {
      setIsToggling(true);
      try {
        const pinned = await togglePin(note);
        await onChanged?.();
        setError(null);
        return pinned;
      } catch (nextError) {
        const message = errorMessage(nextError);
        setError(message);
        throw nextError;
      } finally {
        setIsToggling(false);
      }
    },
    [onChanged],
  );

  return { togglePin: toggle, isToggling, error };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unable to toggle pin";
}
