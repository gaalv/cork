import { arch, platform, version as osVersion } from "@tauri-apps/plugin-os";

import { useVaultStore } from "@/features/vault/state/vaultStore";
import { client } from "@/shared/ipc/client";

export function DiagnosticsButton() {
  const vaultPath = useVaultStore((state) => state.path);
  const notes = useVaultStore((state) => state.notes);

  const copyDiagnostics = async () => {
    const indexStatus = await client.index.status().catch(() => null);
    const diagnostics = {
      app: { name: "Noxe", version: __APP_VERSION__ },
      os: { platform: platform(), arch: arch(), version: osVersion() },
      vault: { path: vaultPath, count: vaultPath ? 1 : 0, noteCount: notes.length },
      index: indexStatus,
    };
    await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
  };

  return (
    <button
      type="button"
      className="rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2 text-sm font-medium text-[var(--color-noxe-ink)] hover:border-[var(--color-noxe-border-strong)]"
      onClick={() => void copyDiagnostics()}
    >
      Copy diagnostics
    </button>
  );
}
