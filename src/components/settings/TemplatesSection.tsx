/**
 * Settings → Templates — per-vault templates folder + template management.
 *
 * @see F39 — Note Templates
 */

import { useEffect, useState } from "react";
import { FileText, Plus } from "@phosphor-icons/react";
import { toast } from "sonner";

import { client } from "@/ipc/client";
import { createTemplateNote, findNoteByPath } from "@/services/createNote";
import { useSettingsUiStore } from "@/stores/settingsUiStore";
import { useShellStore } from "@/stores/shellStore";
import { SettingRow } from "./SettingRow";
import type { TemplateEntry, VaultSettings } from "@/ipc/types";

const DEFAULT_TEMPLATES_FOLDER = "Templates";

export function TemplatesSection() {
  const [vaultSettings, setVaultSettings] = useState<VaultSettings | null>(null);
  const [folderDraft, setFolderDraft] = useState(DEFAULT_TEMPLATES_FOLDER);
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);

  useEffect(() => {
    void client.settings
      .vaultLoad()
      .then((settings) => {
        setVaultSettings(settings);
        setFolderDraft(settings.templatesFolder?.trim() || DEFAULT_TEMPLATES_FOLDER);
      })
      .catch(() => {});
    void client.templates
      .list()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  const commitFolder = async () => {
    if (!vaultSettings) return;
    const folder = folderDraft.trim() || DEFAULT_TEMPLATES_FOLDER;
    setFolderDraft(folder);
    const updated = { ...vaultSettings, templatesFolder: folder };
    setVaultSettings(updated);
    try {
      await client.settings.vaultSave(updated);
      const list = await client.templates.list();
      setTemplates(list);
    } catch {
      toast.error("Failed to save templates folder");
    }
  };

  const openTemplate = (template: TemplateEntry) => {
    const note = findNoteByPath(template.path);
    if (!note) {
      toast("Template not indexed yet — try again in a moment");
      return;
    }
    useShellStore.getState().openNote(note.id);
    useSettingsUiStore.getState().closeSettings();
  };

  const newTemplate = () => {
    useSettingsUiStore.getState().closeSettings();
    void createTemplateNote();
  };

  return (
    <div className="space-y-5">
      <SettingRow
        label="Templates folder"
        description="Vault folder scanned for templates — every .md inside is a template"
      >
        <input
          value={folderDraft}
          onChange={(e) => setFolderDraft(e.target.value)}
          onBlur={() => void commitFolder()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          disabled={!vaultSettings}
          placeholder={DEFAULT_TEMPLATES_FOLDER}
          className="w-[160px] rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] px-2 py-1 text-[13px] text-[var(--color-cork-ink)] outline-none focus:border-[var(--color-cork-accent)] disabled:opacity-50"
          spellCheck={false}
        />
      </SettingRow>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-[13px] font-medium">Templates</div>
            <div className="text-[12px] text-[var(--color-cork-muted)]">
              Click a template to edit it as a regular note
            </div>
          </div>
          <button
            onClick={newTemplate}
            className="flex items-center gap-1.5 rounded-full bg-[var(--color-cork-ink)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
          >
            <Plus size={12} />
            New template
          </button>
        </div>
        {templates.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--color-cork-border)] px-3 py-4 text-center text-[12px] text-[var(--color-cork-subtle)]">
            No templates in &ldquo;{folderDraft}&rdquo; yet.
          </p>
        ) : (
          <div className="flex flex-col rounded-md border border-[var(--color-cork-border)]">
            {templates.map((template) => (
              <button
                key={template.relPath}
                onClick={() => openTemplate(template)}
                className="flex items-center gap-2.5 border-b border-[var(--color-cork-border)] px-3 py-2 text-left text-[13px] last:border-b-0 hover:bg-[var(--color-cork-panel-2)]"
              >
                <FileText size={14} className="text-[var(--color-cork-muted)]" />
                <span className="flex-1 truncate text-[var(--color-cork-ink)]">
                  {template.name}
                </span>
                <span className="truncate text-[11px] text-[var(--color-cork-subtle)]">
                  {template.relPath}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
