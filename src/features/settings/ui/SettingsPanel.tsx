import { useEffect, useState } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import { X } from "@phosphor-icons/react";

import { useIndexStore } from "@/features/index/state/indexStore";
import { settingsBridge } from "@/features/settings/services/settingsBridge";
import { useAppSettingsStore } from "@/features/settings/state/appSettingsStore";
import { useSettingsUiStore } from "@/features/settings/state/settingsUiStore";
import {
  resolvedVaultSettings,
  useVaultSettingsStore,
} from "@/features/settings/state/vaultSettingsStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { GitHubSyncSection } from "@/features/sync/ui/GitHubSyncSection";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { AboutDialog } from "./AboutDialog";
import { AiUsageSection } from "./AiUsageSection";
import { SettingRow } from "./SettingRow";
import { ShortcutsList } from "./ShortcutsList";
import { TemplatesSection } from "./TemplatesSection";
import { Select } from "@/shared/ui/Select";

import type { ChangeEvent } from "react";
import type {
  AppSettings,
  AppearanceTheme,
  AiProvider,
  LayoutMode,
} from "@/features/settings/state/settingsTypes";
import type { SettingsSectionId } from "@/features/settings/state/settingsUiStore";

const sections: Array<{ id: SettingsSectionId; label: string }> = [
  { id: "general", label: "General" },
  { id: "editor", label: "Editor" },
  { id: "files", label: "Files & Vaults" },
  { id: "markdown", label: "Markdown" },
  { id: "daily", label: "Daily Notes" },
  { id: "templates", label: "Templates" },
  { id: "ai", label: "AI" },
  { id: "sync", label: "Sync" },
  { id: "advanced", label: "Advanced" },
  { id: "shortcuts", label: "Shortcuts" },
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
  const setLayoutMode = useAppSettingsStore((state) => state.setLayoutMode);
  const vaultSettings = useVaultSettingsStore((state) => state.settings);
  const hasVaultSettings = useVaultSettingsStore((state) => state.hasVault);
  const appVaultSettings = useAppSettingsStore((state) => state.vaultSettings);
  const applyVaultSettings = useAppSettingsStore((state) => state.applyVaultSettings);
  const vaultPath = useVaultStore((state) => state.path);
  const pushToast = useShellStore((state) => state.pushToast);
  const rebuildIndex = useIndexStore((state) => state.rebuild);
  const [rebuilding, setRebuilding] = useState(false);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
      role="presentation"
      onMouseDown={closeSettings}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="grid h-[min(760px,calc(100vh-2rem))] w-[min(980px,calc(100vw-2rem))] grid-cols-1 overflow-hidden rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] shadow-2xl md:grid-cols-[220px_1fr]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <aside className="border-b border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] p-3 md:border-r md:border-b-0">
          <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-noxe-muted)]">
            Settings
          </div>
          <nav
            className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible"
            aria-label="Settings sections"
          >
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
          <main className="min-h-0 overflow-y-auto p-5">
            {renderSection(activeSection, {
              settings,
              updateSettings,
              setLayoutMode,
              patchEditor,
              vaultSettings: appVaultSettings ?? vaultSettings,
              hasVaultSettings: hasVaultSettings || appVaultSettings !== null,
              applyVaultSettings,
              vaultPath,
              pushToast,
              rebuildIndex,
              rebuilding,
              setRebuilding,
            })}
          </main>
        </div>
      </section>
    </div>
  );
}

type SectionContext = {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  setLayoutMode: (mode: LayoutMode) => Promise<void>;
  patchEditor: (patch: Partial<AppSettings["editor"]>) => void;
  vaultSettings: Parameters<typeof resolvedVaultSettings>[0];
  hasVaultSettings: boolean;
  applyVaultSettings: (settings: Parameters<typeof resolvedVaultSettings>[0]) => void;
  vaultPath: string | null;
  pushToast: (toast: { title: string; description?: string }) => void;
  rebuildIndex: () => Promise<void>;
  rebuilding: boolean;
  setRebuilding: (rebuilding: boolean) => void;
};

function renderSection(section: SettingsSectionId, context: SectionContext) {
  const {
    settings,
    updateSettings,
    setLayoutMode,
    patchEditor,
    vaultSettings,
    hasVaultSettings,
    applyVaultSettings,
    vaultPath,
    pushToast,
    rebuildIndex,
    rebuilding,
    setRebuilding,
  } = context;
  if (section === "about") {
    return <AboutDialog />;
  }

  if (section === "shortcuts") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-noxe-muted)]">
          Speed up your workflow with these keyboard shortcuts. Press{" "}
          <kbd className="rounded border border-[var(--color-noxe-border)] bg-[var(--color-noxe-kbd)] px-1 text-[10px]">
            ?
          </kbd>{" "}
          anywhere to revisit this list.
        </p>
        <ShortcutsList />
      </div>
    );
  }

  if (section === "general") {
    return (
      <div className="space-y-3">
        <SettingRow
          label="Theme"
          description="Switch between Light and Dark, or follow your OS appearance."
          scope="app"
          control={
            <Select<AppearanceTheme>
              ariaLabel="Theme"
              value={settings.appearance.theme}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              onChange={(next) =>
                void updateSettings({
                  appearance: { ...settings.appearance, theme: next },
                })
              }
            />
          }
        />
        <SettingRow
          label="Language"
          description="Interface language selection is reserved for localization support."
          scope="app"
          control={
            <Select
              ariaLabel="Language"
              value="en"
              disabled
              options={[{ value: "en", label: "English" }]}
              onChange={() => {}}
            />
          }
        />
        <SettingRow
          label="Layout mode"
          description="Focus shows a single editor column. Triage adds a persistent folder tree and notes list (best with a wider window). Toggle anytime with ⌘⇧L."
          scope="app"
          control={
            <Select<LayoutMode>
              ariaLabel="Layout mode"
              value={settings.layout.mode}
              options={[
                { value: "focus", label: "Focus (single editor)" },
                { value: "triage", label: "Triage (sidebar + list + editor)" },
              ]}
              onChange={(next) => void setLayoutMode(next)}
            />
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
          control={
            <Toggle
              checked={settings.editor.lineWrap}
              label="Line wrap"
              onChange={(checked) => patchEditor({ lineWrap: checked })}
            />
          }
        />
        <SettingRow
          label="Font family"
          description="Choose the editor font stack."
          scope="app"
          control={
            <Select
              ariaLabel="Font family"
              value={settings.editor.fontFamily}
              options={[
                { value: "system-ui", label: "System UI" },
                {
                  value: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  label: "Monospace",
                },
                { value: "Georgia, Cambria, Times New Roman, Times, serif", label: "Serif" },
              ]}
              onChange={(next) => patchEditor({ fontFamily: next })}
            />
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
            <Select<number>
              ariaLabel="Tab size"
              value={settings.editor.tabSize}
              options={[
                { value: 2, label: "2 spaces" },
                { value: 4, label: "4 spaces" },
                { value: 8, label: "8 spaces" },
              ]}
              onChange={(next) => patchEditor({ tabSize: next })}
            />
          }
        />
        <SettingRow
          label="Show invisibles"
          description="Reserve a display preference for whitespace markers."
          scope="app"
          control={
            <Toggle
              checked={settings.editor.showInvisibles}
              label="Show invisibles"
              onChange={(checked) => patchEditor({ showInvisibles: checked })}
            />
          }
        />
      </div>
    );
  }

  if (section === "markdown") {
    const patchMarkdown = (patch: Partial<AppSettings["markdown"]>) => {
      void updateSettings({ markdown: { ...settings.markdown, ...patch } });
    };
    return (
      <div className="space-y-3">
        <SettingRow
          label="Callouts"
          description="Render Obsidian-style callout blocks in preview and indexing."
          scope="app"
          control={
            <Toggle
              checked={settings.markdown.callouts}
              label="Callouts"
              onChange={(checked) => patchMarkdown({ callouts: checked })}
            />
          }
        />
        <SettingRow
          label="Footnotes"
          description="Enable Markdown footnote definitions and references."
          scope="app"
          control={
            <Toggle
              checked={settings.markdown.footnotes}
              label="Footnotes"
              onChange={(checked) => patchMarkdown({ footnotes: checked })}
            />
          }
        />
        <SettingRow
          label="Highlights"
          description="Render ==highlight== spans in Markdown preview."
          scope="app"
          control={
            <Toggle
              checked={settings.markdown.highlight}
              label="Highlights"
              onChange={(checked) => patchMarkdown({ highlight: checked })}
            />
          }
        />
      </div>
    );
  }

  if (section === "files") {
    const resolved = resolvedVaultSettings(vaultSettings);
    const revealVault = async () => {
      if (!vaultPath) {
        pushToast({
          title: "No vault open",
          description: "Open a vault before revealing it in the OS.",
        });
        return;
      }
      try {
        await openPath(vaultPath);
      } catch (error) {
        pushToast({
          title: "Could not reveal vault",
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    };

    return (
      <div className="space-y-3">
        <SettingRow
          label="Attachments folder"
          description={
            hasVaultSettings
              ? "Store pasted and dropped files relative to the current vault."
              : "Open a vault to edit this per-vault setting."
          }
          scope="vault"
          control={
            <input
              className={controlClass}
              type="text"
              aria-label="Attachments folder"
              value={resolved.attachmentsFolder}
              disabled={!hasVaultSettings}
              onChange={(event) => {
                const attachmentsFolder = event.currentTarget.value;
                applyVaultSettings({ ...vaultSettings, attachmentsFolder });
                void settingsBridge.set("vault.attachmentsFolder", attachmentsFolder, "vault");
              }}
            />
          }
        />
        <SettingRow
          label="Recent vault limit"
          description="Choose how many recent vaults Noxe keeps in the switcher."
          scope="app"
          control={
            <input
              className={controlClass}
              type="number"
              min={1}
              max={20}
              aria-label="Recent vault limit"
              value={settings.vault.recentLimit}
              onChange={(event) => {
                void updateSettings({ vault: { recentLimit: Number(event.currentTarget.value) } });
              }}
            />
          }
        />
        <SettingRow
          label="Reveal vault in OS"
          description="Open the current vault folder in Finder or your platform file manager."
          scope="vault"
          control={
            <button
              type="button"
              className="w-full rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2 text-sm font-medium text-[var(--color-noxe-ink)] hover:border-[var(--color-noxe-border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!vaultPath}
              onClick={() => void revealVault()}
            >
              Reveal vault
            </button>
          }
        />
        <SettingRow
          label="Enable local version history"
          description={
            hasVaultSettings
              ? "Auto-commit note saves to a local git repository inside the vault."
              : "Open a vault to edit this per-vault setting."
          }
          scope="vault"
          control={
            <input
              type="checkbox"
              aria-label="Enable local version history"
              className="accent-[var(--color-noxe-accent)]"
              checked={resolved.gitAutoCommit}
              disabled={!hasVaultSettings}
              onChange={(event) => {
                void settingsBridge.set("vcs.gitAutoCommit", event.currentTarget.checked, "vault");
              }}
            />
          }
        />
      </div>
    );
  }

  if (section === "sync") {
    return (
      <div className="space-y-3">
        <GitHubSyncSection />
      </div>
    );
  }

  if (section === "advanced") {
    const resolved = resolvedVaultSettings(vaultSettings);
    const runRebuild = async () => {
      setRebuilding(true);
      try {
        await rebuildIndex();
        pushToast({
          title: "Index rebuild started",
          description: "Noxe is rebuilding the current vault index.",
        });
      } catch (error) {
        pushToast({
          title: "Index rebuild failed",
          description: error instanceof Error ? error.message : "Unknown error",
        });
        console.error(error);
      } finally {
        setRebuilding(false);
      }
    };
    const setOfflineMode = (offlineMode: boolean) => {
      applyVaultSettings({ ...vaultSettings, offlineMode });
      void settingsBridge.set("assets.offlineMode", offlineMode, "vault");
    };

    return (
      <div className="space-y-3">
        <SettingRow
          label="Rebuild Index"
          description="Re-scan the current vault and refresh search, backlinks, tags, and recents."
          scope="vault"
          control={
            <button
              type="button"
              className="w-full rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2 text-sm font-medium text-[var(--color-noxe-ink)] hover:border-[var(--color-noxe-border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={rebuilding || !vaultPath}
              onClick={() => void runRebuild()}
            >
              {rebuilding ? "Rebuilding…" : "Rebuild Index"}
            </button>
          }
        />
        <SettingRow
          label="Offline mode"
          description={
            hasVaultSettings
              ? "Prefer locally cached assets for this vault."
              : "Open a vault to edit this per-vault setting."
          }
          scope="vault"
          control={
            <Toggle
              checked={resolved.offlineMode}
              label="Offline mode"
              onChange={setOfflineMode}
              disabled={!hasVaultSettings}
            />
          }
        />
      </div>
    );
  }

  if (section === "daily") {
    const resolved = resolvedVaultSettings(vaultSettings);
    const setDailySetting = (patch: { dailyPathPattern?: string; dailyTemplatePath?: string }) => {
      applyVaultSettings({ ...vaultSettings, ...patch });
      const [key, value] =
        patch.dailyPathPattern !== undefined
          ? ["daily.pathPattern", patch.dailyPathPattern]
          : ["daily.templatePath", patch.dailyTemplatePath ?? ""];
      void settingsBridge.set(key as "daily.pathPattern" | "daily.templatePath", value, "vault");
    };

    return (
      <div className="space-y-3">
        <SettingRow
          label="Daily note path pattern"
          description={
            hasVaultSettings
              ? "Use date tokens such as YYYY, MM, DD to place daily notes."
              : "Open a vault to edit this per-vault setting."
          }
          scope="vault"
          control={
            <input
              className={controlClass}
              type="text"
              aria-label="Daily note path pattern"
              value={resolved.dailyPathPattern}
              disabled={!hasVaultSettings}
              placeholder="Journal/YYYY-MM-DD.md"
              onChange={(event) => setDailySetting({ dailyPathPattern: event.currentTarget.value })}
            />
          }
        />
        <SettingRow
          label="Daily note template"
          description={
            hasVaultSettings
              ? "Optional vault-relative template used when creating a daily note."
              : "Open a vault to edit this per-vault setting."
          }
          scope="vault"
          control={
            <input
              className={controlClass}
              type="text"
              aria-label="Daily note template"
              value={resolved.dailyTemplatePath}
              disabled={!hasVaultSettings}
              placeholder="Templates/Daily.md"
              onChange={(event) =>
                setDailySetting({ dailyTemplatePath: event.currentTarget.value })
              }
            />
          }
        />
      </div>
    );
  }

  if (section === "templates") {
    return <TemplatesSection vaultPath={vaultPath} />;
  }

  if (section === "ai") {
    return (
      <div className="space-y-3">
        <SettingRow
          label="AI Provider"
          description="Choose the CLI assistant Noxe will use for AI features. Requires the binary to be installed and available on PATH."
          scope="app"
          control={
            <Select<AiProvider>
              ariaLabel="AI Provider"
              value={settings.ai?.provider ?? "disabled"}
              options={[
                { value: "disabled", label: "Disabled" },
                { value: "claude", label: "Claude (claude CLI)" },
                { value: "copilot", label: "Copilot (copilot CLI)" },
              ]}
              onChange={(next) => void updateSettings({ ai: { ...settings.ai, provider: next } })}
            />
          }
        />
        <AiUsageSection />
      </div>
    );
  }

  return <Placeholder title={sections.find((item) => item.id === section)?.label ?? "Settings"} />;
}

function Toggle({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.checked)}
    />
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-noxe-border)] p-6 text-sm text-[var(--color-noxe-muted)]">
      {title} settings will appear here.
    </div>
  );
}
