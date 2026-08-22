/**
 * Font runtime — applies typography choices to the DOM.
 *
 * Mirrors settings onto `data-ui-font` / `data-editor-font` / `data-code-font`
 * attributes and the `--editor-font-size` / `--editor-line-height` custom
 * properties on `<html>`, so the CSS in index.css and the CodeMirror theme
 * both read a single source of truth. Persisted in localStorage so the choice
 * applies before React mounts (no flash of the wrong face).
 *
 * @see F13 — Settings spec
 */

const STORAGE_KEY = "cork-typography";

export const UI_FONTS = ["system", "inter"] as const;
export const EDITOR_FONTS = ["system", "inter", "serif", "mono"] as const;
export const CODE_FONTS = ["system", "plex"] as const;

export type UiFont = (typeof UI_FONTS)[number];
export type EditorFont = (typeof EDITOR_FONTS)[number];
export type CodeFont = (typeof CODE_FONTS)[number];

export type Typography = {
  uiFont: UiFont;
  editorFont: EditorFont;
  codeFont: CodeFont;
  fontSize: number;
  lineHeight: number;
};

export const DEFAULT_TYPOGRAPHY: Typography = {
  uiFont: "system",
  editorFont: "system",
  codeFont: "system",
  fontSize: 15,
  lineHeight: 1.7,
};

/** Human-readable labels for the settings pickers. */
export const UI_FONT_LABELS: Record<UiFont, string> = {
  system: "System",
  inter: "Inter",
};

export const EDITOR_FONT_LABELS: Record<EditorFont, string> = {
  system: "System",
  inter: "Inter",
  serif: "Georgia (serif)",
  mono: "IBM Plex Mono",
};

export const CODE_FONT_LABELS: Record<CodeFont, string> = {
  system: "System mono",
  plex: "IBM Plex Mono",
};

function coerce<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Narrow an unknown (localStorage / IPC) payload into a complete Typography. */
export function normalizeTypography(raw: unknown): Typography {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    uiFont: coerce(o.uiFont, UI_FONTS, DEFAULT_TYPOGRAPHY.uiFont),
    editorFont: coerce(o.editorFont, EDITOR_FONTS, DEFAULT_TYPOGRAPHY.editorFont),
    codeFont: coerce(o.codeFont, CODE_FONTS, DEFAULT_TYPOGRAPHY.codeFont),
    fontSize: clamp(o.fontSize, 11, 26, DEFAULT_TYPOGRAPHY.fontSize),
    lineHeight: clamp(o.lineHeight, 1.2, 2.4, DEFAULT_TYPOGRAPHY.lineHeight),
  };
}

function readStored(): Typography {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeTypography(JSON.parse(raw) as unknown);
  } catch {
    // localStorage or JSON may be unavailable — fall through to defaults
  }
  return DEFAULT_TYPOGRAPHY;
}

function setAttr(name: string, value: string, isDefault: boolean) {
  const root = document.documentElement;
  if (isDefault) root.removeAttribute(name);
  else root.setAttribute(name, value);
}

function apply(t: Typography) {
  const root = document.documentElement;
  setAttr("data-ui-font", t.uiFont, t.uiFont === "system");
  setAttr("data-editor-font", t.editorFont, t.editorFont === "system");
  setAttr("data-code-font", t.codeFont, t.codeFont === "system");
  root.style.setProperty("--editor-font-size", `${t.fontSize}px`);
  root.style.setProperty("--editor-line-height", String(t.lineHeight));
}

/** Persists the typography choice and applies it immediately. */
export function setTypography(t: Typography) {
  const normalized = normalizeTypography(t);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // best-effort
  }
  apply(normalized);
}

/** Call once at app startup (before React mount) to apply persisted fonts. */
export function installFontRuntime() {
  apply(readStored());
}
