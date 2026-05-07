import { create } from "zustand";

export type NoteMetaPanelSection = "outline" | "backlinks" | "recents" | "ai";
export type EditorLiveMode = "live" | "source";

type NoteViewStore = {
  activeNotePath: string | null;
  panelCollapsed: boolean;
  activeSection: NoteMetaPanelSection;
  scrollPositions: Record<string, number>;
  liveMode: Record<string, EditorLiveMode>;
  setActiveNotePath: (path: string | null) => void;
  setPanelCollapsed: (collapsed: boolean) => void;
  togglePanelCollapsed: () => void;
  setActiveSection: (section: NoteMetaPanelSection) => void;
  saveScrollPosition: (noteId: string, position: number) => void;
  getScrollPosition: (noteId: string) => number;
  getLiveMode: (noteId: string) => EditorLiveMode;
  toggleLiveMode: (noteId: string) => void;
  reset: () => void;
};

const initialState = {
  activeNotePath: null,
  panelCollapsed: false,
  activeSection: "outline" as NoteMetaPanelSection,
  scrollPositions: {},
  liveMode: {} as Record<string, EditorLiveMode>,
};

export const useNoteViewStore = create<NoteViewStore>((set, get) => ({
  ...initialState,

  setActiveNotePath(path) {
    set({ activeNotePath: path });
  },

  setPanelCollapsed(collapsed) {
    set({ panelCollapsed: collapsed });
  },

  togglePanelCollapsed() {
    set((state) => ({ panelCollapsed: !state.panelCollapsed }));
  },

  setActiveSection(section) {
    set({ activeSection: section });
  },

  saveScrollPosition(noteId, position) {
    set((state) => ({ scrollPositions: { ...state.scrollPositions, [noteId]: position } }));
  },

  getScrollPosition(noteId) {
    return get().scrollPositions[noteId] ?? 0;
  },

  getLiveMode(noteId) {
    return get().liveMode[noteId] ?? "live";
  },

  toggleLiveMode(noteId) {
    set((state) => {
      const current = state.liveMode[noteId] ?? "live";
      const next: EditorLiveMode = current === "live" ? "source" : "live";
      return { liveMode: { ...state.liveMode, [noteId]: next } };
    });
  },

  reset() {
    set(initialState);
  },
}));
