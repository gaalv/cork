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

describe("insightsStore.parseRelated", () => {
  it("parses array of objects", () => {
    expect(__test__.parseRelated('[{"title":"A","reason":"r"},{"title":"B"}]')).toEqual([
      { title: "A", reason: "r" },
      { title: "B" },
    ]);
  });
  it("parses array of strings", () => {
    expect(__test__.parseRelated('["A","B"]')).toEqual([{ title: "A" }, { title: "B" }]);
  });
  it("falls back to bullet list", () => {
    expect(__test__.parseRelated("- One\n- Two")).toEqual([{ title: "One" }, { title: "Two" }]);
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
