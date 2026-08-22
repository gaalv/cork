/**
 * Reads the resolved theme ("light" | "dark") straight off the DOM.
 *
 * themeRuntime owns `data-theme` on `<html>` and updates it from three
 * sources (explicit choice, OS preference, menu toggle), so observing the
 * attribute is the one place that sees all of them.
 *
 * @see F15 — Theme Switching spec
 */

import { useSyncExternalStore } from "react";

type ResolvedTheme = "light" | "dark";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): ResolvedTheme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function useThemeMode(): ResolvedTheme {
  return useSyncExternalStore(subscribe, getSnapshot, () => "light" as const);
}
