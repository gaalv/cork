import { useMemo } from "react";

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

  const inboxCount = useMemo(
    () => notes.filter((note) => !note.folder).length,
    [notes],
  );

  return (
    <section className="rounded-3xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-6 shadow-sm">
      <p className="text-[12px] uppercase tracking-wide text-[var(--color-noxe-muted)]">{dateLabel}</p>
      <div className="mt-2 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-[var(--color-noxe-ink)]">{greeting}</h1>
        {inboxCount > 0 ? (
          <p className="max-w-2xl text-sm text-[var(--color-noxe-muted)]">
            You have <span className="font-medium text-[var(--color-noxe-ink)]">{inboxCount}</span>{" "}
            note{inboxCount === 1 ? "" : "s"} in your Inbox. Take a moment to file them into folders or
            add tags.
          </p>
        ) : (
          <p className="max-w-2xl text-sm text-[var(--color-noxe-muted)]">Your Inbox is tidy. Nice work.</p>
        )}
      </div>
    </section>
  );
}
