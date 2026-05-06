import { useEffect } from "react";
import { X } from "@phosphor-icons/react";

import { useAppSettingsStore } from "@/features/settings/state/appSettingsStore";
import { useSettingsUiStore } from "@/features/settings/state/settingsUiStore";
import { SettingRow } from "./SettingRow";

import type { ChangeEvent } from "react";
import type { AppSettings } from "@/features/settings/state/settingsTypes";
import type { SettingsSectionId } from "@/features/settings/state/settingsUiStore";

const sections: Array<{ id: SettingsSectionId; label: string }> = [
  { id: "general", label: "General" },
  { id: "editor", label: "Editor" },
  { id: "files", label: "Files & Vaults" },
  { id: "markdown", label: "Markdown" },
  { id: "daily", label: "Daily Notes" },
  { id: "advanced", label: "Advanced" },
  { id: "about", label: "About" },
];

const controlClass =
  "w-full rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2 text-sm text-[var(--color-noxe-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] disabled:cursor-not-allowed disabled:opacity-60";

export function SettingsPanel() {
  const open = useSettingsUiStore((state) => state.open);
  const activeSection = useSettingsUiStore((state) => state.section);
  const setSection = useSettingsUiStore((state) => state.setSection);
  const closeSettings = useSettingsUiStore((state) => state.closeSettings);
  const settings = useAppSettingsStore((state) => state.settings);
  const updateSettings = useAppSettingsStore((state) => state.updateSettings);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSettings();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeSettings, open]);

  if (!open) {
    return null;
  }

  const title = sections.find((section) => section.id === activeSection)?.label ?? "Settings";
  const patchEditor = (patch: Partial<AppSettings["editor"]>) => {
    void updateSettings({ editor: { ...settings.editor, ...patch } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4" role="presentation" onMouseDown={closeSettings}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="grid h-[min(760px,calc(100vh-2rem))] w-[min(980px,calc(100vw-2rem))] grid-cols-1 overflow-hidden rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] shadow-2xl md:grid-cols-[220px_1fr]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <aside className="border-b border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] p-3 md:border-r md:border-b-0">
          <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-noxe-muted)]">Settings</div>
          <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible" aria-label="Settings sections">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                  section.id === activeSection
                    ? "bg-[var(--color-noxe-panel)] font-semibold text-[var(--color-noxe-ink)] shadow-sm"
                    : "text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel)] hover:text-[var(--color-noxe-ink)]"
                }`}
                onClick={() => setSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </aside>
        <div className="flex min-h-0 flex-col">
          <header className="flex items-center justify-between border-b border-[var(--color-noxe-border)] px-5 py-4">
            <h2 className="text-lg font-semibold text-[var(--color-noxe-ink)]">{title}</h2>
            <button
              type="button"
              aria-label="Close settings"
              className="rounded-md p-1 text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
              onClick={closeSettings}
            >
              <X size={18} />
            </button>
          </header>
          <main className="min-h-0 overflow-y-auto p-5">{renderSection(activeSection, settings, patchEditor)}</main>
        </div>
      </section>
    </div>
  );
}

function renderSection(section: SettingsSectionId, settings: AppSettings, patchEditor: (patch: Partial<AppSettings["editor"]>) => void) {
  if (section === "general") {
    return (
      <div className="space-y-3">
        <SettingRow
          label="Theme"
          description="Noxe ships with the light theme in v1; additional themes are planned."
          scope="app"
          control={
            <select className={controlClass} value={settings.appearance.theme} disabled aria-label="Theme">
              <option value="light">Light</option>
            </select>
          }
        />
        <SettingRow
          label="Language"
          description="Interface language selection is reserved for localization support."
          scope="app"
          control={
            <select className={controlClass} value="en" disabled aria-label="Language">
              <option value="en">English</option>
            </select>
          }
        />
      </div>
    );
  }

  if (section === "editor") {
    return (
      <div className="space-y-3">
        <SettingRow
          label="Line wrap"
          description="Wrap long lines instead of scrolling horizontally."
          scope="app"
          control={<Toggle checked={settings.editor.lineWrap} label="Line wrap" onChange={(checked) => patchEditor({ lineWrap: checked })} />}
        />
        <SettingRow
          label="Show line numbers"
          description="Display a line-number gutter next to the editor."
          scope="app"
          control={<Toggle checked={settings.editor.showLineNumbers} label="Show line numbers" onChange={(checked) => patchEditor({ showLineNumbers: checked })} />}
        />
        <SettingRow
          label="Font family"
          description="Choose the editor font stack."
          scope="app"
          control={
            <select className={controlClass} value={settings.editor.fontFamily} aria-label="Font family" onChange={(event) => patchEditor({ fontFamily: event.currentTarget.value })}>
              <option value="system-ui">System UI</option>
              <option value="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">Monospace</option>
              <option value="Georgia, Cambria, Times New Roman, Times, serif">Serif</option>
            </select>
          }
        />
        <SettingRow
          label="Font size"
          description="Adjust editor text size."
          scope="app"
          control={
            <label className="flex items-center gap-3 text-sm text-[var(--color-noxe-muted)]">
              <input
                className="w-full accent-[var(--color-noxe-accent)]"
                type="range"
                min={12}
                max={22}
                value={settings.editor.fontSize}
                aria-label="Font size"
                onChange={(event) => patchEditor({ fontSize: Number(event.currentTarget.value) })}
              />
              <span className="w-10 text-right">{settings.editor.fontSize}px</span>
            </label>
          }
        />
        <SettingRow
          label="Tab size"
          description="Set how many spaces a tab occupies."
          scope="app"
          control={
            <select className={controlClass} value={settings.editor.tabSize} aria-label="Tab size" onChange={(event) => patchEditor({ tabSize: Number(event.currentTarget.value) })}>
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
              <option value={8}>8 spaces</option>
            </select>
          }
        />
        <SettingRow
          label="Show invisibles"
          description="Reserve a display preference for whitespace markers."
          scope="app"
          control={<Toggle checked={settings.editor.showInvisibles} label="Show invisibles" onChange={(checked) => patchEditor({ showInvisibles: checked })} />}
        />
      </div>
    );
  }

  return <Placeholder title={sections.find((item) => item.id === section)?.label ?? "Settings"} />;
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <input type="checkbox" aria-label={label} checked={checked} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.checked)} />;
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-noxe-border)] p-6 text-sm text-[var(--color-noxe-muted)]">
      {title} settings will appear here.
    </div>
  );
}
