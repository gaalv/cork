import type { AppSettings } from "@/ipc/types";
import { SettingRow, Toggle } from "./SettingRow";

export function AdvancedSection({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <SettingRow label="Auto-check updates" description="Check for new versions on launch">
          <Toggle
            checked={settings.updates?.autoCheck ?? true}
            onChange={(v) => update({ updates: { autoCheck: v } })}
          />
        </SettingRow>
        <p className="text-[12px] leading-relaxed text-[var(--color-cork-subtle)]">
          When on, Cork makes its only network request: a once-a-day check against a public GitHub
          file for a newer version — no account, no identifier, no telemetry. Turn it off to keep
          Cork fully offline. Updating is always a command you run yourself; Cork never replaces
          itself.
        </p>
      </div>
    </div>
  );
}
