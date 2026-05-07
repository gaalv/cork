import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runAiSlash } from "./aiSlashRunner";

import type { RunAiSlashDeps } from "./aiSlashRunner";

function makeView(doc: string, selection?: { from: number; to: number }) {
  const state = EditorState.create({
    doc,
    selection: selection ? { anchor: selection.from, head: selection.to } : undefined,
  });
  const parent = document.createElement("div");
  return new EditorView({ state, parent });
}

function makeDeps(overrides: Partial<RunAiSlashDeps> = {}): RunAiSlashDeps & {
  runSkill: ReturnType<typeof vi.fn>;
  pushToast: ReturnType<typeof vi.fn>;
  isAiDisabled: ReturnType<typeof vi.fn>;
} {
  return {
    runSkill: vi.fn().mockResolvedValue({ output: "AI OUT", cached: false }),
    pushToast: vi.fn(),
    isAiDisabled: vi.fn().mockReturnValue(false),
    ...overrides,
  } as never;
}

describe("runAiSlash", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes the trigger and toasts when AI is disabled", async () => {
    const view = makeView("/ai-rephrase", { from: 12, to: 12 });
    const deps = makeDeps({ isAiDisabled: vi.fn().mockReturnValue(true) });
    await runAiSlash(view, "rephrase", 0, 12, deps);
    expect(view.state.doc.toString()).toBe("");
    expect(deps.runSkill).not.toHaveBeenCalled();
    expect(deps.pushToast).toHaveBeenCalled();
  });

  it("rephrases a selection in place", async () => {
    const view = makeView("/ai-rephrasehello world", { from: 12, to: 23 });
    const deps = makeDeps();
    await runAiSlash(view, "rephrase", 0, 12, deps);
    expect(deps.runSkill).toHaveBeenCalledWith("slash-rephrase", { selection: "hello world" });
    expect(view.state.doc.toString()).toBe("AI OUT");
  });

  it("rejects rephrase without selection", async () => {
    const view = makeView("/ai-rephrase", { from: 12, to: 12 });
    const deps = makeDeps();
    await runAiSlash(view, "rephrase", 0, 12, deps);
    expect(deps.runSkill).not.toHaveBeenCalled();
    expect(deps.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("needs a selection") }),
    );
  });

  it("continues at cursor using prefix", async () => {
    const view = makeView("hello there/ai-continue", { from: 23, to: 23 });
    const deps = makeDeps({ runSkill: vi.fn().mockResolvedValue({ output: "more", cached: false }) });
    await runAiSlash(view, "continue", 11, 23, deps);
    expect(deps.runSkill).toHaveBeenCalledWith("slash-continue", { prefix: "hello there" });
    expect(view.state.doc.toString()).toBe("hello there\n\nmore");
  });

  it("summarize without selection uses whole body and inserts at cursor", async () => {
    const view = makeView("body/ai-summarize", { from: 17, to: 17 });
    const deps = makeDeps({ runSkill: vi.fn().mockResolvedValue({ output: "Summary.", cached: false }) });
    await runAiSlash(view, "summarize", 4, 17, deps);
    expect(deps.runSkill).toHaveBeenCalledWith(
      "summarize",
      expect.objectContaining({ body: "body", title: "", frontmatter: "" }),
    );
    expect(view.state.doc.toString()).toBe("body\n\nSummary.");
  });

  it("toasts on runSkill error", async () => {
    const view = makeView("/ai-expandX", { from: 11, to: 11 });
    const state = EditorState.create({ doc: "/ai-expandX", selection: { anchor: 10, head: 11 } });
    view.setState(state);
    const deps = makeDeps({ runSkill: vi.fn().mockRejectedValue({ message: "boom" }) });
    await runAiSlash(view, "expand", 0, 10, deps);
    expect(deps.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("failed"), description: "boom" }),
    );
  });
});
