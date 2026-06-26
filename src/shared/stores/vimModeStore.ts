/**
 * Tracks the current Vim mode for UI display.
 * Updated by the CodeMirror vim extension via DOM observation.
 */

import { create } from "zustand";

export type VimMode = "NORMAL" | "INSERT" | "VISUAL" | "REPLACE";

type VimModeState = {
  mode: VimMode;
  setMode: (mode: VimMode) => void;
};

export const useVimModeStore = create<VimModeState>((set) => ({
  mode: "NORMAL",
  setMode: (mode) => set({ mode }),
}));
