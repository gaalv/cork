/**
 * Settings panel — modal with grouped settings sections.
 *
 * @see F13 — Settings, Search & App Menu spec
 * @see F15 — Theme Switching
 */

import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";

import { useShellStore } from "@/features/shell/state/shellStore";
import { useAppSettingsStore } from "@/features/shell/state/appSettingsStore";
import { client } from "@/shared/ipc/client";
import type { AppSettings } from "@/shared/ipc/types";
import type { ProvidersAvailable } from "@/shared/ipc/IpcContract";

import { GeneralSection } from "./settings/GeneralSection";
import { EditorSection } from "./settings/EditorSection";
import { FilesSection } from "./settings/FilesSection";
import { MarkdownSection } from "./settings/MarkdownSection";
import { AiSection } from "./settings/AiSection";
import { AdvancedSection } from "./settings/AdvancedSection";
import { GitHubSyncSection } from "@/features/sync/ui/GitHubSyncSection";

type Section = "general" | "editor" | "files" | "markdown" | "ai" | "sync" | "advanced";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "general", label: "General" },
  { id: "editor", label: "Editor" },
  { id: "files", label: "Files & Vaults" },
  { id: "markdown", label: "Markdown" },
  { id: "ai", label: "AI" },
  { id: "sync", label: "Sync" },
  { id: "advanced", label: "Advanced" },
];

export function SettingsPanel() {
  const open = useShellStore((s) => s.settingsOpen);
  const close = useShellStore((s) => s.setSettingsOpen);
  const settings = useAppSettingsStore((s) => s.settings);
  const updateSettings = useAppSettingsStore((s) => s.updateSettings);
  const [activeSection, setActiveSection] = useState<Section>("general");
  const [providers, setProviders] = useState<ProvidersAvailable | null>(null);

  useEffect(() => {
    if (open && activeSection === "ai") {
      setProviders(null);
      client.ai.providersAvailable().then(setProviders).catch(() => setProviders(null));
    }
  }, [open, activeSection, settings.ai.provider]);

  if (!open) return null;

  const update = (patch: Partial<AppSettings>) => void updateSettings(patch);

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--color-cork-ink)]/30"
      onClick={() => close(false)}
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
              onClick={() => close(false)}
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
  section: Section;
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
