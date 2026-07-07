/**
 * Density runtime — applies the active density to the DOM.
 *
 * Sets `data-density` attribute on `<html>` so CSS custom properties cascade.
 * Persists choice in localStorage so it applies before React mounts.
 */

const DENSITY_KEY = "cork-density";

type Density = "comfortable" | "compact";

function readStored(): Density {
  try {
    const raw = localStorage.getItem(DENSITY_KEY);
    if (raw === "comfortable" || raw === "compact") return raw;
  } catch {
    // localStorage may be unavailable
  }
  return "comfortable";
}

function apply(density: Density) {
  if (density === "comfortable") {
    document.documentElement.removeAttribute("data-density");
  } else {
    document.documentElement.setAttribute("data-density", density);
  }
}

export function setDensity(density: Density) {
  try {
    localStorage.setItem(DENSITY_KEY, density);
  } catch {
    // best-effort
  }
  apply(density);
}

/**
 * Call once at app startup (before React mount) to apply the persisted density.
 */
export function installDensityRuntime() {
  apply(readStored());
}
