import { useEffect, useRef, useState } from "react";

import { useEditorStore } from "@/features/editor/state/editorStore";
import { NOTE_ICONS, resolveNoteIcon } from "@/shared/ui/noteIcons";

type NoteIconPickerProps = {
  noteId: string;
};

export function NoteIconPicker({ noteId }: NoteIconPickerProps) {
  const buffer = useEditorStore((state) => state.buffers.get(noteId) ?? null);
  const updateFrontmatter = useEditorStore((state) => state.updateFrontmatter);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!buffer) {
    return null;
  }

  const currentKey = typeof buffer.frontmatter.icon === "string" ? buffer.frontmatter.icon : "file";
  const Current = resolveNoteIcon(currentKey);

  const select = (key: string | null) => {
    updateFrontmatter(noteId, { icon: key ?? "" });
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Change note icon"
        aria-expanded={open}
        title="Change note icon"
        onClick={() => setOpen((value) => !value)}
        className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
      >
        <Current size={20} weight="duotone" />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Pick an icon"
          className="absolute top-full left-0 z-30 mt-1 w-[296px] rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-medium text-[var(--color-noxe-muted)]">Pick an icon</p>
            <button
              type="button"
              onClick={() => select(null)}
              className="text-[11px] text-[var(--color-noxe-muted)] hover:text-[var(--color-noxe-ink)] underline-offset-2 hover:underline"
            >
              Reset
            </button>
          </div>
          <div className="grid max-h-[280px] grid-cols-8 gap-1 overflow-y-auto pr-1">
            {NOTE_ICONS.map(({ key, label, Icon }) => {
              const active = key === currentKey;
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={label}
                  title={label}
                  onClick={() => select(key)}
                  className={`grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--color-noxe-panel-2)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none ${
                    active ? "bg-[var(--color-noxe-panel-2)] text-[var(--color-noxe-accent)]" : "text-[var(--color-noxe-muted)] hover:text-[var(--color-noxe-ink)]"
                  }`}
                >
                  <Icon size={16} weight={active ? "duotone" : "regular"} />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
