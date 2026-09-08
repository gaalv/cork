import { client } from "@/ipc/client";
import { useAppSettingsStore } from "@/stores/appSettingsStore";

export async function runAiSkill(skillId: string, variables: Record<string, string>) {
  await useAppSettingsStore.getState().loadAppSettings();
  const ai = useAppSettingsStore.getState().settings.ai;
  return client.ai.runSkill(skillId, variables, ai);
}
