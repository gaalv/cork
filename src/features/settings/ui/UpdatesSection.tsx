import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { ArrowSquareOut } from "@phosphor-icons/react";

import { useAppSettingsStore } from "@/features/settings/state/appSettingsStore";
import { useShellStore } from "@/features/shell/state/shellStore";

import { SettingRow } from "./SettingRow";

export function UpdatesSection() {
  const pushToast = useShellStore((state) => state.pushToast);
  const autoCheck = useAppSettingsStore((state) => state.settings.updates?.autoCheck ?? true);
  const updateSettings = useAppSettingsStore((state) => state.updateSettings);
  const [appVersion, setAppVersion] = useState<string>(__APP_VERSION__);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let active = true;
    void getVersion()
      .then((v) => {
        if (active) setAppVersion(v);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const checkNow = async () => {
    setChecking(true);
    try {
      // F33 scaffolding: the updater plugin is bundled as a dependency but
      // not yet wired into the Tauri builder (requires a signing keypair).
      // Until that lands, "Check now" sends users to the GitHub Releases page.
      const url = "https://github.com/noxe-app/noxe/releases/latest";
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
    } catch (err) {
      pushToast({
        title: "Could not open releases page",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-3">
      <SettingRow
        label="Current version"
        description="Noxe shows the version of the app that's currently running."
        scope="app"
        control={
          <span className="rounded-md bg-[var(--color-noxe-panel-2)] px-2.5 py-1.5 font-mono text-sm text-[var(--color-noxe-ink)]">
            v{appVersion}
          </span>
        }
      />
      <SettingRow
        label="Auto-check for updates"
        description="When enabled, Noxe will silently check for new releases on launch. Updates are never installed without your confirmation."
        scope="app"
        control={
          <input
            type="checkbox"
            aria-label="Auto-check for updates"
            className="accent-[var(--color-noxe-accent)]"
            checked={autoCheck}
            onChange={(event) =>
              void updateSettings({ updates: { autoCheck: event.currentTarget.checked } })
            }
          />
        }
      />
      <SettingRow
        label="Check now"
        description="Opens the Noxe releases page to view the latest available version. Once code signing is configured this will perform an in-app check."
        scope="app"
        control={
          <button
            type="button"
            disabled={checking}
            onClick={() => void checkNow()}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2 text-sm font-medium text-[var(--color-noxe-ink)] hover:border-[var(--color-noxe-border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowSquareOut size={14} />
            {checking ? "Checking…" : "View releases"}
          </button>
        }
      />
      <p className="rounded-lg border border-dashed border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2 text-xs text-[var(--color-noxe-muted)]">
        In-app updates require macOS/Windows code signing and a signed <code>latest.json</code>{" "}
        manifest. See <code>.specs/features/F33-release-config/</code> for the rollout plan.
      </p>
    </div>
  );
}
