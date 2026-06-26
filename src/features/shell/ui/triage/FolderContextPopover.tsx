import { useEffect, useRef, useState } from "react";
import { Palette, Pencil, Star, Trash } from "@phosphor-icons/react";

import { IconPicker } from "@/shared/ui/IconPicker";

const FOLDER_COLORS = [
  { key: "default", value: "var(--color-cork-muted)" },
  { key: "red", value: "#ef4444" },
  { key: "orange", value: "#f97316" },
  { key: "amber", value: "#f59e0b" },
  { key: "green", value: "#22c55e" },
  { key: "teal", value: "#14b8a6" },
  { key: "blue", value: "#3b82f6" },
  { key: "indigo", value: "#6366f1" },
  { key: "purple", value: "#a855f7" },
  { key: "pink", value: "#ec4899" },
];

export function FolderContextPopover({
  folderId,
  iconName,
  colorKey,
  onChangeIcon,
  onChangeColor,
  onRename,
  onDelete,
  onClose,
}: {
  folderId: string;
  iconName: string | null;
  colorKey: string | null;
  onChangeIcon: (name: string | null) => void;
  onChangeColor: (color: string | null) => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<"menu" | "rename" | "icon" | "color">("menu");
  const [renameValue, setRenameValue] = useState(folderId.split("/").pop() ?? folderId);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (view === "rename") renameRef.current?.focus();
  }, [view]);

  if (view === "icon") {
    return (
      <IconPicker
        value={iconName}
        onChange={(name) => {
          onChangeIcon(name);
          setView("menu");
          onClose();
        }}
        onClose={() => setView("menu")}
      />
    );
  }

  if (view === "color") {
    return (
      <div className="w-48 rounded-lg border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] p-2 shadow-xl">
        <p className="mb-2 text-[11px] text-[var(--color-cork-subtle)]">Icon color</p>
        <div className="grid grid-cols-5 gap-1.5">
          {FOLDER_COLORS.map((c) => (
            <button
              key={c.key}
              onClick={() => {
                onChangeColor(c.key === "default" ? null : c.key);
                setView("menu");
                onClose();
              }}
              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 ${
                (colorKey ?? "default") === c.key
                  ? "border-[var(--color-cork-accent)] scale-110"
                  : "border-transparent"
              }`}
            >
              <span
                className="block h-4 w-4 rounded-full"
                style={{ backgroundColor: c.value }}
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (view === "rename") {
    return (
      <div className="w-48 rounded-lg border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] p-2 shadow-xl">
        <input
          ref={renameRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && renameValue.trim()) onRename(renameValue.trim());
            if (e.key === "Escape") setView("menu");
          }}
          className="w-full rounded border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-2 py-1 text-[12px] outline-none focus:border-[var(--color-cork-accent)]"
        />
        <div className="mt-1.5 flex justify-end gap-1">
          <button
            onClick={() => setView("menu")}
            className="rounded px-2 py-0.5 text-[11px] text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)]"
          >
            Cancel
          </button>
          <button
            onClick={() => { if (renameValue.trim()) onRename(renameValue.trim()); }}
            disabled={!renameValue.trim()}
            className="rounded bg-[var(--color-cork-accent)] px-2 py-0.5 text-[11px] text-white disabled:opacity-40"
          >
            Rename
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-40 rounded-lg border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] py-1 shadow-xl">
      <button
        onClick={() => setView("rename")}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[12px] text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
      >
        <Pencil size={14} className="text-[var(--color-cork-muted)]" />
        Rename
      </button>
      <button
        onClick={() => setView("icon")}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[12px] text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
      >
        <Star size={14} className="text-[var(--color-cork-muted)]" />
        Change icon
      </button>
      <button
        onClick={() => setView("color")}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[12px] text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
      >
        <Palette size={14} className="text-[var(--color-cork-muted)]" />
        Change color
      </button>
      <div className="mx-2 border-t border-[var(--color-cork-border)]" />
      <button
        onClick={onDelete}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[12px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
      >
        <Trash size={14} />
        Delete
      </button>
    </div>
  );
}
