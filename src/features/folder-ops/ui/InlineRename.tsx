/**
 * InlineRename — editable text field that replaces a folder name in-place.
 *
 * @see F08 — Folder Management spec
 */

import { useEffect, useRef, useState } from "react";

export function InlineRename({
  initial,
  label,
  validate,
  onCommit,
  onCancel,
  className,
}: {
  initial: string;
  label: string;
  validate?: (name: string) => string | null;
  onCommit: (name: string) => Promise<void>;
  onCancel: () => void;
  className?: string;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const commit = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === initial) {
      onCancel();
      return;
    }
    if (validate) {
      const err = validate(trimmed);
      if (err) {
        setError(err);
        return;
      }
    }
    await onCommit(trimmed);
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        aria-label={label}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={() => void commit()}
        className="w-full rounded-md border border-[var(--color-cork-accent)] bg-[var(--color-cork-panel)] px-2 py-1 text-[13px] outline-none"
      />
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </div>
  );
}
