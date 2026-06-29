import type { AppSettings } from "@/ipc/types";
import { SettingRow, Toggle } from "./SettingRow";

export function MarkdownSection({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <div className="space-y-5">
      <SettingRow label="Callouts" description="Render callout blocks (> [!note])">
        <Toggle
          checked={settings.markdown.callouts}
          onChange={(v) => update({ markdown: { ...settings.markdown, callouts: v } })}
        />
      </SettingRow>
      <SettingRow label="Footnotes" description="Render footnote references">
        <Toggle
          checked={settings.markdown.footnotes}
          onChange={(v) => update({ markdown: { ...settings.markdown, footnotes: v } })}
        />
      </SettingRow>
      <SettingRow label="Highlight" description="Render ==highlight== markers">
        <Toggle
          checked={settings.markdown.highlight}
          onChange={(v) => update({ markdown: { ...settings.markdown, highlight: v } })}
        />
      </SettingRow>
    </div>
  );
}
