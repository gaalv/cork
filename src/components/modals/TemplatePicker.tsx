/**
 * Template picker — filterable modal listing every note in the templates
 * folder. `create` mode starts a new note from the picked template;
 * `insert` mode inserts the rendered body at the editor cursor.
 *
 * @see F39 — Note Templates
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileDashed, FileText, MagnifyingGlass, Plus } from "@phosphor-icons/react";

import { client } from "@/ipc/client";
import { createTemplateNote } from "@/services/createNote";
import { useShellStore } from "@/stores/shellStore";
import type { TemplateEntry } from "@/ipc/types";
import type { TemplatePickerMode } from "@/stores/shellStore";

export function TemplatePicker() {
  const mode = useShellStore((s) => s.templatePickerMode);
  const setMode = useShellStore((s) => s.setTemplatePickerMode);

  const [templates, setTemplates] = useState<TemplateEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = mode !== null;

  // Reload the list every time the picker opens (folder setting may change)
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIndex(0);
    setTemplates(null);
    client.templates
      .list()
      .then(setTemplates)
      .catch(() => setTemplates([]));
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const matches = useMemo(() => {
    if (!templates) return [];
    if (!query) return templates;
    const q = query.toLowerCase();
    return templates.filter(
      (t) => t.name.toLowerCase().includes(q) || t.relPath.toLowerCase().includes(q),
    );
  }, [templates, query]);

  const close = useCallback(() => setMode(null), [setMode]);

  const handlePick = useCallback(
    (template: TemplateEntry, pickMode: TemplatePickerMode) => {
      close();
      pickTemplate(template, pickMode);
    },
    [close],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      } else if (e.key === "ArrowDown" && matches.length > 0) {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % matches.length);
      } else if (e.key === "ArrowUp" && matches.length > 0) {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + matches.length) % matches.length);
      } else if (e.key === "Enter" && mode && matches[selectedIndex]) {
        e.preventDefault();
        handlePick(matches[selectedIndex], mode);
      }
    },
    [close, handlePick, matches, mode, selectedIndex],
  );

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-start justify-center bg-[var(--color-cork-ink)]/30 pt-[14vh]"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-[480px] overflow-hidden rounded-2xl border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-cork-border)] px-4 py-3">
          <MagnifyingGlass size={16} className="text-[var(--color-cork-muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={mode === "insert" ? "Insert template..." : "New note from template..."}
            className="w-full bg-transparent text-[14px] outline-none placeholder:text-[var(--color-cork-subtle)]"
          />
          <kbd className="rounded border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-1.5 py-0.5 text-[10px] text-[var(--color-cork-muted)]">
            ESC
          </kbd>
        </div>

        <div className="max-h-[320px] overflow-y-auto p-2 text-[13px]">
          {templates === null && (
            <div className="px-2.5 py-4 text-center text-[12px] text-[var(--color-cork-subtle)]">
              Loading templates...
            </div>
          )}
          {templates !== null && templates.length === 0 && <EmptyState onClose={close} />}
          {templates !== null && templates.length > 0 && matches.length === 0 && (
            <div className="px-2.5 py-4 text-center text-[12px] text-[var(--color-cork-subtle)]">
              No templates match &ldquo;{query}&rdquo;.
            </div>
          )}
          {matches.map((t, i) => (
            <button
              key={t.relPath}
              onClick={() => mode && handlePick(t, mode)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left ${
                selectedIndex === i
                  ? "bg-[var(--color-cork-accent-soft)]"
                  : "hover:bg-[var(--color-cork-panel-2)]"
              }`}
            >
              <FileText size={14} className="text-[var(--color-cork-muted)]" />
              <span className="flex-1 truncate text-[var(--color-cork-ink)]">{t.name}</span>
              {t.relPath !== `${t.name}.md` && (
                <span className="truncate text-[11px] text-[var(--color-cork-subtle)]">
                  {t.relPath}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Dispatches a picked template to the create/insert flow (wired by F39-T05/T06).
function pickTemplate(_template: TemplateEntry, _mode: TemplatePickerMode) {
  // No-op until the create (T05) and insert (T06) services land.
}

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 px-2.5 py-6 text-center">
      <FileDashed size={24} className="text-[var(--color-cork-subtle)]" />
      <p className="text-[12px] text-[var(--color-cork-muted)]">
        No templates yet. Any note in your templates folder becomes a template.
      </p>
      <button
        onClick={() => {
          onClose();
          void createTemplateNote();
        }}
        className="mt-1 flex items-center gap-1.5 rounded-full bg-[var(--color-cork-ink)] px-4 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
      >
        <Plus size={12} />
        Create template
      </button>
    </div>
  );
}
