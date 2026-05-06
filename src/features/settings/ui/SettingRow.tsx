import type { ReactNode } from "react";

export type SettingRowProps = {
  label: string;
  description: string;
  scope: "app" | "vault";
  control: ReactNode;
};

export function SettingRow({ label, description, scope, control }: SettingRowProps) {
  const scopeLabel = scope === "app" ? "App" : "Per-vault";
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-noxe-ink)]">{label}</h3>
          <span className="rounded-full border border-[var(--color-noxe-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-noxe-muted)]">
            {scopeLabel}
          </span>
        </div>
        <p className="text-[12px] leading-5 text-[var(--color-noxe-muted)]">{description}</p>
      </div>
      <div className="shrink-0 sm:min-w-[220px] sm:text-right">{control}</div>
    </div>
  );
}
