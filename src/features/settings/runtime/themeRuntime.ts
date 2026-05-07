import { useSyncExternalStore } from "react";

import { useAppSettingsStore } from "@/features/settings/state/appSettingsStore";

export type ResolvedTheme = "light" | "dark";

const listeners = new Set<() => void>();
let activeResolved: ResolvedTheme = "light";

function getMql(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)");
  } catch {
    return null;
  }
}

function compute(): ResolvedTheme {
  const choice = useAppSettingsStore.getState().settings.appearance.theme;
  if (choice === "light" || choice === "dark") {
    return choice;
  }
  const mql = getMql();
  return mql?.matches ? "dark" : "light";
}

function applyResolved(next: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = next;
}

export function resolveActiveTheme(): ResolvedTheme {
  return activeResolved;
}

export function installThemeRuntime(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const mql = getMql();
  let lastChoice = useAppSettingsStore.getState().settings.appearance.theme;

  const apply = () => {
    const next = compute();
    if (next === activeResolved) return;
    activeResolved = next;
    applyResolved(next);
    for (const fn of listeners) fn();
  };

  // Apply immediately so first paint is correct.
  activeResolved = compute();
  applyResolved(activeResolved);

  const unsubStore = useAppSettingsStore.subscribe((state) => {
    const choice = state.settings.appearance.theme;
    if (choice === lastChoice) return;
    lastChoice = choice;
    apply();
  });

  const onMql = () => apply();
  mql?.addEventListener?.("change", onMql);

  return () => {
    unsubStore();
    mql?.removeEventListener?.("change", onMql);
  };
}

export function cycleTheme(): void {
  const store = useAppSettingsStore.getState();
  const current = store.settings.appearance.theme;
  const next = current === "light" ? "dark" : current === "dark" ? "system" : "light";
  void store.updateSettings({ appearance: { ...store.settings.appearance, theme: next } });
}

function subscribeResolvedTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribeResolvedTheme, resolveActiveTheme, () => "light");
}

export const __test__ = {
  reset() {
    activeResolved = "light";
    listeners.clear();
    if (typeof document !== "undefined") {
      delete document.documentElement.dataset.theme;
    }
  },
};
