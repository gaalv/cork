import type { AppSettings } from "@/shared/ipc/types";
import type { ProvidersAvailable } from "@/shared/ipc/IpcContract";
import { SettingRow } from "./SettingRow";

export function AiSection({
  settings,
  update,
  providers,
}: {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  providers: ProvidersAvailable | null;
}) {
  return (
    <div className="space-y-5">
      <SettingRow label="Provider" description="CLI used to run AI skills">
        <select
          value={settings.ai.provider}
          onChange={(e) => {
            const provider = e.target.value as "disabled" | "claude" | "copilot";
            update({ ai: { ...settings.ai, provider } });
          }}
          className="rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-2 py-1 text-[13px]"
        >
          <option value="disabled">Disabled</option>
          <option value="claude">Claude</option>
          <option value="copilot">Copilot</option>
        </select>
      </SettingRow>
      {settings.ai.provider !== "disabled" && (
        <ProviderStatus provider={settings.ai.provider} providers={providers} />
      )}
    </div>
  );
}

function ProviderStatus({
  provider,
  providers,
}: {
  provider: "claude" | "copilot";
  providers: ProvidersAvailable | null;
}) {
  if (!providers) {
    return (
      <div className="rounded-md bg-[var(--color-cork-panel-2)] px-3 py-2 text-[12px] text-[var(--color-cork-muted)]">
        Checking availability...
      </div>
    );
  }

  const available = provider === "claude" ? providers.claude : providers.copilot;
  const binaryName = provider === "claude" ? "claude" : "copilot";

  if (available) {
    return (
      <div className="rounded-md bg-green-500/10 px-3 py-2 text-[12px] text-green-600 dark:text-green-400">
        <span className="font-medium">{binaryName}</span> CLI found on PATH — ready to use.
      </div>
    );
  }

  return (
    <div className="rounded-md bg-amber-500/10 px-3 py-2 text-[12px] text-amber-600 dark:text-amber-400">
      <span className="font-medium">{binaryName}</span> CLI not found on PATH.
      {provider === "claude" && " Install it with: npm install -g @anthropic-ai/claude-code"}
      {provider === "copilot" && " Install GitHub Copilot CLI to use this provider."}
    </div>
  );
}
