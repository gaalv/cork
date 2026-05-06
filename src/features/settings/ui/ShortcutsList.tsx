const shortcutGroups = [
  { title: "Navigation", shortcuts: [["⌘K / Ctrl+K", "Open command palette"], ["⌘[ / Ctrl+BracketLeft", "Back"], ["⌘] / Ctrl+BracketRight", "Forward"]] },
  { title: "Vault", shortcuts: [["⌘O / Ctrl+O", "Open vault"], ["⌘N / Ctrl+N", "New note"], ["⌘D / Ctrl+D", "Open today's daily note"]] },
  { title: "Editor", shortcuts: [["⌘F / Ctrl+F", "Find in note"], ["⌘⇧F / Ctrl+Shift+F", "Find and replace"]] },
  { title: "Shell", shortcuts: [["⌘, / Ctrl+,", "Open settings"], ["⌘\\ / Ctrl+\\", "Toggle drawer"], ["?", "Show shortcuts"]] },
];

export function ShortcutsList() {
  return (
    <div className="space-y-4">
      {shortcutGroups.map((group) => (
        <section key={group.title}>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-noxe-muted)]">{group.title}</h3>
          <dl className="space-y-2">
            {group.shortcuts.map(([keys, label]) => (
              <div key={keys} className="flex items-center justify-between gap-4 rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2 text-sm">
                <dt>{label}</dt>
                <dd className="rounded-md border border-[var(--color-noxe-border)] px-2 py-1 text-[12px] font-medium text-[var(--color-noxe-muted)]">{keys}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
