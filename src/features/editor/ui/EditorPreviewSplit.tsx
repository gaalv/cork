import { useEffect, useMemo, useRef, useState } from "react";

import { useEditorStore } from "@/features/editor/state/editorStore";

import { Editor } from "./Editor";
import { Preview } from "./Preview";

const LARGE_FILE_BYTES = 1024 * 1024;

export function EditorPreviewSplit() {
  const [previewOpen, setPreviewOpen] = useState(true);
  const previewRef = useRef<HTMLElement | null>(null);
  const buffer = useEditorStore((state) => (state.activeNoteId ? state.buffers.get(state.activeNoteId) : null));
  const degraded = (buffer?.body.length ?? 0) > LARGE_FILE_BYTES;
  const previewMarkdown = useMemo(() => (degraded ? stripHeavyBlocks(buffer?.body ?? "") : undefined), [buffer?.body, degraded]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ".") {
        event.preventDefault();
        setPreviewOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-2" data-testid="editor-preview-split">
      <Editor className="min-h-0" />
      {previewOpen ? (
        <aside ref={previewRef} aria-label="Markdown preview pane" className="min-h-0 overflow-auto border-l pl-3">
          {degraded ? <p role="status">Large file mode: Mermaid and KaTeX are disabled.</p> : null}
          <Preview markdown={previewMarkdown} />
        </aside>
      ) : null}
    </div>
  );
}

function stripHeavyBlocks(markdown: string) {
  return markdown.replace(/```mermaid[\s\S]*?```/g, "```\nMermaid disabled in large-file mode.\n```").replace(/\$\$[\s\S]*?\$\$/g, "");
}
