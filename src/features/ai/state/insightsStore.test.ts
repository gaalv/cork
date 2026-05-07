import { beforeEach, describe, expect, it, vi } from "vitest";

const { skillsClientMock } = vi.hoisted(() => ({
  skillsClientMock: {
    runSkill: vi.fn(),
    cacheClear: vi.fn(),
  },
}));

vi.mock("@/features/ai/services/skillsClient", () => skillsClientMock);

import { __test__, useInsightsStore } from "./insightsStore";

beforeEach(() => {
  Object.values(skillsClientMock).forEach((fn) => fn.mockReset());
  useInsightsStore.setState({ byNote: {} });
});

describe("insightsStore.parseTags", () => {
  it("parses JSON array", () => {
    expect(__test__.parseTags('["foo","#bar","baz"]')).toEqual(["foo", "bar", "baz"]);
  });
  it("falls back to comma split", () => {
    expect(__test__.parseTags("foo, bar, #baz")).toEqual(["foo", "bar", "baz"]);
  });
  it("handles newlines", () => {
    expect(__test__.parseTags("foo\nbar\n")).toEqual(["foo", "bar"]);
  });
});

describe("insightsStore.parseKeywords", () => {
  it("parses comma-separated lowercase keywords", () => {
    expect(__test__.parseKeywords("Foo, BAR, baz")).toEqual(["foo", "bar", "baz"]);
  });
  it("dedupes and strips bullets", () => {
    expect(__test__.parseKeywords("- foo\n- foo\n* bar")).toEqual(["foo", "bar"]);
  });
});

describe("insightsStore.resolveRelatedNotes", () => {
  it("filters self, dedupes by id, sorts by reason count then rank", async () => {
    const search = vi.fn(async (q: string) => {
      if (q === "alpha") {
        return [
          { id: "self", title: "Self", path: "x.md", rank: 10 },
          { id: "n1", title: "First", path: "a.md", rank: 5 },
        ];
      }
      if (q === "beta") {
        return [{ id: "n1", title: "First", path: "a.md", rank: 7 }];
      }
      if (q === "gamma") {
        return [{ id: "n2", title: "Second", path: "b.md", rank: 9 }];
      }
      return [];
    });
    const result = await __test__.resolveRelatedNotes(["alpha", "beta", "gamma"], "self", search);
    expect(result.map((r) => r.id)).toEqual(["n1", "n2"]);
    expect(result[0]).toMatchObject({ id: "n1", title: "First", path: "a.md", reason: "alpha, beta" });
  });

  it("returns empty when no hits", async () => {
    const search = vi.fn(async () => []);
    expect(await __test__.resolveRelatedNotes(["x"], "self", search)).toEqual([]);
  });
});

describe("useInsightsStore.generate", () => {
  it("populates summary slot on success", async () => {
    skillsClientMock.runSkill.mockResolvedValue({
      output: "  Hello world.  ",
      cacheHit: true,
      tokensIn: 1,
      tokensOut: 1,
      latencyMs: 1,
      skillId: "summarize",
    });
    await useInsightsStore.getState().generate({
      noteId: "n1",
      kind: "summary",
      variables: { body: "x" },
    });
    const slot = useInsightsStore.getState().byNote.n1.summary;
    expect(slot.status).toBe("ready");
    expect(slot.data).toBe("Hello world.");
    expect(slot.cachedHit).toBe(true);
  });

  it("records errors", async () => {
    skillsClientMock.runSkill.mockRejectedValue({ kind: "binary_not_found", message: "no claude" });
    await useInsightsStore.getState().generate({
      noteId: "n1",
      kind: "tags",
      variables: {},
    });
    const slot = useInsightsStore.getState().byNote.n1.tags;
    expect(slot.status).toBe("error");
    expect(slot.error).toBe("no claude");
  });

  it("force=true clears cache before running", async () => {
    skillsClientMock.cacheClear.mockResolvedValue(0);
    skillsClientMock.runSkill.mockResolvedValue({
      output: '["a","b"]',
      cacheHit: false,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: 0,
      skillId: "suggest-tags",
    });
    await useInsightsStore.getState().generate({
      noteId: "n1",
      kind: "tags",
      variables: {},
      force: true,
    });
    expect(skillsClientMock.cacheClear).toHaveBeenCalledWith("suggest-tags");
    expect(useInsightsStore.getState().byNote.n1.tags.data).toEqual(["a", "b"]);
  });

  it("reset removes a note's slot", async () => {
    skillsClientMock.runSkill.mockResolvedValue({
      output: "x",
      cacheHit: false,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: 0,
      skillId: "summarize",
    });
    await useInsightsStore.getState().generate({ noteId: "n1", kind: "summary", variables: {} });
    expect(useInsightsStore.getState().byNote.n1).toBeDefined();
    useInsightsStore.getState().reset("n1");
    expect(useInsightsStore.getState().byNote.n1).toBeUndefined();
  });
});
