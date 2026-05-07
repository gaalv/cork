import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildContext, sendPrompt } from "./aiClient";

const { vaultStoreMock, editorStoreMock, clientMock } = vi.hoisted(() => ({
  vaultStoreMock: { getState: vi.fn() },
  editorStoreMock: { getState: vi.fn() },
  clientMock: { ai: { sendPrompt: vi.fn() } },
}));

vi.mock("@/features/vault/state/vaultStore", () => ({
  useVaultStore: vaultStoreMock,
}));

vi.mock("@/features/editor/state/editorStore", () => ({
  useEditorStore: editorStoreMock,
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

const NOTE_ID = "note-abc";

beforeEach(() => {
  clientMock.ai.sendPrompt.mockReset();
  vaultStoreMock.getState.mockReturnValue({
    notes: [{ id: NOTE_ID, title: "My Note", path: "/vault/my-note.md" }],
  });
  editorStoreMock.getState.mockReturnValue({
    buffers: new Map([
      [
        NOTE_ID,
        {
          body: "This is the note body.",
          frontmatter: { created: "2024-01-01", tags: ["test"] },
        },
      ],
    ]),
  });
});

describe("buildContext", () => {
  it("returns placeholder when noteId is null", () => {
    const ctx = buildContext(null);
    expect(ctx).toBe("(no note open)");
  });

  it("includes title, frontmatter, and body", () => {
    const ctx = buildContext(NOTE_ID);
    expect(ctx).toContain("# My Note");
    expect(ctx).toContain("created: 2024-01-01");
    expect(ctx).toContain("This is the note body.");
  });

  it("handles missing buffer gracefully", () => {
    editorStoreMock.getState.mockReturnValue({ buffers: new Map() });
    const ctx = buildContext(NOTE_ID);
    expect(ctx).toContain("# My Note");
    // No frontmatter block, no body
    expect(ctx).not.toContain("---");
  });

  it("handles missing note entry gracefully", () => {
    vaultStoreMock.getState.mockReturnValue({ notes: [] });
    const ctx = buildContext(NOTE_ID);
    expect(ctx).toContain("# Untitled");
  });

  it("truncates context at 50KB", () => {
    const bigBody = "x".repeat(60 * 1024);
    editorStoreMock.getState.mockReturnValue({
      buffers: new Map([[NOTE_ID, { body: bigBody, frontmatter: {} }]]),
    });
    const ctx = buildContext(NOTE_ID);
    expect(ctx.length).toBeLessThanOrEqual(50 * 1024 + 100); // some slack for truncation notice
    expect(ctx).toContain("[Note content truncated at 50 KB]");
  });
});

describe("sendPrompt", () => {
  it("calls client.ai.sendPrompt with correct args", async () => {
    clientMock.ai.sendPrompt.mockResolvedValue("AI response");
    const result = await sendPrompt("claude", "What is this?", "context here");
    expect(clientMock.ai.sendPrompt).toHaveBeenCalledWith("claude", "What is this?", "context here");
    expect(result).toBe("AI response");
  });

  it("propagates rejection from IPC", async () => {
    clientMock.ai.sendPrompt.mockRejectedValue({ kind: "timeout", message: "timed out" });
    await expect(sendPrompt("claude", "q", "ctx")).rejects.toMatchObject({
      kind: "timeout",
      message: "timed out",
    });
  });
});
