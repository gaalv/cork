import { cn } from "@/utils/cn";
import { NOTE_STATUS_META } from "@/utils/noteStatus";
import type { NoteStatus } from "@/ipc/types";

export function StatusBadge({ status, className }: { status: NoteStatus; className?: string }) {
  const meta = NOTE_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
        meta.chipClass,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
      {meta.label}
    </span>
  );
}
