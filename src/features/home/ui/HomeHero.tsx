import { useMemo } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";

import { openOrCreateToday } from "@/features/daily/services/dailyService";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { greetingForHour } from "./homeGreeting";

export function HomeHero() {
  const notes = useVaultStore((state) => state.notes);
  const now = new Date();
  const greeting = greetingForHour(now.getHours());

  const dateLabel = useMemo(
    () =>
      now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now.toDateString()],
  );

  const totalCount = notes.length;
  const lastMtime = useMemo(
    () => notes.reduce((max, note) => (note.mtime > max ? note.mtime : max), 0),
    [notes],
  );
  const lastEditLabel = lastMtime > 0 ? lastEditAgo(Date.now() - lastMtime) : null;
  const inboxCount = useMemo(() => notes.filter((note) => !note.folder).length, [notes]);

  return (
    <section className="rounded-3xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[12px] uppercase tracking-wide text-[var(--color-noxe-muted)]">{dateLabel}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--color-noxe-ink)]">{greeting}</h1>
          <p className="mt-1 text-sm text-[var(--color-noxe-muted)]">
            {totalCount} note{totalCount === 1 ? "" : "s"} in your vault
            {lastEditLabel ? ` · last edit ${lastEditLabel}` : ""}
            {inboxCount > 0 ? ` · ${inboxCount} in Inbox` : ""}
          </p>
        </div>
        <button
          type="button"
          data-testid="home-open-today"
          onClick={() => void openOrCreateToday()}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-noxe-ink)] hover:border-[var(--color-noxe-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
        >
          Open today's note <ArrowUpRight size={12} />
        </button>
      </div>
    </section>
  );
}

function lastEditAgo(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
