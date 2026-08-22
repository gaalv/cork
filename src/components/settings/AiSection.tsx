import { useEffect, useMemo, useState } from "react";
import { CaretRight, Check, Warning } from "@phosphor-icons/react";

import { client } from "@/ipc/client";
import { Select } from "@/components/ui/Select";
import { SettingRow } from "./SettingRow";
import { ModelField } from "./ModelField";
import { PRESETS, detectPreset, presetValues, type PresetId } from "@/services/aiPresets";
import { cn } from "@/utils/cn";

import type { AppSettings, AiProvider, ProviderModels, TierModels } from "@/ipc/types";
import type { ProvidersAvailable } from "@/ipc/IpcContract";

type ConfigurableProvider = Exclude<AiProvider, "disabled">;

const PROVIDER_OPTIONS = [
  { value: "disabled" as const, label: "Disabled" },
  { value: "claude" as const, label: "Claude" },
  { value: "copilot" as const, label: "GitHub Copilot" },
  { value: "codex" as const, label: "Codex" },
];

const PROVIDER_META: Record<ConfigurableProvider, { binary: string; install: string }> = {
  claude: { binary: "claude", install: "npm install -g @anthropic-ai/claude-code" },
  copilot: { binary: "copilot", install: "Install the GitHub Copilot CLI to use this provider." },
  codex: { binary: "codex", install: "npm install -g @openai/codex" },
};

/**
 * Skills are tagged with a cost tier so frequent, cheap work does not run on
 * an expensive model. Each tier is configurable because which model is cheap
 * changes faster than Cork ships.
 */
const TIERS: { key: keyof TierModels; label: string; description: string }[] = [
  { key: "small", label: "Fast", description: "Tags, keywords, triage — runs often" },
  { key: "standard", label: "Standard", description: "Summaries, rewriting, questions" },
  { key: "premium", label: "Deep", description: "The heaviest reasoning" },
];

export function AiSection({
  settings,
  update,
  providers,
}: {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  providers: ProvidersAvailable | null;
}) {
  const [catalog, setCatalog] = useState<ProviderModels[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const provider = settings.ai.provider;

  useEffect(() => {
    void client.ai
      .modelCatalog()
      .then((c) => setCatalog(c as ProviderModels[]))
      .catch(() => setCatalog([]));
  }, []);

  const providerCatalog = catalog.find((c) => c.provider === provider);
  const models = providerCatalog?.models ?? [];
  const tierModels =
    provider === "disabled" ? null : settings.ai.models[provider as ConfigurableProvider];

  const preset = useMemo(
    () => (tierModels ? detectPreset(tierModels, providerCatalog) : "balanced"),
    [tierModels, providerCatalog],
  );

  const writeTiers = (next: TierModels) => {
    if (provider === "disabled") return;
    update({
      ai: {
        ...settings.ai,
        models: { ...settings.ai.models, [provider]: next },
      },
    });
  };

  const setTier = (tier: keyof TierModels, value: string) => {
    if (!tierModels) return;
    writeTiers({ ...tierModels, [tier]: value });
  };

  return (
    <div className="space-y-5">
      <SettingRow label="Provider" description="CLI used to run AI skills">
        <div className="w-44">
          <Select
            ariaLabel="AI provider"
            value={provider}
            options={PROVIDER_OPTIONS}
            onChange={(next) => update({ ai: { ...settings.ai, provider: next } })}
          />
        </div>
      </SettingRow>

      {provider !== "disabled" && (
        <>
          <ProviderStatus provider={provider} providers={providers} />

          <SettingRow label="Models" description="What Cork should optimise for">
            <div className="w-44">
              <Select
                ariaLabel="Model preference"
                value={preset}
                options={[
                  ...PRESETS.map((p) => ({ value: p.id as PresetId, label: p.label })),
                  ...(preset === "custom"
                    ? [{ value: "custom" as PresetId, label: "Custom" }]
                    : []),
                ]}
                onChange={(next) => {
                  if (next === "custom") return;
                  writeTiers(presetValues(next, providerCatalog));
                }}
              />
            </div>
          </SettingRow>

          <p className="-mt-3 text-[12px] leading-relaxed text-[var(--color-cork-muted)]">
            {preset === "custom"
              ? "Set per task type below."
              : (PRESETS.find((p) => p.id === preset)?.description ?? "")}
          </p>

          <div>
            <button
              onClick={() => setAdvanced((v) => !v)}
              className="flex items-center gap-1 text-[12px] text-[var(--color-cork-muted)] hover:text-[var(--color-cork-ink)]"
            >
              <CaretRight
                size={11}
                weight="bold"
                className={cn("transition-transform", advanced && "rotate-90")}
              />
              Advanced — pick a model per task type
            </button>

            {advanced && (
              <>
                <p className="mt-2 mb-3 text-[12px] leading-relaxed text-[var(--color-cork-muted)]">
                  Leave a field blank to use the CLI&apos;s own default. Cork cannot list what a
                  provider offers — no CLI exposes that — so the suggestions are a starting point
                  and any name is accepted. Use Test to confirm one works.
                </p>
                <div className="flex flex-col gap-3">
                  {TIERS.map((tier) => (
                    <ModelField
                      key={tier.key}
                      label={tier.label}
                      description={tier.description}
                      provider={provider}
                      value={tierModels?.[tier.key] ?? ""}
                      suggestions={models}
                      onChange={(next) => setTier(tier.key, next)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ProviderStatus({
  provider,
  providers,
}: {
  provider: ConfigurableProvider;
  providers: ProvidersAvailable | null;
}) {
  if (!providers) {
    return (
      <div className="rounded-md bg-[var(--color-cork-panel-2)] px-3 py-2 text-[12px] text-[var(--color-cork-muted)]">
        Checking availability…
      </div>
    );
  }

  const meta = PROVIDER_META[provider];
  const available = providers[provider];

  if (available) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-[var(--color-cork-success-tint)] px-3 py-2 text-[12px] text-[var(--color-cork-success)]">
        <Check size={13} weight="bold" />
        <span>
          <span className="font-medium">{meta.binary}</span> found — ready to use.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-md bg-[var(--color-cork-danger-tint)] px-3 py-2 text-[12px] text-[var(--color-cork-danger)]">
      <Warning size={13} weight="bold" className="mt-0.5 shrink-0" />
      <span>
        <span className="font-medium">{meta.binary}</span> not found. {meta.install}
      </span>
    </div>
  );
}
