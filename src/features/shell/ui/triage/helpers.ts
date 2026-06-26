import type React from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SidebarFilter =
  | { kind: "all" }
  | { kind: "starred" }
  | { kind: "inbox" }
  | { kind: "folder"; id: string }
  | { kind: "tag"; tag: string };

/* ------------------------------------------------------------------ */
/*  LocalStorage helpers                                               */
/* ------------------------------------------------------------------ */

const FILTER_STORAGE_KEY = "cork:sidebar-filter";
const FOLDER_ICONS_KEY = "cork:folder-icons";

export function loadFolderIcons(): Record<string, string> {
  try {
    const raw = localStorage.getItem(FOLDER_ICONS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveFolderIcon(folder: string, iconName: string | null) {
  const icons = loadFolderIcons();
  if (iconName) icons[folder] = iconName;
  else delete icons[folder];
  localStorage.setItem(FOLDER_ICONS_KEY, JSON.stringify(icons));
}

const FOLDER_COLORS_KEY = "cork:folder-colors";

export function loadFolderColors(): Record<string, string> {
  try {
    const raw = localStorage.getItem(FOLDER_COLORS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveFolderColor(folder: string, colorKey: string | null) {
  const colors = loadFolderColors();
  if (colorKey) colors[folder] = colorKey;
  else delete colors[folder];
  localStorage.setItem(FOLDER_COLORS_KEY, JSON.stringify(colors));
}

export const FOLDER_COLOR_MAP: Record<string, string> = {
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  green: "#22c55e",
  teal: "#14b8a6",
  blue: "#3b82f6",
  indigo: "#6366f1",
  purple: "#a855f7",
  pink: "#ec4899",
};

export function loadFilter(): SidebarFilter {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SidebarFilter;
      if (parsed && typeof parsed.kind === "string") return parsed;
    }
  } catch {
    /* ignore */
  }
  return { kind: "all" };
}

export function saveFilter(filter: SidebarFilter) {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filter));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/*  UI helpers                                                         */
/* ------------------------------------------------------------------ */

export function clampMenuPosition(
  x: number,
  y: number,
  width: number,
  height: number,
): React.CSSProperties {
  const clampedX = Math.min(x, window.innerWidth - width - 8);
  const clampedY = Math.min(y, window.innerHeight - height - 8);
  return { left: Math.max(8, clampedX), top: Math.max(8, clampedY) };
}

export function formatRelativeDate(mtime: number): string {
  const d = new Date(mtime);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const diffMs = now - mtime;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
