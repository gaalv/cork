import {
  CODE_FONTS,
  CODE_FONT_LABELS,
  EDITOR_FONTS,
  EDITOR_FONT_LABELS,
} from "@/services/fontRuntime";
import type { AppSettings } from "@/ipc/types";
import { SettingRow, Select, Toggle } from "./SettingRow";
import { FontSpecimen } from "./FontSpecimen";

const EDITOR_FONT_OPTIONS = EDITOR_FONTS.map((f) => ({ value: f, label: EDITOR_FONT_LABELS[f] }));
const CODE_FONT_OPTIONS = CODE_FONTS.map((f) => ({ value: f, label: CODE_FONT_LABELS[f] }));
const LINE_HEIGHT_OPTIONS = [
  { value: "1.4", label: "Tight (1.4)" },
  { value: "1.55", label: "Snug (1.55)" },
  { value: "1.7", label: "Normal (1.7)" },
  { value: "1.9", label: "Relaxed (1.9)" },
] as const;

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
      <SettingRow
        label="Live preview"
        description="Render markdown inline; the line under the caret shows raw syntax"
      >
        <Toggle
          checked={settings.editor.livePreview}
          onChange={(v) => update({ editor: { ...settings.editor, livePreview: v } })}
        />
      </SettingRow>
      <SettingRow label="Editor font" description="Typeface for the writing surface">
        <Select
          ariaLabel="Editor font"
          value={settings.editor.fontFamily}
          options={EDITOR_FONT_OPTIONS}
          onChange={(fontFamily) => update({ editor: { ...settings.editor, fontFamily } })}
        />
      </SettingRow>
      <SettingRow label="Code font" description="Monospace typeface for code and tables">
        <Select
          ariaLabel="Code font"
          value={settings.editor.codeFont}
          options={CODE_FONT_OPTIONS}
          onChange={(codeFont) => update({ editor: { ...settings.editor, codeFont } })}
        />
      </SettingRow>
      <SettingRow label="Font size" description="Editor font size in pixels">
        <input
          type="number"
          min={11}
          max={26}
          value={settings.editor.fontSize}
          onChange={(e) =>
            update({ editor: { ...settings.editor, fontSize: Number(e.target.value) } })
          }
          className="w-20 rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-2 py-1 text-[13px]"
        />
      </SettingRow>
      <SettingRow label="Line height" description="Vertical breathing room between lines">
        <Select
          ariaLabel="Line height"
          value={String(settings.editor.lineHeight)}
          options={LINE_HEIGHT_OPTIONS}
          onChange={(v) => update({ editor: { ...settings.editor, lineHeight: Number(v) } })}
        />
      </SettingRow>
      <FontSpecimen />
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
      <SettingRow label="Spell check" description="Underline misspelled words as you type">
        <Toggle
          checked={settings.editor.spellCheck}
          onChange={(v) => update({ editor: { ...settings.editor, spellCheck: v } })}
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
