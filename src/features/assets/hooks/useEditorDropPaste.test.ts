import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createEditorDropPasteExtension } from "./useEditorDropPaste";

function dispatchDrop(view: EditorView, files: File[]) {
  const event = new Event("drop", { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, "dataTransfer", { value: { files } });
  Object.defineProperty(event, "clientX", { value: 0 });
  Object.defineProperty(event, "clientY", { value: 0 });
  view.contentDOM.dispatchEvent(event);
  return event;
}

describe("createEditorDropPasteExtension", () => {
  it("writes dropped images and inserts markdown at the cursor", async () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const ingestDropImage = vi.fn<(file: File) => Promise<string>>().mockResolvedValue("![logo](attachments/logo.png)");
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "Hello ",
        selection: { anchor: 6 },
        extensions: [
          createEditorDropPasteExtension({
            getContext: () => ({ currentNotePath: "/vault/note.md", vaultRoot: "/vault" }),
            ingestDropImage,
          }),
        ],
      }),
    });

    const event = dispatchDrop(view, [new File(["image"], "logo.png", { type: "image/png" })]);

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(view.state.doc.toString()).toBe("![logo](attachments/logo.png)Hello "));
    expect(ingestDropImage).toHaveBeenCalledWith(expect.objectContaining({ name: "logo.png" }), expect.any(Object));
    view.destroy();
  });

  it("ignores drops without image files", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const ingestDropImage = vi.fn<(file: File) => Promise<string>>();
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "Hello",
        extensions: [
          createEditorDropPasteExtension({
            getContext: () => ({ currentNotePath: "/vault/note.md", vaultRoot: "/vault" }),
            ingestDropImage,
          }),
        ],
      }),
    });

    dispatchDrop(view, [new File(["text"], "note.txt", { type: "text/plain" })]);

    expect(view.state.doc.toString()).toBe("Hello");
    expect(ingestDropImage).not.toHaveBeenCalled();
    view.destroy();
  });
});
