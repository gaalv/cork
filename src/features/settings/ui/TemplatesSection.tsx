import { useMemo, useState } from "react";

import { useSettingsUiStore } from "@/features/settings/state/settingsUiStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { client } from "@/shared/ipc/client";

const TEMPLATES_FOLDER = "Templates";

const STARTER_TEMPLATE_BODY = `---
type: template
---

# {{title}}

Write your template content here. Tokens \`{{date}}\`, \`{{time}}\`, \`{{weekday}}\` and \`{{vault}}\` are supported in the daily flow.
`;

type TemplatesSectionProps = {
  vaultPath: string | null;
};

export function TemplatesSection({ vaultPath }: TemplatesSectionProps) {
  const notes = useVaultStore((state) => state.notes);
  const loadNotes = useVaultStore((state) => state.loadNotes);
  const navigate = useShellStore((state) => state.navigate);
  const closeSettings = useSettingsUiStore((state) => state.closeSettings);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templates = useMemo(
    () =>
      notes
        .filter((note) => note.folder === TEMPLATES_FOLDER || note.folder.startsWith(`${TEMPLATES_FOLDER}/`))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [notes],
  );

  async function createTemplate() {
    const trimmed = name.trim();
    if (!vaultPath) {
      setError("Open a vault first.");
      return;
    }
    if (trimmed.length === 0) {
      setError("Give the template a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await client.notes.create({ folder: TEMPLATES_FOLDER, title: trimmed });
      await client.notes.save({
        path: created.path,
        frontmatter: { type: "template" },
        body: STARTER_TEMPLATE_BODY.replaceAll("{{title}}", trimmed),
      });
      await loadNotes();
      const fresh = useVaultStore.getState().notes.find((entry) => entry.path === created.path);
      if (fresh) {
        navigate({ kind: "note", id: fresh.id });
        closeSettings();
      }
      setName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create template.");
    } finally {
      setBusy(false);
    }
  }

  function openTemplate(id: string) {
    navigate({ kind: "note", id });
    closeSettings();
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h3 className="text-sm font-semibold text-[var(--color-noxe-ink)]">Templates</h3>
        <p className="text-xs text-[var(--color-noxe-muted)]">
          Templates are markdown notes stored in the <code>Templates/</code> folder of your vault. Edit a template like any other note; pick one when creating a new note.
        </p>
      </header>

      <div className="rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] p-3">
        <label htmlFor="new-template-name" className="text-xs font-medium text-[var(--color-noxe-muted)]">
          New template
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="new-template-name"
            type="text"
            placeholder="Meeting Notes"
            value={name}
            disabled={!vaultPath || busy}
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void createTemplate();
              }
            }}
            className="flex-1 rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-3 py-2 text-sm text-[var(--color-noxe-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void createTemplate()}
            disabled={!vaultPath || busy}
            className="rounded-lg bg-[var(--color-noxe-accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
      </div>

      <section aria-label="Existing templates" className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-noxe-muted)]">
          {templates.length} template{templates.length === 1 ? "" : "s"}
        </h4>
        {templates.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--color-noxe-border)] p-4 text-xs text-[var(--color-noxe-muted)]">
            No templates yet. Create one above to get started.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-noxe-border)] rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)]">
            {templates.map((template) => (
              <li key={template.id} className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-[var(--color-noxe-ink)]">{template.title}</p>
                  <p className="truncate text-[11px] text-[var(--color-noxe-muted)]">{template.folder}</p>
                </div>
                <button
                  type="button"
                  onClick={() => openTemplate(template.id)}
                  className="rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-2 py-1 text-xs text-[var(--color-noxe-ink)] hover:border-[var(--color-noxe-border-strong)]"
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
