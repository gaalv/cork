import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkle, Spinner, X } from "@phosphor-icons/react";

import { useGenerateNoteStore } from "@/features/ai/state/generateNoteStore";
import { useFolderTree } from "@/features/drawers/hooks/useFolderTree";
import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { useAppSettingsStore } from "@/features/settings/state/appSettingsStore";
import { useSettingsUiStore } from "@/features/settings/state/settingsUiStore";

import type { FolderTreeNode } from "@/features/drawers/hooks/useFolderTree";

function flatten(nodes: FolderTreeNode[], acc: string[] = []): string[] {
  for (const node of nodes) {
    acc.push(node.path);
    if (node.children.length > 0) flatten(node.children, acc);
  }
  return acc;
}

export function GenerateNoteModal() {
  const open = useGenerateNoteStore((s) => s.open);
  if (!open) return null;
  return <GenerateNoteModalInner />;
}

function GenerateNoteModalInner() {
  const status = useGenerateNoteStore((s) => s.status);
  const error = useGenerateNoteStore((s) => s.error);
  const closeModal = useGenerateNoteStore((s) => s.closeModal);
  const generate = useGenerateNoteStore((s) => s.generate);
  const provider = useAppSettingsStore((s) => s.settings.ai?.provider ?? "disabled");
  const openSettings = useSettingsUiStore((s) => s.openSettings);
  const tree = useFolderTree();
  const folderOptions = useMemo(() => ["", ...flatten(tree)].sort(), [tree]);
  const defaultFolder = useDrawersStore.getState().selectedFolder ?? "";

  const [topic, setTopic] = useState("");
  const [folder, setFolder] = useState(defaultFolder);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTopic("");
    setFolder(useDrawersStore.getState().selectedFolder ?? "");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeModal]);

  const disabled = provider === "disabled";

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (disabled || status === "loading") return;
    void generate({ topic, folder });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]"
      onMouseDown={() => (status === "loading" ? null : closeModal())}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Generate note with AI"
        className="w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <header className="flex items-center justify-between border-b border-[var(--color-noxe-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkle size={14} weight="fill" className="text-[var(--color-noxe-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--color-noxe-ink)]">
              Generate note with AI
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => closeModal()}
            disabled={status === "loading"}
            className="rounded-full p-1 text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-hover)] hover:text-[var(--color-noxe-ink)] disabled:opacity-50"
          >
            <X size={14} />
          </button>
        </header>

        <div className="space-y-3 p-4">
          {disabled ? (
            <div className="rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-bg)] p-3 text-xs">
              <p className="text-[var(--color-noxe-ink)]">
                AI provider is disabled. Configure a provider in Settings → AI to use this feature.
              </p>
              <button
                type="button"
                className="mt-2 rounded-md border border-[var(--color-noxe-border)] px-2 py-1 text-xs hover:bg-[var(--color-noxe-hover)]"
                onClick={() => {
                  closeModal();
                  openSettings("ai");
                }}
              >
                Open AI settings
              </button>
            </div>
          ) : (
            <>
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-noxe-muted)]">
                  Topic
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={topic}
                  onChange={(event) => setTopic(event.currentTarget.value)}
                  placeholder="E.g. SQLite WAL mode pros and cons"
                  className="mt-1 w-full rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-bg)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-noxe-border-strong)]"
                  disabled={status === "loading"}
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-noxe-muted)]">
                  Folder
                </span>
                <select
                  value={folder}
                  onChange={(event) => setFolder(event.currentTarget.value)}
                  className="mt-1 w-full rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-bg)] px-2 py-1.5 text-sm outline-none"
                  disabled={status === "loading"}
                >
                  {folderOptions.map((path) => (
                    <option key={path || "/"} value={path}>
                      {path === "" ? "Inbox (root)" : path}
                    </option>
                  ))}
                </select>
              </label>

              {error ? (
                <p className="text-xs text-[var(--color-noxe-danger,#dc2626)]" role="alert">
                  {error}
                </p>
              ) : null}
            </>
          )}
        </div>

        {!disabled ? (
          <footer className="flex items-center justify-end gap-2 border-t border-[var(--color-noxe-border)] px-4 py-3">
            <button
              type="button"
              onClick={() => closeModal()}
              disabled={status === "loading"}
              className="rounded-md border border-[var(--color-noxe-border)] px-3 py-1 text-xs hover:bg-[var(--color-noxe-hover)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status === "loading" || !topic.trim()}
              className="flex items-center gap-1.5 rounded-md border border-[var(--color-noxe-border-strong)] bg-[var(--color-noxe-ink)] px-3 py-1 text-xs text-[var(--color-noxe-bg)] hover:opacity-90 disabled:opacity-50"
            >
              {status === "loading" ? <Spinner size={12} className="animate-spin" /> : <Sparkle size={12} weight="fill" />}
              {status === "loading" ? "Generating…" : "Generate"}
            </button>
          </footer>
        ) : null}
      </form>
    </div>
  );
}
