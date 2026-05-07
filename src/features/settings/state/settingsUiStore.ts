import { create } from "zustand";

export type SettingsSectionId = "general" | "editor" | "files" | "markdown" | "daily" | "templates" | "ai" | "advanced" | "about";

type SettingsUiStore = {
  open: boolean;
  section: SettingsSectionId;
  openSettings: (section?: SettingsSectionId) => void;
  closeSettings: () => void;
  setSection: (section: SettingsSectionId) => void;
};

export const useSettingsUiStore = create<SettingsUiStore>((set) => ({
  open: false,
  section: "general",
  openSettings: (section = "general") => set({ open: true, section }),
  closeSettings: () => set({ open: false }),
  setSection: (section) => set({ section }),
}));
