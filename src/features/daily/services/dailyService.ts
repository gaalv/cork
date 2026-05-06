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

export function dailyTemplateVars(now: Date, vaultPath: string | null): DailyTemplateVars {
  return {
    date: formatDate(now),
    time: formatTime(now),
    weekday: new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(now),
    vault: vaultPath?.split(/[\\/]/).filter(Boolean).at(-1) ?? "Vault",
  };
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
