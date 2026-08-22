import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  CopySimple,
  LinkSimple,
  Sparkle,
  Tag,
  TextAa,
  TextAlignLeft,
  TreeStructure,
} from "@phosphor-icons/react";

import { useEditorStore } from "@/stores/editorStore";
import { client } from "@/ipc/client";
import { existingLinks, findCandidates, formatCandidates, parsePairs } from "@/services/aiVault";
import { SectionHeader } from "./helpers";
import { AiSuggestions, type Suggestion } from "./AiSuggestions";

export function AiSection() {
  const [loading, setLoading] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{
    kind: "links" | "overlap";
    items: Suggestion[];
  } | null>(null);
  const body = useEditorStore((s) => s.body);
  const noteId = useEditorStore((s) => s.noteId);
  const frontmatter = useEditorStore((s) => s.frontmatter);

  const runSkill = useCallback(
    async (skillId: string) => {
      if (!body || !noteId) return;
      setLoading(skillId);
      try {
        const title = typeof frontmatter.title === "string" ? frontmatter.title : noteId;
        const fm = Object.entries(frontmatter)
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join("\n");
        const result = await client.ai.runSkill(skillId, { title, frontmatter: fm, body });
        const typed = result as { output: string };
        if (skillId === "fix-spelling") {
          useEditorStore.getState().updateBody(typed.output);
          toast.success("Spelling corrected");
        } else {
          toast.info(typed.output, { duration: 15000 });
        }
      } catch (err) {
        const error = err as { kind?: string; message?: string };
        if (error.kind === "provider_disabled") {
          toast.error("Configure an AI provider in Settings");
        } else {
          toast.error(`Error: ${error.message ?? String(err)}`);
        }
      } finally {
        setLoading(null);
      }
    },
    [body, noteId, frontmatter],
  );

  /**
   * Skills that reason about the note *within* the vault. The index picks the
   * candidates so the model only has to judge a short list, which keeps the
   * prompt small and the reason a note was considered inspectable.
   */
  const runVaultSkill = useCallback(
    async (skillId: "suggest-links" | "find-overlap") => {
      if (!body || !noteId) return;
      setLoading(skillId);
      setSuggestions(null);
      try {
        const title = typeof frontmatter.title === "string" ? frontmatter.title : noteId;
        const candidates = await findCandidates(body, noteId);
        if (candidates.length === 0) {
          toast.info("No comparable notes found in the vault yet");
          return;
        }
        const result = (await client.ai.runSkill(skillId, {
          title,
          body,
          candidates: formatCandidates(candidates),
          linked: existingLinks(body).join(", ") || "none",
        })) as { output: string };

        const items = parsePairs(result.output);
        if (items.length === 0) {
          toast.info(
            skillId === "suggest-links"
              ? "Nothing worth linking here"
              : "No overlapping notes found",
          );
          return;
        }
        setSuggestions({ kind: skillId === "suggest-links" ? "links" : "overlap", items });
      } catch (err) {
        const error = err as { kind?: string; message?: string };
        if (error.kind === "provider_disabled") toast.error("Configure an AI provider in Settings");
        else toast.error(`Error: ${error.message ?? String(err)}`);
      } finally {
        setLoading(null);
      }
    },
    [body, noteId, frontmatter],
  );

  return (
    <section>
      <SectionHeader icon={<Sparkle size={14} />} title="AI" />
      <div className="flex flex-col gap-1.5">
        <AiButton
          icon={<TextAlignLeft size={14} />}
          label="Summarize note"
          loading={loading === "summarize"}
          onClick={() => void runSkill("summarize")}
        />
        <AiButton
          icon={<Tag size={14} />}
          label="Suggest tags"
          loading={loading === "suggest-tags"}
          onClick={() => void runSkill("suggest-tags")}
        />
        <AiButton
          icon={<TreeStructure size={14} />}
          label="Related notes"
          loading={loading === "related-notes"}
          onClick={() => void runSkill("related-notes")}
        />
        <AiButton
          icon={<LinkSimple size={14} />}
          label="Suggest links"
          loading={loading === "suggest-links"}
          onClick={() => void runVaultSkill("suggest-links")}
        />
        <AiButton
          icon={<CopySimple size={14} />}
          label="Find duplicates"
          loading={loading === "find-overlap"}
          onClick={() => void runVaultSkill("find-overlap")}
        />
        <AiButton
          icon={<TextAa size={14} />}
          label="Fix spelling"
          loading={loading === "fix-spelling"}
          onClick={() => void runSkill("fix-spelling")}
        />
      </div>

      {suggestions && (
        <AiSuggestions
          kind={suggestions.kind}
          items={suggestions.items}
          onDismiss={() => setSuggestions(null)}
        />
      )}
    </section>
  );
}

function AiButton({
  icon,
  label,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 rounded-md border border-[var(--color-cork-border)] px-2.5 py-1.5 text-[12px] text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)] disabled:opacity-50"
    >
      {loading ? (
        <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
      {label}
    </button>
  );
}
