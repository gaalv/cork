/**
 * Shell store — manages top-level navigation, drawer state, and palette visibility.
 *
 * @see F13 — Settings, Search & App Menu spec
 * @see F31 — Triage Fidelity spec
 */

import { create } from "zustand";

import type { SidebarFilter } from "@/utils/triageHelpers";

type View = { kind: "home" } | { kind: "note"; id: string } | { kind: "daily" };

type Drawer = null | "search" | "starred" | "tags" | "folders";

export type TemplatePickerMode = "create" | "insert";

type ShellState = {
  view: View;
  drawer: Drawer;
  paletteOpen: boolean;
  helpOpen: boolean;
  generateModalOpen: boolean;
  graphOpen: boolean;
  calendarOpen: boolean;
  // A filter the calendar (or other overlay) asks TriageBody to apply, since
  // the active NotesList filter is TriageBody-local state.
  pendingFilter: SidebarFilter | null;
  templatePickerMode: TemplatePickerMode | null;
  inspectorOpen: boolean;
  sidebarOpen: boolean;
  forceEdit: boolean;
  navigate: (view: View) => void;
  setDrawer: (drawer: Drawer) => void;
  toggleDrawer: (drawer: Drawer) => void;
  setPaletteOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setGenerateModalOpen: (open: boolean) => void;
  setGraphOpen: (open: boolean) => void;
  setCalendarOpen: (open: boolean) => void;
  requestFilter: (filter: SidebarFilter | null) => void;
  setTemplatePickerMode: (mode: TemplatePickerMode | null) => void;
  toggleInspector: () => void;
  toggleSidebar: () => void;
  openNote: (id: string) => void;
  goHome: () => void;
  reset: () => void;
};

export const useShellStore = create<ShellState>((set) => ({
  view: { kind: "home" },
  drawer: null,
  paletteOpen: false,
  helpOpen: false,
  generateModalOpen: false,
  graphOpen: false,
  calendarOpen: false,
  pendingFilter: null,
  templatePickerMode: null,
  inspectorOpen: false,
  sidebarOpen: true,
  forceEdit: false,

  navigate: (view) => set({ view, drawer: null }),

  setDrawer: (drawer) => set({ drawer }),

  toggleDrawer: (d) => set((state) => ({ drawer: state.drawer === d ? null : d })),

  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setGenerateModalOpen: (generateModalOpen) => set({ generateModalOpen }),
  setGraphOpen: (graphOpen) => set({ graphOpen }),
  setCalendarOpen: (calendarOpen) => set({ calendarOpen }),
  requestFilter: (pendingFilter) => set({ pendingFilter }),
  setTemplatePickerMode: (templatePickerMode) => set({ templatePickerMode }),

  toggleInspector: () => set((state) => ({ inspectorOpen: !state.inspectorOpen })),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  openNote: (id) => set({ view: { kind: "note", id }, drawer: null, paletteOpen: false }),

  goHome: () => set({ view: { kind: "home" }, drawer: null }),

  reset: () =>
    set({
      view: { kind: "home" },
      drawer: null,
      paletteOpen: false,
      helpOpen: false,
      generateModalOpen: false,
      graphOpen: false,
      calendarOpen: false,
      pendingFilter: null,
      templatePickerMode: null,
      inspectorOpen: false,
      sidebarOpen: true,
    }),
}));
