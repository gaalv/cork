/**
 * Shared section header used by all inspector sections.
 */

export function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <header className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-cork-muted)]">
      {icon}
      {title}
    </header>
  );
}
