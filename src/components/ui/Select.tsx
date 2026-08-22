import { CaretDown, Check } from "@phosphor-icons/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/utils/cn";

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
  description?: string;
  /** Leading marker — a status dot, a colour swatch — shown in trigger and list. */
  icon?: React.ReactNode;
};

export type SelectProps<T extends string | number> = {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  /**
   * `minimal` drops the border and box, sizes to its content and only shows
   * affordance on hover — for dense rows where a full control would outweigh
   * the values around it. The menu itself is unchanged.
   */
  variant?: "default" | "minimal";
};

type Position = { left: number; top: number; width: number; placement: "below" | "above" };

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  disabled,
  placeholder,
  variant = "default",
}: SelectProps<T>) {
  const minimal = variant === "minimal";
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    Math.max(
      0,
      options.findIndex((option) => option.value === value),
    ),
  );
  const [position, setPosition] = useState<Position | null>(null);
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
      if (!triggerRef.current) {
        return;
      }
      if (
        target &&
        !triggerRef.current.contains(target) &&
        (!listRef.current || !listRef.current.contains(target))
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside, true);
    return () => document.removeEventListener("mousedown", onClickOutside, true);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const next = Math.max(
      0,
      options.findIndex((option) => option.value === value),
    );
    setActiveIndex(next);
  }, [open, options, value]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      return undefined;
    }
    const computePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const estimatedHeight = Math.min(options.length * 36 + 8, 280);
      const spaceBelow = window.innerHeight - rect.bottom;
      const placement: Position["placement"] =
        spaceBelow < estimatedHeight && rect.top > spaceBelow ? "above" : "below";
      const top = placement === "below" ? rect.bottom + 4 : rect.top - estimatedHeight - 4;
      setPosition({ left: rect.left, top, width: rect.width, placement });
    };
    computePosition();
    const recompute = () => computePosition();
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [open, options.length]);

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
    <div className={cn("relative inline-block", minimal ? "w-fit" : "w-full", className)}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        // `group` so the minimal variant can reveal its caret on hover.
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        data-minimal={minimal || undefined}
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
          "group flex items-center gap-1.5 text-left text-[12px] text-[var(--color-cork-ink)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cork-ring)]",
          minimal
            ? "-mx-1 w-fit rounded px-1 py-0 hover:bg-[var(--color-cork-panel-2)]"
            : [
                "w-full justify-between rounded-md border border-[var(--color-cork-border)]",
                "bg-[var(--color-cork-panel)] px-2.5 py-1.5 shadow-sm",
                "hover:border-[var(--color-cork-border-strong)]",
              ],
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {selected?.icon}
          <span className={cn("truncate", !selected && "text-[var(--color-cork-muted)]")}>
            {selected ? selected.label : (placeholder ?? "Select…")}
          </span>
        </span>
        <CaretDown
          size={minimal ? 10 : 12}
          weight="bold"
          className={cn(
            "shrink-0 text-[var(--color-cork-subtle)]",
            minimal && "opacity-0 transition-opacity group-hover:opacity-100",
          )}
        />
      </button>

      {open && position
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              tabIndex={-1}
              style={{
                position: "fixed",
                left: position.left,
                top: position.top,
                minWidth: Math.max(position.width, 140),
                maxHeight: 280,
              }}
              className="z-[60] overflow-y-auto rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] py-1 shadow-lg"
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
                        node.focus({ preventScroll: true });
                      }
                    }}
                    onClick={() => commit(index)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-[12px] text-[var(--color-cork-ink)] outline-none",
                      isActive && "bg-[var(--color-cork-panel-2)]",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {option.icon}
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{option.label}</span>
                        {option.description ? (
                          <span className="truncate text-[11px] text-[var(--color-cork-muted)]">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    {isSelected ? (
                      <Check
                        size={12}
                        weight="bold"
                        className="shrink-0 text-[var(--color-cork-accent)]"
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
