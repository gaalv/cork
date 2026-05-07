import { useEffect, useState } from "react";
import { getName, getTauriVersion, getVersion } from "@tauri-apps/api/app";
import { arch, platform, version as osVersion } from "@tauri-apps/plugin-os";

import { useVaultStore } from "@/features/vault/state/vaultStore";
import { DiagnosticsButton } from "./DiagnosticsButton";
import { ShortcutsList } from "./ShortcutsList";

type RuntimeInfo = {
  appName: string;
  appVersion: string;
  tauriVersion: string;
  os: string;
};

export function AboutDialog() {
  const vaultPath = useVaultStore((state) => state.path);
  const [runtime, setRuntime] = useState<RuntimeInfo>({
    appName: "Noxe",
    appVersion: __APP_VERSION__,
    tauriVersion: "Unknown",
    os: "Unknown",
  });

  useEffect(() => {
    let active = true;
    void Promise.all([
      getName().catch(() => "Noxe"),
      getVersion().catch(() => __APP_VERSION__),
      getTauriVersion().catch(() => "Unknown"),
    ]).then(([appName, appVersion, tauriVersion]) => {
      if (!active) return;
      let os = "Unknown";
      try {
        os = `${platform()} ${osVersion()} (${arch()})`;
      } catch {
        os = "Unavailable";
      }
      setRuntime({ appName, appVersion, tauriVersion, os });
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] p-4">
        <h3 className="text-base font-semibold">{runtime.appName}</h3>
        <dl className="mt-3 grid gap-2 text-sm text-[var(--color-noxe-muted)] sm:grid-cols-[140px_1fr]">
          <dt>App version</dt>
          <dd>{runtime.appVersion}</dd>
          <dt>Tauri version</dt>
          <dd>{runtime.tauriVersion}</dd>
          <dt>OS</dt>
          <dd>{runtime.os}</dd>
          <dt>Current vault</dt>
          <dd className="break-all">{vaultPath ?? "No vault open"}</dd>
          <dt>Repository</dt>
          <dd>github.com</dd>
          <dt>License</dt>
          <dd>Private local-first notes app</dd>
        </dl>
        <div className="mt-4">
          <DiagnosticsButton />
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-sm font-semibold">Keyboard Shortcuts</h3>
        <ShortcutsList />
      </section>
    </div>
  );
}
