import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useEditorStore } from "@/features/editor/state/editorStore";

import { TagsField } from "./TagsField";

const { clientMock, settingsMock } = vi.hoisted(() => ({
  clientMock: {
    tags: { list: vi.fn() },
    notes: { byTag: vi.fn() },
    events: { on: vi.fn() },
  },
  settingsMock: {
    addLibraryTag: vi.fn(),
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));
vi.mock("@/features/settings/state/vaultSettingsStore", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/settings/state/vaultSettingsStore")
  >("@/features/settings/state/vaultSettingsStore");
  return {
    ...actual,
    useVaultSettingsStore: Object.assign(
      (
        selector: (state: { settings: { tagLibrary: string[] } } & typeof settingsMock) => unknown,
      ) => selector({ settings: { tagLibrary: [] }, addLibraryTag: settingsMock.addLibraryTag }),
      {
        getState: () => ({
          settings: { tagLibrary: [] },
          addLibraryTag: settingsMock.addLibraryTag,
        }),
      },
    ),
  };
});

const baseBuffer = {
  noteId: "n1",
  path: "/vault/Note.md",
  frontmatter: { tags: ["existing"] },
  body: "",
  loadedMtime: 1,
  dirty: false,
  saveStatus: "idle" as const,
  saveError: null,
  lastSavedAt: null,
  pendingSave: false,
  conflict: null,
};

beforeEach(() => {
  clientMock.tags.list.mockReset().mockResolvedValue([
    { tag: "existing", count: 1 },
    { tag: "rust", count: 0 },
  ]);
  clientMock.notes.byTag.mockReset().mockResolvedValue([]);
  clientMock.events.on.mockReset().mockResolvedValue(vi.fn());
  settingsMock.addLibraryTag.mockReset().mockResolvedValue(undefined);
  useEditorStore.setState({
    activeNoteId: "n1",
    buffers: new Map([["n1", { ...baseBuffer, frontmatter: { tags: ["existing"] } }]]),
  } as never);
});

describe("TagsField", () => {
  it("renders existing tags", () => {
    render(<TagsField noteId="n1" />);
    expect(screen.getByText("existing")).toBeInTheDocument();
  });

  it("adds an existing tag from the dropdown", async () => {
    render(<TagsField noteId="n1" />);
    fireEvent.click(screen.getByRole("button", { name: /add tag/i }));
    const option = await screen.findByRole("option", { name: /rust/i });
    fireEvent.click(option);
    const buffer = useEditorStore.getState().buffers.get("n1")!;
    expect(buffer.frontmatter.tags).toEqual(["existing", "rust"]);
    expect(buffer.dirty).toBe(true);
  });

  it("creates a new tag from the search field", async () => {
    render(<TagsField noteId="n1" />);
    fireEvent.click(screen.getByRole("button", { name: /add tag/i }));
    const input = await screen.findByLabelText("Search tags");
    fireEvent.change(input, { target: { value: "brand-new" } });
    const create = await screen.findByRole("button", { name: /create.*brand-new/i });
    fireEvent.click(create);
    await waitFor(() => {
      const buffer = useEditorStore.getState().buffers.get("n1")!;
      expect(buffer.frontmatter.tags).toEqual(["existing", "brand-new"]);
    });
    expect(settingsMock.addLibraryTag).toHaveBeenCalledWith("brand-new");
  });

  it("removes a tag", () => {
    render(<TagsField noteId="n1" />);
    fireEvent.click(screen.getByLabelText("Remove tag existing"));
    const buffer = useEditorStore.getState().buffers.get("n1")!;
    expect(buffer.frontmatter.tags).toEqual([]);
  });
});
