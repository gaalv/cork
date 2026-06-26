/**
 * Theme runtime — applies the active theme to the DOM before React mounts.
 *
 * Supports three modes: "light", "dark", "system" (resolves via media query).
 * Subscribes to OS-level preference changes when mode is "system".
 * Sets `data-theme` attribute on `<html>` so CSS custom properties cascade.
 *
 * @see F15 — Theme Switching spec
 */

const THEME_KEY = "cork-theme";

type ThemeChoice = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

function getMediaQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || !window.matchMedia) return null;
  return window.matchMedia("(prefers-color-scheme: dark)");
}

function systemPrefersDark(): boolean {
  return getMediaQuery()?.matches ?? false;
}

function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === "light" || choice === "dark") return choice;
  return systemPrefersDark() ? "dark" : "light";
}

function readStoredChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // localStorage may be unavailable in some contexts
  }
  return "system";
}

function apply(theme: ResolvedTheme) {
  document.documentElement.setAttribute("data-theme", theme);
}

/**
 * Returns the currently active resolved theme ("light" | "dark").
 * Useful for non-React consumers like Shiki highlighter.
 */
export function resolveActiveTheme(): ResolvedTheme {
  return resolveTheme(readStoredChoice());
}

/**
 * Persists theme choice and immediately applies it.
 */
export function setTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // best-effort
  }
  apply(resolveTheme(choice));
}

/**
 * Cycles through light → dark → system → light.
 */
export function cycleTheme(): ThemeChoice {
  const current = readStoredChoice();
  const next: ThemeChoice =
    current === "light" ? "dark" : current === "dark" ? "system" : "light";
  setTheme(next);
  return next;
}

/**
 * Call once at app startup (before React mount) to apply the persisted
 * theme and start watching OS preference changes.
 */
export function installThemeRuntime() {
  const choice = readStoredChoice();
  apply(resolveTheme(choice));

  const mq = getMediaQuery();
  if (mq) {
    mq.addEventListener("change", () => {
      const current = readStoredChoice();
      if (current === "system") {
        apply(resolveTheme("system"));
      }
    });
  }
}
