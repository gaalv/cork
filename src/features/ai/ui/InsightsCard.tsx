import { useMemo } from "react";
import { ArrowClockwise, Sparkle, Spinner } from "@phosphor-icons/react";

import { useEditorStore } from "@/features/editor/state/editorStore";
import { useInsightsStore } from "@/features/ai/state/insightsStore";
import { useAppSettingsStore } from "@/features/settings/state/appSettingsStore";
import { useSettingsUiStore } from "@/features/settings/state/settingsUiStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import type { InsightKind, RelatedNote } from "@/features/ai/state/insightsStore";

type InsightsCardProps = {
  noteId: string | null;
  body: string;
  title: string;
};

function frontmatterToString(fm: Record<string, unknown> | undefined): string {
  if (!fm) return "";
  try {
    return JSON.stringify(fm, null, 2);
  } catch {
    return "";
  }
}

function readTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  return [];
}

export function InsightsCard({ noteId, body, title }: InsightsCardProps) {
  const provider = useAppSettingsStore((state) => state.settings.ai?.provider ?? "disabled");
  const openSettings = useSettingsUiStore((state) => state.openSettings);

  if (provider === "disabled") {
    return (
      <section
        aria-labelledby="insights-heading"
        className="rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-4"
      >
        <div className="flex items-center gap-2">
          <Sparkle size={14} weight="fill" className="text-[var(--color-noxe-muted)]" />
          <h2 id="insights-heading" className="text-sm font-semibold text-[var(--color-noxe-ink)]">
            AI Insights
          </h2>
        </div>
        <p className="mt-2 text-xs text-[var(--color-noxe-muted)]">
          Enable an AI provider to generate summary, tag suggestions, and related notes for this note.
        </p>
        <button
          type="button"
          className="mt-3 rounded-md border border-[var(--color-noxe-border)] px-2 py-1 text-xs hover:bg-[var(--color-noxe-hover)]"
          onClick={() => openSettings("ai")}
        >
          Open AI settings
        </button>
      </section>
    );
  }

  if (!noteId) {
    return null;
  }

  return <ActiveInsightsCard noteId={noteId} body={body} title={title} />;
}

function ActiveInsightsCard({ noteId, body, title }: { noteId: string; body: string; title: string }) {
  const buffer = useEditorStore((state) => state.buffers.get(noteId) ?? null);
  const updateFrontmatter = useEditorStore((state) => state.updateFrontmatter);
  const insights = useInsightsStore((state) => state.byNote[noteId]);
  const generate = useInsightsStore((state) => state.generate);
  const navigate = useShellStore((state) => state.navigate);
  const notes = useVaultStore((state) => state.notes);

  const variables = useMemo(
    () => ({
      title: title || "Untitled",
      body: body ?? "",
      frontmatter: frontmatterToString(buffer?.frontmatter as Record<string, unknown> | undefined),
    }),
    [title, body, buffer?.frontmatter],
  );

  const summary = insights?.summary ?? { status: "idle" as const };
  const tags = insights?.tags ?? { status: "idle" as const };
  const related = insights?.related ?? { status: "idle" as const };

  const currentTags = readTags(buffer?.frontmatter.tags);
  const currentTagSet = useMemo(() => new Set(currentTags), [currentTags]);

  function trigger(kind: InsightKind, force = false) {
    void generate({ noteId, kind, variables, force });
  }

  function addTag(tag: string) {
    const next = currentTagSet.has(tag) ? currentTags : [...currentTags, tag];
    if (next === currentTags) return;
    updateFrontmatter(noteId, { tags: next });
  }

  function openRelated(rel: RelatedNote) {
    const target = notes.find((note) => note.title.toLowerCase() === rel.title.toLowerCase());
    if (target) {
      navigate({ kind: "note", id: target.id });
    }
  }

  return (
    <section
      aria-labelledby="insights-heading"
      className="rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-4"
    >
      <div className="flex items-center gap-2">
        <Sparkle size={14} weight="fill" className="text-[var(--color-noxe-muted)]" />
        <h2 id="insights-heading" className="text-sm font-semibold text-[var(--color-noxe-ink)]">
          AI Insights
        </h2>
      </div>

      <InsightSection
        label="Summary"
        slot={summary}
        emptyHint="One-paragraph TL;DR of this note."
        onGenerate={() => trigger("summary")}
        onRegenerate={() => trigger("summary", true)}
      >
        {summary.status === "ready" && summary.data ? (
          <p className="whitespace-pre-line text-xs leading-relaxed text-[var(--color-noxe-ink)]">
            {summary.data}
          </p>
        ) : null}
      </InsightSection>

      <InsightSection
        label="Suggested tags"
        slot={tags}
        emptyHint="Up to 5 tags inferred from the content."
        onGenerate={() => trigger("tags")}
        onRegenerate={() => trigger("tags", true)}
      >
        {tags.status === "ready" && tags.data && tags.data.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.data.map((tag) => {
              const applied = currentTagSet.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  disabled={applied}
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    applied
                      ? "border-[var(--color-noxe-border)] bg-[var(--color-noxe-bg)] text-[var(--color-noxe-muted)]"
                      : "border-[var(--color-noxe-border)] hover:bg-[var(--color-noxe-hover)]"
                  }`}
                  aria-label={applied ? `Tag ${tag} already applied` : `Add tag ${tag}`}
                >
                  #{tag}
                  {applied ? " ✓" : ""}
                </button>
              );
            })}
          </div>
        ) : null}
      </InsightSection>

      <InsightSection
        label="Related notes"
        slot={related}
        emptyHint="Notes in this vault that look similar."
        onGenerate={() => trigger("related")}
        onRegenerate={() => trigger("related", true)}
      >
        {related.status === "ready" && related.data && related.data.length > 0 ? (
          <ul className="space-y-1">
            {related.data.map((rel) => {
              const known = notes.some((note) => note.title.toLowerCase() === rel.title.toLowerCase());
              return (
                <li key={rel.title}>
                  <button
                    type="button"
                    onClick={() => openRelated(rel)}
                    disabled={!known}
                    className={`text-left text-xs ${
                      known
                        ? "text-[var(--color-noxe-ink)] hover:underline"
                        : "text-[var(--color-noxe-muted)]"
                    }`}
                  >
                    {rel.title}
                    {!known ? " (not in vault)" : ""}
                  </button>
                  {rel.reason ? (
                    <span className="block text-[11px] text-[var(--color-noxe-muted)]">{rel.reason}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </InsightSection>
    </section>
  );
}

type InsightSectionProps = {
  label: string;
  slot: { status: "idle" | "loading" | "ready" | "error"; error?: string; cachedHit?: boolean };
  emptyHint: string;
  onGenerate: () => void;
  onRegenerate: () => void;
  children?: React.ReactNode;
};

function InsightSection({ label, slot, emptyHint, onGenerate, onRegenerate, children }: InsightSectionProps) {
  return (
    <div className="mt-4 first:mt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-noxe-muted)]">
          {label}
        </h3>
        {slot.status === "ready" ? (
          <button
            type="button"
            className="text-[11px] text-[var(--color-noxe-muted)] hover:text-[var(--color-noxe-ink)]"
            onClick={onRegenerate}
            title="Regenerate (bypasses cache)"
          >
            <ArrowClockwise size={12} className="inline" /> Regenerate
          </button>
        ) : null}
      </div>

      {slot.status === "idle" ? (
        <div className="mt-1.5 space-y-1.5">
          <p className="text-[11px] text-[var(--color-noxe-muted)]">{emptyHint}</p>
          <button
            type="button"
            onClick={onGenerate}
            className="rounded-md border border-[var(--color-noxe-border)] px-2 py-0.5 text-[11px] hover:bg-[var(--color-noxe-hover)]"
          >
            Generate
          </button>
        </div>
      ) : null}

      {slot.status === "loading" ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--color-noxe-muted)]">
          <Spinner size={12} className="animate-spin" /> Generating…
        </p>
      ) : null}

      {slot.status === "ready" ? <div className="mt-1.5">{children}</div> : null}

      {slot.status === "error" ? (
        <div className="mt-1.5 space-y-1">
          <p className="text-[11px] text-[var(--color-noxe-danger,#dc2626)]">{slot.error ?? "Failed."}</p>
          <button
            type="button"
            onClick={onGenerate}
            className="rounded-md border border-[var(--color-noxe-border)] px-2 py-0.5 text-[11px] hover:bg-[var(--color-noxe-hover)]"
          >
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}
