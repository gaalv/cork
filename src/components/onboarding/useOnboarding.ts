/**
 * Decides whether the first-run tour should show.
 *
 * Gated on a vault being open: the tour points at folders, notes and the
 * editor, none of which exist on the welcome screen. Completion is stored per
 * tour version, so a future rewrite of the steps can be shown again to
 * existing users without resetting anything else.
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "cork-onboarding";
const TOUR_VERSION = 1;

function completed(): boolean {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) >= TOUR_VERSION;
  } catch {
    return true; // no storage — never nag
  }
}

function markComplete() {
  try {
    localStorage.setItem(STORAGE_KEY, String(TOUR_VERSION));
  } catch {
    // best-effort
  }
}

/** Clears completion so the tour runs again (Settings › General). */
export function replayOnboarding() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort
  }
  window.dispatchEvent(new CustomEvent("cork:replay-tour"));
}

export function useOnboarding(vaultOpen: boolean) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!vaultOpen || completed()) return;
    // One frame so the columns have mounted and can be measured.
    const raf = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(raf);
  }, [vaultOpen]);

  useEffect(() => {
    const replay = () => setActive(true);
    window.addEventListener("cork:replay-tour", replay);
    return () => window.removeEventListener("cork:replay-tour", replay);
  }, []);

  const finish = useCallback(() => {
    markComplete();
    setActive(false);
  }, []);

  return { active, finish };
}
