import builtinDailyTemplate from "../templates/builtinDaily.md?raw";

import { useAppSettingsStore } from "@/features/shell/state/appSettingsStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { client } from "@/shared/ipc/client";

export const DEFAULT_DAILY_PATH_PATTERN = "Daily/YYYY/MM/YYYY-MM-DD.md";

export type DailyTemplateVars = {
  date: string;
  time: string;
  weekday: string;
  vault: string;
};

export function computeDailyPath(now = new Date(), pattern = DEFAULT_DAILY_PATH_PATTERN): string {
  const tokens: Record<string, string> = {
    YYYY: String(now.getFullYear()).padStart(4, "0"),
    YY: String(now.getFullYear()).slice(-2),
    MM: String(now.getMonth() + 1).padStart(2, "0"),
    DD: String(now.getDate()).padStart(2, "0"),
    HH: String(now.getHours()).padStart(2, "0"),
    mm: String(now.getMinutes()).padStart(2, "0"),
  };
  return Object.entries(tokens).reduce((result, [token, value]) => result.replaceAll(token, value), pattern);
}

export function renderTemplate(template: string, vars: DailyTemplateVars): string {
  return template.replace(/\{\{(date|time|weekday|vault)\}\}/g, (_match, key: keyof DailyTemplateVars) => vars[key]);
}

export async function openOrCreateToday(now = new Date(), pattern?: string): Promise<void> {
  const vaultPath = useVaultStore.getState().path;
  const configuredPattern = pattern ?? useAppSettingsStore.getState().dailyPathPattern ?? DEFAULT_DAILY_PATH_PATTERN;
  const relativePath = computeDailyPath(now, configuredPattern);
  const existing = findNoteByRelativePath(relativePath);
  if (existing) {
    useShellStore.getState().navigate({ kind: "note", id: existing.id });
    return;
  }

  const { folder, title } = splitDailyPath(relativePath);
  const rendered = renderTemplate(builtinDailyTemplate, dailyTemplateVars(now, vaultPath));
  const created = await client.notes.create({ folder, title });
  await client.notes.save({ path: created.path, frontmatter: {}, body: rendered });
  await useVaultStore.getState().loadNotes();
  const createdNote = useVaultStore.getState().notes.find((note) => note.path === created.path);
  if (createdNote) {
    useShellStore.getState().navigate({ kind: "note", id: createdNote.id });
  }
}

export function dailyTemplateVars(now: Date, vaultPath: string | null): DailyTemplateVars {
  return {
    date: formatDate(now),
    time: formatTime(now),
    weekday: new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(now),
    vault: vaultPath?.split(/[\\/]/).filter(Boolean).at(-1) ?? "Vault",
  };
}

function findNoteByRelativePath(relativePath: string) {
  const normalized = normalizePath(relativePath);
  return useVaultStore.getState().notes.find((note) => normalizePath(note.path).endsWith(`/${normalized}`));
}

function splitDailyPath(relativePath: string): { folder: string; title: string } {
  const normalized = normalizePath(relativePath);
  const slash = normalized.lastIndexOf("/");
  const folder = slash === -1 ? "" : normalized.slice(0, slash);
  const filename = slash === -1 ? normalized : normalized.slice(slash + 1);
  return { folder, title: filename.replace(/\.md$/i, "") };
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+/, "");
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
