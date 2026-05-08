import type { ReactNode } from "react";

type SectionHeaderProps = {
  id?: string;
  icon: ReactNode;
  label: string;
  trailing?: ReactNode;
};

export function SectionHeader({ id, icon, label, trailing }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <div className="flex items-center gap-1.5 text-[var(--color-noxe-muted)]">
        <span aria-hidden="true">{icon}</span>
        <h2
          id={id}
          className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-noxe-subtle)]"
        >
          {label}
        </h2>
      </div>
      {trailing ? <div className="text-[var(--color-noxe-muted)]">{trailing}</div> : null}
    </div>
  );
}
