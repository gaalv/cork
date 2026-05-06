import { useEffect, useState } from "react";
import { Toaster as SonnerToaster, toast } from "sonner";

import { onIpcError } from "@/shared/ipc/errors";

import type { IpcErrorEvent } from "@/shared/ipc/errors";

export function Toaster() {
  const [errors, setErrors] = useState<IpcErrorEvent[]>([]);

  useEffect(() => {
    return onIpcError((event) => {
      setErrors((current) => [event, ...current].slice(0, 3));
      toast.error(event.message);
    });
  }, []);

  return (
    <>
      <SonnerToaster visibleToasts={3} position="bottom-right" richColors closeButton />
      <div aria-live="polite" className="fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2">
        {errors.map((error) => (
          <div
            key={`${error.topic}:${error.message}`}
            role="status"
            className="rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-3 py-2 text-sm shadow-lg"
          >
            <p className="font-medium text-[var(--color-noxe-ink)]">{error.message}</p>
            <p className="text-[11px] text-[var(--color-noxe-muted)]">{error.topic}</p>
          </div>
        ))}
      </div>
    </>
  );
}
