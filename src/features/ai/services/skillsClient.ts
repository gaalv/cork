import { client } from "@/shared/ipc/client";
import type { AiSkillResult, AiStats, SkillSummary } from "@/shared/ipc/IpcContract";

/** Run a registered skill end-to-end (cache → spawn → telemetry). */
export function runSkill(
  skillId: string,
  variables: Record<string, string>,
): Promise<AiSkillResult> {
  return client.ai.runSkill(skillId, variables);
}

/** Clear cached responses (all or for a single skill). */
export function cacheClear(skillId?: string): Promise<number> {
  return client.ai.cacheClear(skillId);
}

/** Reload skills from disk (bundled defaults + ~/.noxe/skills/). */
export function reload(): Promise<number> {
  return client.ai.skillsReload();
}

/** List all currently loaded skills. */
export function listSkills(): Promise<SkillSummary[]> {
  return client.ai.skillsList();
}

/** Read aggregated telemetry + cache size. */
export function stats(since?: number): Promise<AiStats> {
  return client.ai.stats(since);
}

/** Truncate the telemetry table (does NOT touch the cache). */
export function telemetryClear(): Promise<number> {
  return client.ai.telemetryClear();
}

export type { AiSkillResult, AiStats, SkillSummary };
