import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

import { useEditorStore } from "@/features/editor/state/editorStore";
import { baseRehypePlugins, baseRemarkPlugins } from "@/features/editor/preview/plugins";
import { MermaidDiagram } from "@/features/editor/preview/mermaidRenderer";
import { highlightCode } from "@/features/editor/preview/shikiHighlighter";

import type { ComponentProps } from "react";

type PreviewProps = {
  noteId?: string;
  markdown?: string;
  onWikilinkClick?: (target: string) => void;
};

export function Preview({ noteId, markdown, onWikilinkClick }: PreviewProps) {
  const activeNoteId = useEditorStore((state) => state.activeNoteId);
  const resolvedNoteId = noteId ?? activeNoteId;
  const buffer = useEditorStore((state) => (resolvedNoteId ? state.buffers.get(resolvedNoteId) : null));
  const updateBody = useEditorStore((state) => state.updateBody);
  const source = markdown ?? buffer?.body ?? "";
  const components = useMemo(
    () => ({
      h1: heading("h1"),
      h2: heading("h2"),
      h3: heading("h3"),
      a: ({ href, children, ...props }: ComponentProps<"a">) => {
        if (href?.startsWith("/wiki/")) {
          const target = decodeURIComponent(href.slice("/wiki/".length));
          return (
            <button type="button" data-wikilink={target} onClick={() => onWikilinkClick?.(target)}>
              {children}
            </button>
          );
        }
        return (
          <a href={href} {...props}>
            {children}
          </a>
        );
      },
      code: ({ children, className }: ComponentProps<"code">) => {
        const match = /language-([\w-]+)/.exec(className ?? "");
        if (!match) {
          return <code className={className}>{children}</code>;
        }
        const lang = match[1] ?? "text";
        if (lang === "mermaid") {
          return <MermaidDiagram source={childrenToText(children)} />;
        }
        return <HighlightedCode code={childrenToText(children)} lang={lang} />;
      },
      input: ({ checked, type, ...props }: ComponentProps<"input">) => {
        if (type !== "checkbox") {
          return <input checked={checked} type={type} {...props} />;
        }
        return (
          <input
            aria-label="Toggle task"
            checked={checked}
            type="checkbox"
            onChange={() => {
              if (resolvedNoteId) {
                updateBody(resolvedNoteId, toggleFirstTask(source, Boolean(checked)));
              }
            }}
          />
        );
      },
    }),
    [onWikilinkClick, resolvedNoteId, source, updateBody],
  );

  return (
    <article className="prose" data-testid="markdown-preview">
      <ReactMarkdown remarkPlugins={baseRemarkPlugins} rehypePlugins={baseRehypePlugins} components={components}>
        {source}
      </ReactMarkdown>
    </article>
  );
}

function heading(Tag: "h1" | "h2" | "h3") {
  return function Heading({ children, ...props }: ComponentProps<typeof Tag>) {
    const text = childrenToText(children);
    return (
      <Tag id={slugify(text)} data-outline-id={slugify(text)} {...props}>
        {children}
      </Tag>
    );
  };
}

function childrenToText(children: ComponentProps<"h1">["children"]): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(childrenToText).join("");
  }
  return "";
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toggleFirstTask(source: string, checked: boolean) {
  return source.replace(checked ? /- \[x\]/ : /- \[ \]/, checked ? "- [ ]" : "- [x]");
}

function HighlightedCode({ code, lang }: { code: string; lang: string }) {
  const [html, setHtml] = useState<string>(`<pre><code>${code}</code></pre>`);

  useEffect(() => {
    let cancelled = false;
    void highlightCode(code, lang).then((nextHtml) => {
      if (!cancelled) {
        setHtml(nextHtml);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  return <span data-shiki-code dangerouslySetInnerHTML={{ __html: html }} />;
}
