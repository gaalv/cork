import { useEffect, useRef, useState } from "react";
import { Check, FolderSimple, Tag, X } from "@phosphor-icons/react";

import { validateFolderName } from "@/services/folderOps";

export function SidebarSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: "var(--density-section-mt)" }}>
      <div className="mb-1 flex items-center justify-between px-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-cork-subtle)]">
          {title}
        </span>
        {action}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

export function SidebarRow({
  icon,
  label,
  badge,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ paddingTop: "var(--density-row-py)", paddingBottom: "var(--density-row-py)" }}
      className={`flex w-full items-center gap-2 rounded-[10px] px-2 text-left ${
        active
          ? "bg-[var(--color-cork-accent-soft)] text-[var(--color-cork-accent)]"
          : "text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
      }`}
    >
      <span
        className={active ? "text-[var(--color-cork-accent)]" : "text-[var(--color-cork-muted)]"}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {badge && (
        <span className="ml-auto rounded-full bg-[var(--color-cork-accent-soft)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--color-cork-accent)]">
          {badge}
        </span>
      )}
    </button>
  );
}

export function InlineNewFolder({
  onConfirm,
  onCancel,
}: {
  onConfirm: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const trimmed = value.trim();
    const err = validateFolderName(trimmed);
    if (err) {
      setError(err);
      return;
    }
    await onConfirm(trimmed);
  };

  return (
    <div className="px-1 py-1">
      <div className="flex items-center gap-1">
        <FolderSimple size={14} className="shrink-0 text-[var(--color-cork-muted)]" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Folder name"
          className="min-w-0 flex-1 rounded border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-2 py-0.5 text-[12px] outline-none placeholder:text-[var(--color-cork-subtle)] focus:border-[var(--color-cork-accent)]"
        />
        <button
          onClick={() => void handleSubmit()}
          disabled={!value.trim()}
          className="rounded p-0.5 text-[var(--color-cork-accent)] hover:bg-[var(--color-cork-accent-soft)] disabled:opacity-40"
        >
          <Check size={14} />
        </button>
        <button
          onClick={onCancel}
          className="rounded p-0.5 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)]"
        >
          <X size={14} />
        </button>
      </div>
      {error && <p className="mt-0.5 px-5 text-[10px] text-red-500">{error}</p>}
    </div>
  );
}

export function InlineNewTag({
  onConfirm,
  onCancel,
}: {
  onConfirm: (tag: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const validate = (tag: string): string | null => {
    if (!tag) return "Tag cannot be empty";
    if (/\s/.test(tag)) return "Tag cannot contain spaces";
    if (tag.length > 100) return "Tag is too long";
    return null;
  };

  const handleSubmit = async () => {
    const trimmed = value.trim().replace(/^#/, "");
    const err = validate(trimmed);
    if (err) {
      setError(err);
      return;
    }
    await onConfirm(trimmed);
  };

  return (
    <div className="px-1 py-1">
      <div className="flex items-center gap-1">
        <Tag size={14} className="shrink-0 text-[var(--color-cork-tag)]" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="tag-name"
          className="min-w-0 flex-1 rounded border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-2 py-0.5 text-[12px] outline-none placeholder:text-[var(--color-cork-subtle)] focus:border-[var(--color-cork-tag)]"
        />
        <button
          onClick={() => void handleSubmit()}
          disabled={!value.trim()}
          className="rounded p-0.5 text-[var(--color-cork-tag)] hover:bg-[var(--color-cork-tag-soft)] disabled:opacity-40"
        >
          <Check size={14} />
        </button>
        <button
          onClick={onCancel}
          className="rounded p-0.5 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)]"
        >
          <X size={14} />
        </button>
      </div>
      {error && <p className="mt-0.5 px-5 text-[10px] text-red-500">{error}</p>}
    </div>
  );
}
