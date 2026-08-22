import { Select as BaseSelect } from "@/components/ui/Select";

export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-[12px] text-[var(--color-cork-muted)]">{description}</div>
      </div>
      {children}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition ${
        checked ? "bg-[var(--color-cork-accent)]" : "bg-[var(--color-cork-border-strong)]"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-[var(--color-cork-primary-foreground)] shadow transition ${
          checked ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}

/**
 * Settings rows delegate to the app's own Select rather than a native one —
 * a native <select> on macOS paints OS chrome (system font, blue focus, its
 * own caret) that ignores the theme entirely.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="w-44">
      <BaseSelect
        ariaLabel={ariaLabel}
        value={value}
        options={options.map((o) => ({ value: o.value, label: o.label }))}
        onChange={onChange}
      />
    </div>
  );
}
