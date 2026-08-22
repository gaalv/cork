import { setTheme } from "@/services/themeRuntime";
import { setDensity } from "@/services/densityRuntime";
import { UI_FONTS, UI_FONT_LABELS } from "@/services/fontRuntime";
import type { AppSettings } from "@/ipc/types";
import { SettingRow, Select } from "./SettingRow";

const UI_FONT_OPTIONS = UI_FONTS.map((f) => ({ value: f, label: UI_FONT_LABELS[f] }));

export function GeneralSection({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <div className="space-y-5">
      <SettingRow label="Theme" description="Choose light, dark, or follow system">
        <select
          value={settings.appearance.theme}
          onChange={(e) => {
            const theme = e.target.value as "light" | "dark" | "system";
            update({ appearance: { ...settings.appearance, theme } });
            setTheme(theme);
          }}
          className="rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-2 py-1 text-[13px]"
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </SettingRow>
      <SettingRow label="Interface font" description="Typeface for menus, lists and panels">
        <Select
          ariaLabel="Interface font"
          value={settings.appearance.uiFont}
          options={UI_FONT_OPTIONS}
          onChange={(uiFont) => update({ appearance: { ...settings.appearance, uiFont } })}
        />
      </SettingRow>
      <SettingRow label="Density" description="Comfortable or compact layout spacing">
        <select
          value={settings.appearance.density}
          onChange={(e) => {
            const density = e.target.value as "comfortable" | "compact";
            update({ appearance: { ...settings.appearance, density } });
            setDensity(density);
          }}
          className="rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-2 py-1 text-[13px]"
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
      </SettingRow>
    </div>
  );
}
