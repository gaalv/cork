import { useShellStore } from "@/features/shell/state/shellStore";
import { cn } from "@/shared/utils/cn";

import type { LinkRow } from "@/shared/ipc/IpcContract";
import type { ReactNode } from "react";

type WikilinkComponentProps = {
  target: string;
  link?: LinkRow;
  children: ReactNode;
  onUnresolvedClick?: (target: string) => void;
};

export function WikilinkComponent({ target, link, children, onUnresolvedClick }: WikilinkComponentProps) {
  const navigate = useShellStore((state) => state.navigate);
  const resolved = Boolean(link?.targetId);

  return (
    <button
      type="button"
      data-wikilink={target}
      data-target-id={link?.targetId ?? undefined}
      data-ambiguous={link?.ambiguous ? "true" : undefined}
      className={cn(
        "wikilink rounded px-0.5 text-[var(--color-noxe-accent)] underline decoration-dotted underline-offset-4 hover:bg-[var(--color-noxe-accent-soft)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none",
        !resolved && "unresolved text-[var(--color-noxe-muted)] decoration-dashed",
        link?.ambiguous && "ambiguous decoration-wavy",
      )}
      onClick={() => {
        if (link?.targetId) {
          navigate({ kind: "note", id: link.targetId });
          return;
        }
        onUnresolvedClick?.(target);
      }}
    >
      {children}
    </button>
  );
}
