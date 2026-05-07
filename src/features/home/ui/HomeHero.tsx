import { useMemo } from "react";

import { useVaultStore } from "@/features/vault/state/vaultStore";

import { greetingForHour } from "./homeGreeting";

export function HomeHero() {
  const notes = useVaultStore((state) => state.notes);
  const now = new Date();
  const greeting = greetingForHour(now.getHours());

  const dateLabel = useMemo(
    () =>
      now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now.toDateString()],
  );

  const staleInbox = useMemo(() => {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return notes.filter((note) => !note.folder && note.mtime < startOfToday).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, now.toDateString()]);

  return (
    <section className="rounded-3xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-6 shadow-sm">
      <p className="text-[12px] uppercase tracking-wide text-[var(--color-noxe-muted)]">{dateLabel}</p>
      <div className="mt-2 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-[var(--color-noxe-ink)]">{greeting} 👋</h1>
        {staleInbox > 0 ? (
          <p className="max-w-2xl text-sm text-[var(--color-noxe-muted)]">
            You have <span className="font-medium text-[var(--color-noxe-ink)]">{staleInbox}</span>{" "}
            note{staleInbox === 1 ? "" : "s"} sitting in your Inbox from earlier days. Take a moment to
            file them into folders or add tags.
          </p>
        ) : (
          <p className="max-w-2xl text-sm text-[var(--color-noxe-muted)]">Your Inbox is tidy. Nice work.</p>
        )}
      </div>
    </section>
  );
}
