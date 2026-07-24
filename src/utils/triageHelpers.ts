import type React from "react";

import { client } from "@/ipc/client";
import type { NoteStatus } from "@/ipc/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SidebarFilter =
  | { kind: "all" }
  | { kind: "starred" }
  | { kind: "inbox" }
  | { kind: "archived" }
  | { kind: "folder"; id: string }
  | { kind: "tag"; tag: string }
  | { kind: "status"; status: NoteStatus };

/** Local `YYYY-MM-DD` for a timestamp (ms) or Date — matches the daily-note convention. */
export function localDateKey(value: number | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  const yyyy = String(d.getFullYear()).padStart(4, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ------------------------------------------------------------------ */
/*  Folder icons & colors — persisted in .cork/config.json             */
/* ------------------------------------------------------------------ */

let _folderIcons: Record<string, string> = {};
let _folderColors: Record<string, string> = {};

export async function loadFolderPrefsFromVault(): Promise<{
  icons: Record<string, string>;
  colors: Record<string, string>;
}> {
  try {
    const settings = await client.settings.vaultLoad();
    _folderIcons = settings.folderIcons ?? {};
    _folderColors = settings.folderColors ?? {};
  } catch {
    _folderIcons = {};
    _folderColors = {};
  }
  return { icons: _folderIcons, colors: _folderColors };
}

export function loadFolderIcons(): Record<string, string> {
  return { ..._folderIcons };
}

export function saveFolderIcon(folder: string, iconName: string | null) {
  if (iconName) _folderIcons[folder] = iconName;
  else delete _folderIcons[folder];
  void persistFolderPrefs();
}

export function loadFolderColors(): Record<string, string> {
  return { ..._folderColors };
}

export function saveFolderColor(folder: string, colorKey: string | null) {
  if (colorKey) _folderColors[folder] = colorKey;
  else delete _folderColors[folder];
  void persistFolderPrefs();
}

async function persistFolderPrefs() {
  try {
    const settings = await client.settings.vaultLoad();
    await client.settings.vaultSave({
      ...settings,
      folderIcons: Object.keys(_folderIcons).length > 0 ? _folderIcons : undefined,
      folderColors: Object.keys(_folderColors).length > 0 ? _folderColors : undefined,
    });
  } catch {
    // persist failed — in-memory state still reflects the change
  }
}

const FILTER_STORAGE_KEY = "cork:sidebar-filter";

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
