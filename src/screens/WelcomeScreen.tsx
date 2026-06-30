/**
 * Welcome screen — shown on first launch or when no vault is open.
 * Two-panel layout matching the LoginScreen aesthetic, but focused
 * on vault selection/creation instead of OAuth.
 */

import { useEffect, useState } from "react";
import { FolderSimple, FolderOpen, Plus, Clock } from "@phosphor-icons/react";

import { CorkLogo } from "@/components/ui/NoxeLogo";
import { useVaultStore } from "@/stores/vaultStore";
import { client } from "@/ipc/client";
import type { RecentVault } from "@/ipc/types";

export function WelcomeScreen() {
  const openVault = useVaultStore((s) => s.openVault);
  const isLoading = useVaultStore((s) => s.isLoading);
  const [recentVaults, setRecentVaults] = useState<RecentVault[]>([]);

  useEffect(() => {
    client.vault
      .recent()
      .then(setRecentVaults)
      .catch(() => setRecentVaults([]));
  }, []);

  const handleOpenVault = () => {
    void openVault();
  };

  const handleOpenRecent = (path: string) => {
    void openVault(path);
  };

  const availableRecents = recentVaults.filter((v) => !v.missing);

  return (
    <div className="flex h-full">
      {/* Left panel — charcoal brand surface */}
      <div
        className="hidden w-[420px] shrink-0 flex-col justify-between p-10 lg:flex"
        style={{
          background: "var(--surface-charcoal)",
          boxShadow: "var(--edge-highlight)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 items-center justify-center rounded-[10px]"
            style={{
              background: "rgba(255,255,255,0.06)",
              boxShadow: "var(--edge-highlight)",
            }}
          >
            <CorkLogo size={22} variant="mono" className="text-[var(--text-on-dark)]" />
          </div>
          <span
            className="font-display text-[20px] tracking-wide"
            style={{ color: "var(--text-on-dark)" }}
          >
            Cork
          </span>
        </div>

        <div>
          <p
            className="font-display max-w-[300px] text-[28px] leading-snug"
            style={{ color: "var(--text-on-dark)", letterSpacing: "0.2px" }}
          >
            Your notes, your way.
          </p>
          <p className="mt-3 max-w-[280px] text-[14px] leading-relaxed text-[var(--text-on-dark-muted)]">
            A quiet space for your thoughts. Local-first, Markdown-native, built for focus.
          </p>
        </div>

        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-on-dark-subtle)]">
          Local-first notes
        </p>
      </div>

      {/* Right panel — vault actions */}
      <div className="flex flex-1 items-center justify-center bg-[var(--color-cork-bg)] p-8">
        <div className="w-full max-w-[360px]">
          {/* Mobile-only logo */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <CorkLogo size={24} />
            <span className="font-display text-[18px] text-[var(--color-cork-ink)]">Cork</span>
          </div>

          <h1
            className="font-display text-[28px] text-[var(--color-cork-ink)]"
            style={{ letterSpacing: "0.2px" }}
          >
            Welcome to Cork
          </h1>
          <p className="mt-1.5 text-[14px] text-[var(--color-cork-muted)]">
            Open a folder of Markdown files to get started.
          </p>

          <div className="mt-8 space-y-3">
            <button
              onClick={handleOpenVault}
              disabled={isLoading}
              className="flex w-full items-center gap-3 rounded-[10px] bg-[var(--color-cork-primary)] px-4 py-2.5 text-[14px] font-medium text-[var(--color-cork-primary-foreground)] transition-transform hover:opacity-90 active:scale-[var(--press-scale)] disabled:opacity-50"
            >
              <FolderOpen size={18} />
              {isLoading ? "Opening..." : "Open Vault"}
            </button>

            <button
              onClick={handleOpenVault}
              disabled={isLoading}
              className="flex w-full items-center gap-3 rounded-[10px] border border-dashed border-[var(--color-cork-border-strong)] px-4 py-2.5 text-[14px] font-medium text-[var(--color-cork-ink)] transition-colors hover:border-[var(--color-cork-accent)] hover:text-[var(--color-cork-accent)] disabled:opacity-50"
            >
              <Plus size={18} />
              Create New Vault
            </button>
          </div>

          {availableRecents.length > 0 && (
            <>
              <div className="mt-8 flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--color-cork-border)]" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-cork-subtle)]">
                  recent
                </span>
                <div className="h-px flex-1 bg-[var(--color-cork-border)]" />
              </div>

              <div className="mt-4 space-y-1">
                {availableRecents.map((vault) => (
                  <button
                    key={vault.path}
                    onClick={() => handleOpenRecent(vault.path)}
                    disabled={isLoading}
                    className="flex w-full items-center gap-3 rounded-[10px] px-4 py-2.5 text-left text-[13px] text-[var(--color-cork-muted)] transition-colors hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)] disabled:opacity-50"
                  >
                    <FolderSimple size={16} className="shrink-0" />
                    <span className="flex-1 truncate">{vault.name}</span>
                    <Clock size={12} className="shrink-0 text-[var(--color-cork-subtle)]" />
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="mt-6 text-center text-[11px] text-[var(--color-cork-subtle)]">
            Cork works with any folder — no import needed.
          </p>
        </div>
      </div>
    </div>
  );
}
