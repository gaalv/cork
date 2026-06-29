/**
 * Generate note from topic modal — powered by AI skills.
 *
 * @see F21 — AI Infrastructure (generate-note skill)
 */

import { useState } from "react";
import { Sparkle, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { useShellStore } from "@/stores/shellStore";
import { useVaultStore } from "@/stores/vaultStore";
import { client } from "@/ipc/client";

export function GenerateNoteModal() {
  const open = useShellStore((s) => s.generateModalOpen);
  const close = useShellStore((s) => s.setGenerateModalOpen);
  const loadNotes = useVaultStore((s) => s.loadNotes);

  const [topic, setTopic] = useState("");

  if (!open) return null;

  const handleGenerate = () => {
    const value = topic.trim();
    if (!value) return;

    // Close modal immediately and run in background
    close(false);
    setTopic("");
    toast("Generating note...", { id: "ai-generate", duration: Infinity });

    (async () => {
      try {
        const result = await client.ai.runSkill("generate-note", { topic: value });
        const output = (result as { output: string }).output;

        const created = await client.notes.create({ folder: "", title: value });
        const noteResult = created as { id: string; path: string };
        await client.notes.save({ path: noteResult.path, body: output, frontmatter: {} });

        await loadNotes();
        toast.success("Note generated", { id: "ai-generate" });
      } catch {
        toast.error("Failed to generate note — check your AI provider settings", {
          id: "ai-generate",
        });
      }
    })();
  };

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--color-cork-ink)]/30"
      onClick={() => close(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[480px] overflow-hidden rounded-2xl border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-cork-border)] px-5 py-3">
          <div className="flex items-center gap-2">
            <Sparkle size={16} weight="fill" className="text-[var(--color-cork-accent)]" />
            <h2 className="text-[14px] font-semibold">Generate note from topic</h2>
          </div>
          <button
            onClick={() => close(false)}
            className="rounded p-1 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)]"
          >
            <X size={14} />
          </button>
        </div>
        <div className="px-5 py-4">
          <label className="mb-1 block text-[12px] font-medium text-[var(--color-cork-muted)]">
            Topic or question
          </label>
          <input
            autoFocus
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleGenerate();
            }}
            placeholder="e.g. How to structure a Rust CLI project"
            className="w-full rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-3 py-2 text-[14px] outline-none placeholder:text-[var(--color-cork-subtle)] focus:border-[var(--color-cork-accent)]"
          />
          <p className="mt-2 text-[12px] text-[var(--color-cork-subtle)]">
            AI will create a new note with structured content about this topic.
          </p>
        </div>
        <div className="flex justify-end border-t border-[var(--color-cork-border)] px-5 py-3">
          <button
            onClick={handleGenerate}
            disabled={!topic.trim()}
            className="flex items-center gap-1.5 rounded-full bg-[var(--color-cork-ink)] px-4 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Sparkle size={12} weight="fill" />
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
