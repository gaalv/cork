import { create } from "zustand";

export type TriageSelection =
  | { kind: "shortcut"; id: "pinned" | "recent" | "inbox" }
  | { kind: "folder"; path: string }
  | { kind: "tag"; tag: string };

export type TriageStore = {
  selection: TriageSelection;
  setSelection: (selection: TriageSelection) => void;
  reset: () => void;
};

export const DEFAULT_TRIAGE_SELECTION: TriageSelection = { kind: "shortcut", id: "recent" };

export const useTriageStore = create<TriageStore>((set) => ({
  selection: DEFAULT_TRIAGE_SELECTION,
  setSelection: (selection) => set({ selection }),
  reset: () => set({ selection: DEFAULT_TRIAGE_SELECTION }),
}));

export function triageScopeLabel(selection: TriageSelection): string {
  switch (selection.kind) {
    case "shortcut":
      return selection.id === "pinned" ? "Pinned" : selection.id === "inbox" ? "Inbox" : "Recent";
    case "folder":
      return selection.path || "Vault";
    case "tag":
      return `#${selection.tag}`;
  }
}
