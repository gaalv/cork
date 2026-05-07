import { create } from "zustand";

import { cacheClear, runSkill } from "@/features/ai/services/skillsClient";
import type { AiSkillError } from "@/shared/ipc/IpcContract";

export type InsightKind = "summary" | "tags" | "related";

export type RelatedNote = {
  title: string;
  reason?: string;
};

export type InsightStatus = "idle" | "loading" | "ready" | "error";

export type InsightSlot<T> = {
  status: InsightStatus;
  data?: T;
  error?: string;
  cachedHit?: boolean;
};

export type NoteInsights = {
  summary: InsightSlot<string>;
  tags: InsightSlot<string[]>;
  related: InsightSlot<RelatedNote[]>;
};

const EMPTY_NOTE_INSIGHTS: NoteInsights = {
  summary: { status: "idle" },
  tags: { status: "idle" },
  related: { status: "idle" },
};

const SKILL_ID: Record<InsightKind, string> = {
  summary: "summarize",
  tags: "suggest-tags",
  related: "related-notes",
};

type GenerateArgs = {
  noteId: string;
  kind: InsightKind;
  variables: Record<string, string>;
  force?: boolean;
};

interface InsightsState {
  byNote: Record<string, NoteInsights>;
  get: (noteId: string) => NoteInsights;
  generate: (args: GenerateArgs) => Promise<void>;
  reset: (noteId: string) => void;
}

function parseTags(raw: string): string[] {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((entry): entry is string => typeof entry === "string")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean);
    }
  } catch {
    // fall through to comma/line split
  }
  return trimmed
    .split(/[\n,]/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);
}

function parseRelated(raw: string): RelatedNote[] {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => {
          if (typeof entry === "string") return { title: entry.trim() };
          if (entry && typeof entry === "object" && typeof (entry as { title?: unknown }).title === "string") {
            const reasonValue = (entry as { reason?: unknown }).reason;
            const reason = typeof reasonValue === "string" ? reasonValue : undefined;
            return { title: ((entry as { title: string }).title).trim(), reason };
          }
          return null;
        })
        .filter((entry): entry is RelatedNote => entry !== null && entry.title.length > 0);
    }
  } catch {
    // fall through
  }
  return trimmed
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean)
    .map((title) => ({ title }));
}

function setSlot(
  state: InsightsState,
  noteId: string,
  kind: InsightKind,
  slot: InsightSlot<unknown>,
): Partial<InsightsState> {
  const current = state.byNote[noteId] ?? EMPTY_NOTE_INSIGHTS;
  return {
    byNote: {
      ...state.byNote,
      [noteId]: {
        ...current,
        [kind]: slot,
      },
    },
  };
}

function describeError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as AiSkillError).message === "string") {
    return (err as AiSkillError).message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export const useInsightsStore = create<InsightsState>((set, get) => ({
  byNote: {},

  get(noteId) {
    return get().byNote[noteId] ?? EMPTY_NOTE_INSIGHTS;
  },

  reset(noteId) {
    set((state) => {
      if (!state.byNote[noteId]) return state;
      const { [noteId]: _removed, ...rest } = state.byNote;
      return { byNote: rest };
    });
  },

  async generate({ noteId, kind, variables, force }) {
    set((state) => setSlot(state, noteId, kind, { status: "loading" }));

    try {
      if (force) {
        try {
          await cacheClear(SKILL_ID[kind]);
        } catch {
          // non-fatal — proceed to runSkill anyway
        }
      }

      const result = await runSkill(SKILL_ID[kind], variables);

      let slot: InsightSlot<unknown>;
      if (kind === "summary") {
        slot = { status: "ready", data: result.output.trim(), cachedHit: result.cacheHit };
      } else if (kind === "tags") {
        slot = { status: "ready", data: parseTags(result.output), cachedHit: result.cacheHit };
      } else {
        slot = { status: "ready", data: parseRelated(result.output), cachedHit: result.cacheHit };
      }

      set((state) => setSlot(state, noteId, kind, slot));
    } catch (err) {
      set((state) =>
        setSlot(state, noteId, kind, { status: "error", error: describeError(err) }),
      );
    }
  },
}));

export const __test__ = { parseTags, parseRelated };
