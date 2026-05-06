import { useEffect, useRef, useState } from "react";

import { useVaultStore } from "@/features/vault/state/vaultStore";
import { client } from "@/shared/ipc/client";

import type { LinkRow } from "@/shared/ipc/IpcContract";
import type { MutableRefObject, ReactNode } from "react";

type WikilinkHoverCardProps = {
  link: LinkRow;
  children: ReactNode;
  delayMs?: number;
};

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; title: string; body: string }
  | { status: "error" };

export function WikilinkHoverCard({ link, children, delayMs = 350 }: WikilinkHoverCardProps) {
  const note = useVaultStore((state) => state.notes.find((candidate) => candidate.id === link.targetId));
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => clearTimer(timerRef), []);

  function scheduleOpen() {
    clearTimer(timerRef);
    timerRef.current = window.setTimeout(() => {
      setOpen(true);
      if (note && preview.status === "idle") {
        setPreview({ status: "loading" });
        void client.notes
          .read(note.path)
          .then((file) => setPreview({ status: "ready", title: note.title, body: firstChars(file.body, 200) }))
          .catch(() => setPreview({ status: "error" }));
      }
    }, delayMs);
  }

  function close() {
    clearTimer(timerRef);
    setOpen(false);
  }

  return (
    <span className="relative inline-flex" onMouseEnter={scheduleOpen} onFocus={scheduleOpen} onMouseLeave={close} onBlur={close}>
      {children}
      {open && note ? (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-40 mt-2 w-72 rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-3 text-left text-sm shadow-xl"
        >
          <strong className="block text-[var(--color-noxe-ink)]">{note.title}</strong>
          <span className="mt-1 block text-xs text-[var(--color-noxe-muted)]">{tooltipBody(preview)}</span>
        </span>
      ) : null}
    </span>
  );
}

function tooltipBody(preview: PreviewState): string {
  if (preview.status === "ready") {
    return preview.body || "Empty note";
  }
  if (preview.status === "error") {
    return "Unable to load preview";
  }
  return "Loading preview…";
}

function firstChars(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function clearTimer(timerRef: MutableRefObject<number | null>) {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}
