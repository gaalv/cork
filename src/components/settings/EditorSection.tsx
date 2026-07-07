import type { AppSettings } from "@/ipc/types";
import { SettingRow, Toggle } from "./SettingRow";

export function EditorSection({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <div className="space-y-5">
      <SettingRow label="Open in preview" description="Open notes in preview mode by default">
        <Toggle
          checked={settings.editor.previewDefault}
          onChange={(v) => update({ editor: { ...settings.editor, previewDefault: v } })}
        />
      </SettingRow>
      <SettingRow label="Font size" description="Editor font size in pixels">
        <input
          type="number"
          min={10}
          max={24}
          value={settings.editor.fontSize}
          onChange={(e) =>
            update({ editor: { ...settings.editor, fontSize: Number(e.target.value) } })
          }
          className="w-20 rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-2 py-1 text-[13px]"
        />
      </SettingRow>
      <SettingRow label="Tab size" description="Number of spaces per tab">
        <select
          value={settings.editor.tabSize}
          onChange={(e) =>
            update({ editor: { ...settings.editor, tabSize: Number(e.target.value) } })
          }
          className="rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-2 py-1 text-[13px]"
        >
          <option value={2}>2</option>
          <option value={4}>4</option>
        </select>
      </SettingRow>
      <SettingRow label="Line wrap" description="Wrap long lines in the editor">
        <Toggle
          checked={settings.editor.lineWrap}
          onChange={(v) => update({ editor: { ...settings.editor, lineWrap: v } })}
        />
      </SettingRow>
      <SettingRow label="Line numbers" description="Show line numbers in the gutter">
        <Toggle
          checked={settings.editor.showLineNumbers}
          onChange={(v) => update({ editor: { ...settings.editor, showLineNumbers: v } })}
        />
      </SettingRow>
      <SettingRow label="Vim mode" description="Use Vim keybindings in the editor">
        <Toggle
          checked={settings.editor.vimMode}
          onChange={(v) => update({ editor: { ...settings.editor, vimMode: v } })}
        />
      </SettingRow>
      <SettingRow label="Auto-save delay" description="Milliseconds to wait before saving">
        <input
          type="number"
          min={200}
          max={5000}
          step={100}
          value={settings.editor.autoSaveDebounceMs}
          onChange={(e) =>
            update({
              editor: {
                ...settings.editor,
                autoSaveDebounceMs: Number(e.target.value),
              },
            })
          }
          className="w-24 rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-2 py-1 text-[13px]"
        />
      </SettingRow>
    </div>
  );
}
