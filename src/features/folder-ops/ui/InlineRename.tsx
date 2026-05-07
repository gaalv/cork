import { useEffect, useRef, useState } from "react";

import { cn } from "@/shared/utils/cn";

type InlineRenameProps = {
  initial: string;
  label: string;
  validate?: (value: string) => string | null;
  onCommit: (value: string) => Promise<void> | void;
  onCancel?: () => void;
  className?: string;
  variant?: "boxed" | "ghost";
  placeholder?: string;
};

export function InlineRename({
  initial,
  label,
  validate,
  onCommit,
  onCancel,
  className,
  variant = "boxed",
  placeholder,
}: InlineRenameProps) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  async function commit() {
    const next = value.trim();
    const validationError = validate?.(next) ?? null;
    if (validationError) {
      setError(validationError);
      return;
    }
    if (next === initial) {
      onCancel?.();
      return;
    }
    setIsSaving(true);
    try {
      await onCommit(next);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function cancel() {
    setValue(initial);
    setError(null);
    onCancel?.();
  }

  return (
    <span className="inline-flex min-w-0 flex-col gap-1">
      <input
        ref={inputRef}
        aria-label={label}
        value={value}
        disabled={isSaving}
        placeholder={placeholder}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
        className={cn(
          variant === "boxed"
            ? "min-w-0 rounded-md border border-[var(--color-noxe-border-strong)] bg-[var(--color-noxe-panel)] px-2 py-1 text-[13px] text-[var(--color-noxe-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-accent-soft)]"
            : "min-w-0 border-0 bg-transparent p-0 text-[var(--color-noxe-ink)] outline-none focus:outline-none focus:ring-0 placeholder:text-[var(--color-noxe-muted)]",
          className,
        )}
      />
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "Rename failed";
}
