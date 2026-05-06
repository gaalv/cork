export function AISuggestionCard() {
  return (
    <section aria-labelledby="ai-suggestions-heading" className="rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-4">
      <p className="text-[12px] uppercase tracking-wide text-[var(--color-noxe-muted)]">Coming soon</p>
      <h2 id="ai-suggestions-heading" className="mt-1 font-semibold">
        AI Suggestions
      </h2>
      <p className="mt-2 text-sm text-[var(--color-noxe-muted)]">
        Link ideas and summaries will appear here in a future local-first AI pass.
      </p>
    </section>
  );
}
