import { setTheme } from "@/services/themeRuntime";
import { setDensity } from "@/services/densityRuntime";
import type { AppSettings } from "@/ipc/types";
import { SettingRow } from "./SettingRow";

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
