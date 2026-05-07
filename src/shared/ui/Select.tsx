import { CaretDown, Check } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/shared/utils/cn";

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
  description?: string;
};

export type SelectProps<T extends string | number> = {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
};

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  disabled,
  placeholder,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(() => Math.max(0, options.findIndex((option) => option.value === value)));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!triggerRef.current || !listRef.current) {
        return;
      }
      if (target && !triggerRef.current.contains(target) && !listRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const next = Math.max(0, options.findIndex((option) => option.value === value));
    setActiveIndex(next);
  }, [open, options, value]);

  function commit(index: number) {
    const option = options[index];
    if (!option) {
      return;
    }
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className={cn("relative inline-block w-full", className)}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (disabled) {
            return;
          }
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-2.5 py-1.5 text-left text-[12px] text-[var(--color-noxe-ink)] shadow-sm",
          "hover:border-[var(--color-noxe-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)]",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span className={cn("truncate", !selected && "text-[var(--color-noxe-muted)]")}>
          {selected ? selected.label : placeholder ?? "Select…"}
        </span>
        <CaretDown size={12} weight="bold" className="shrink-0 text-[var(--color-noxe-muted)]" />
      </button>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          className="absolute left-0 right-0 z-50 mt-1 rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] py-1 shadow-lg"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((prev) => Math.min(options.length - 1, prev + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((prev) => Math.max(0, prev - 1));
            } else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              commit(activeIndex);
            } else if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              triggerRef.current?.focus();
            }
          }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <li
                key={`${option.value}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={isActive ? 0 : -1}
                ref={(node) => {
                  if (isActive && open && node) {
                    node.focus({ preventScroll: false });
                  }
                }}
                onClick={() => commit(index)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-[12px] text-[var(--color-noxe-ink)] outline-none",
                  isActive && "bg-[var(--color-noxe-panel-2)]",
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{option.label}</span>
                  {option.description ? (
                    <span className="truncate text-[11px] text-[var(--color-noxe-muted)]">{option.description}</span>
                  ) : null}
                </span>
                {isSelected ? <Check size={12} weight="bold" className="shrink-0 text-[var(--color-noxe-accent)]" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
