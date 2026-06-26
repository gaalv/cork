import { useCallback, useMemo } from "react";
import { EditorView } from "@codemirror/view";
import { ListBullets } from "@phosphor-icons/react";

import { useEditorStore } from "@/features/editor/state/editorStore";
import { getEditorView } from "@/features/editor/cm/viewRef";
import { SectionHeader } from "./helpers";

type Heading = { level: number; text: string; lineNumber: number };

export function OutlineSection() {
  const body = useEditorStore((s) => s.body);

  const headings = useMemo<Heading[]>(() => {
    if (!body) return [];
    const result: Heading[] = [];
    const lines = body.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        result.push({ level: match[1].length, text: match[2].trim(), lineNumber: i + 1 });
      }
    }
    return result;
  }, [body]);

  const scrollToLine = useCallback((lineNumber: number, heading: Heading) => {
    // Editor mode: scroll CodeMirror
    const view = getEditorView();
    if (view) {
      const line = view.state.doc.line(lineNumber);
      view.dispatch({
        effects: EditorView.scrollIntoView(line.from, { y: "start" }),
        selection: { anchor: line.from },
      });
      view.focus();
      return;
    }

    // Preview mode: scroll to the matching heading element
    const previewEl = document.querySelector(".cork-preview-scroll");
    if (!previewEl) return;
    const tag = `h${heading.level}`;
    const candidates = previewEl.querySelectorAll(tag);
    for (const el of candidates) {
      if (el.textContent?.trim() === heading.text) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
  }, []);

  if (headings.length === 0) {
    return (
      <section>
        <SectionHeader icon={<ListBullets size={14} />} title="Sumário" />
        <p className="text-[11px] text-[var(--color-cork-subtle)]">No headings found</p>
      </section>
    );
  }

  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <section>
      <SectionHeader icon={<ListBullets size={14} />} title="Sumário" />
      <nav className="flex flex-col gap-0.5">
        {headings.map((h, i) => (
          <button
            key={`${h.lineNumber}-${i}`}
            onClick={() => scrollToLine(h.lineNumber, h)}
            className="truncate rounded px-2 py-0.5 text-left text-[12px] text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
            style={{ paddingLeft: `${(h.level - minLevel) * 12 + 8}px` }}
            title={h.text}
          >
            {h.text}
          </button>
        ))}
      </nav>
    </section>
  );
}
