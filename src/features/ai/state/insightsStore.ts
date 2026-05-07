import { create } from "zustand";

import { cacheClear, runSkill } from "@/features/ai/services/skillsClient";
import { client } from "@/shared/ipc/client";
import type { AiSkillError } from "@/shared/ipc/IpcContract";

export type InsightKind = "summary" | "tags" | "related";

export type RelatedNote = {
  id: string;
  title: string;
  path: string;
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

function parseKeywords(raw: string): string[] {
  const trimmed = raw.trim();
  const parts = trimmed.split(/[\n,]/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const cleaned = part
      .replace(/^[-*\d.\s]+/, "")
      .replace(/^#/, "")
      .trim()
      .toLowerCase();
    if (!cleaned) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out;
}

async function resolveRelatedNotes(
  keywords: string[],
  selfNoteId: string,
  searchFn: (q: string, limit?: number) => Promise<Array<{ id: string; title: string; path: string; rank: number }>>,
  limit = 5,
): Promise<RelatedNote[]> {
  const byId = new Map<string, { entry: RelatedNote; rank: number; reasons: Set<string> }>();
  for (const keyword of keywords.slice(0, 8)) {
    let hits;
    try {
      hits = await searchFn(keyword, 5);
    } catch {
      continue;
    }
    for (const hit of hits) {
      if (hit.id === selfNoteId) continue;
      const existing = byId.get(hit.id);
      if (existing) {
        existing.reasons.add(keyword);
        existing.rank = Math.max(existing.rank, hit.rank);
      } else {
        byId.set(hit.id, {
          entry: { id: hit.id, title: hit.title, path: hit.path },
          rank: hit.rank,
          reasons: new Set([keyword]),
        });
      }
    }
  }
  return [...byId.values()]
    .sort((a, b) => {
      if (b.reasons.size !== a.reasons.size) return b.reasons.size - a.reasons.size;
      return b.rank - a.rank;
    })
    .slice(0, limit)
    .map(({ entry, reasons }) => ({ ...entry, reason: [...reasons].slice(0, 3).join(", ") }));
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
        const keywords = parseKeywords(result.output);
        const resolved = await resolveRelatedNotes(keywords, noteId, (q, limit) => client.notes.search(q, limit));
        slot = { status: "ready", data: resolved, cachedHit: result.cacheHit };
      }

      set((state) => setSlot(state, noteId, kind, slot));
    } catch (err) {
      set((state) =>
        setSlot(state, noteId, kind, { status: "error", error: describeError(err) }),
      );
    }
  },
}));

export const __test__ = { parseTags, parseKeywords, resolveRelatedNotes };
