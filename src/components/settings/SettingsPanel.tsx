/**
 * Settings panel — modal with grouped settings sections.
 *
 * @see F13 — Settings, Search & App Menu spec
 * @see F15 — Theme Switching
 */

import { useEffect, useState } from "react";

import { X } from "@phosphor-icons/react";

import { useSettingsUiStore } from "@/stores/settingsUiStore";
import { useAppSettingsStore } from "@/stores/appSettingsStore";
import { client } from "@/ipc/client";
import type { AppSettings } from "@/ipc/types";
import type { ProvidersAvailable } from "@/ipc/IpcContract";

import { GeneralSection } from "./GeneralSection";
import { EditorSection } from "./EditorSection";
import { FilesSection } from "./FilesSection";
import { MarkdownSection } from "./MarkdownSection";
import { AiSection } from "./AiSection";
import { AdvancedSection } from "./AdvancedSection";
import { GitHubSyncSection } from "@/components/sync/GitHubSyncSection";

import type { SettingsSectionId } from "@/stores/settingsUiStore";

const SECTIONS: { id: SettingsSectionId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "editor", label: "Editor" },
  { id: "files", label: "Files & Vaults" },
  { id: "markdown", label: "Markdown" },
  { id: "ai", label: "AI" },
  { id: "sync", label: "Sync" },
  { id: "advanced", label: "Advanced" },
];

export function SettingsPanel() {
  const open = useSettingsUiStore((s) => s.open);
  const activeSection = useSettingsUiStore((s) => s.section);
  const setActiveSection = useSettingsUiStore((s) => s.setSection);
  const closeSettings = useSettingsUiStore((s) => s.closeSettings);
  const settings = useAppSettingsStore((s) => s.settings);
  const updateSettings = useAppSettingsStore((s) => s.updateSettings);
  const [providers, setProviders] = useState<ProvidersAvailable | null>(null);

  useEffect(() => {
    if (open && activeSection === "ai") {
      setProviders(null);
      client.ai
        .providersAvailable()
        .then(setProviders)
        .catch(() => setProviders(null));
    }
  }, [open, activeSection, settings.ai.provider]);

  if (!open) return null;

  const update = (patch: Partial<AppSettings>) => void updateSettings(patch);

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--color-cork-ink)]/30"
      onClick={() => closeSettings()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[520px] w-[640px] overflow-hidden rounded-2xl border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] shadow-2xl"
      >
        <nav className="flex w-[180px] shrink-0 flex-col border-r border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] p-3">
          <h2 className="mb-3 px-2 text-[14px] font-semibold">Settings</h2>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`rounded-md px-2 py-1.5 text-left text-[13px] ${
                activeSection === s.id
                  ? "bg-[var(--color-cork-accent-soft)] font-medium text-[var(--color-cork-accent)]"
                  : "text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[var(--color-cork-border)] px-5 py-3">
            <h3 className="text-[14px] font-semibold">
              {SECTIONS.find((s) => s.id === activeSection)?.label}
            </h3>
            <button
              onClick={() => closeSettings()}
              className="rounded p-1 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)]"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <SectionContent
              section={activeSection}
              settings={settings}
              update={update}
              providers={providers}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionContent({
  section,
  settings,
  update,
  providers,
}: {
  section: SettingsSectionId;
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  providers: ProvidersAvailable | null;
}) {
  switch (section) {
    case "general":
      return <GeneralSection settings={settings} update={update} />;
    case "editor":
      return <EditorSection settings={settings} update={update} />;
    case "files":
      return <FilesSection settings={settings} update={update} />;
    case "markdown":
      return <MarkdownSection settings={settings} update={update} />;
    case "ai":
      return <AiSection settings={settings} update={update} providers={providers} />;
    case "sync":
      return <GitHubSyncSection />;
    case "advanced":
      return <AdvancedSection settings={settings} update={update} />;
  }
}
