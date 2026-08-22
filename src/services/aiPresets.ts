/**
 * Model presets, expressed as intent rather than model names.
 *
 * Asking someone to know which model is cheap is asking them to track a moving
 * target. The catalog marks which model each provider considers fast, standard
 * and deep, so the choice can be "quality" or "economy" and Cork resolves it.
 *
 * Presets are only a way to fill the per-tier values — nothing reads a preset
 * at runtime. That keeps one source of truth (the three tier fields) and means
 * a preset can be treated as a starting point and then edited.
 */

import type { ProviderModels, TierModels } from "@/ipc/types";

export type PresetId = "balanced" | "quality" | "economy" | "custom";

export const PRESETS: { id: Exclude<PresetId, "custom">; label: string; description: string }[] = [
  {
    id: "balanced",
    label: "Balanced",
    description: "Cheap models for frequent work, the best one where it matters",
  },
  { id: "quality", label: "Quality", description: "The strongest model everywhere" },
  { id: "economy", label: "Economy", description: "The cheapest model everywhere" },
];

/** The provider's pick for a tier, or "" when the catalog does not say. */
function pick(models: ProviderModels | undefined, hint: string): string {
  return models?.models.find((m) => m.tierHint === hint)?.id ?? "";
}

/**
 * Tier values for a preset.
 *
 * `balanced` deliberately leaves `standard` empty: the CLI's own default is a
 * sensible middle, and hardcoding one here would age. The other presets are
 * explicit because their whole point is to override that judgement.
 */
export function presetValues(preset: PresetId, catalog: ProviderModels | undefined): TierModels {
  const fast = pick(catalog, "fast");
  const deep = pick(catalog, "deep");

  switch (preset) {
    case "quality":
      return { small: deep, standard: deep, premium: deep };
    case "economy":
      return { small: fast, standard: fast, premium: fast };
    case "balanced":
    default:
      return { small: fast, standard: "", premium: deep };
  }
}

/** Which preset the current values correspond to, or "custom". */
export function detectPreset(current: TierModels, catalog: ProviderModels | undefined): PresetId {
  const matches = (candidate: TierModels) =>
    candidate.small === current.small &&
    candidate.standard === current.standard &&
    candidate.premium === current.premium;

  for (const preset of PRESETS) {
    if (matches(presetValues(preset.id, catalog))) return preset.id;
  }
  // An untouched install has every tier empty — that is Balanced in spirit,
  // and calling it "custom" would be misleading.
  if (!current.small && !current.standard && !current.premium) return "balanced";
  return "custom";
}
