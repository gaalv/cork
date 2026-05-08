import { create } from "zustand";

export type TriageOverlayKind = "graph" | "calendar" | "todos";

type TriageOverlayState = {
  kind: TriageOverlayKind | null;
  open: (kind: TriageOverlayKind) => void;
  toggle: (kind: TriageOverlayKind) => void;
  close: () => void;
};

export const useTriageOverlayStore = create<TriageOverlayState>((set) => ({
  kind: null,
  open: (kind) => set({ kind }),
  toggle: (kind) => set((state) => ({ kind: state.kind === kind ? null : kind })),
  close: () => set({ kind: null }),
}));
