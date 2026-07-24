/**
 * MarkdownPreview — renders the note body as styled HTML.
 *
 * Uses unified/remark/rehype pipeline with GFM, math (KaTeX),
 * callouts, footnotes, and Mermaid diagram support.
 * Wikilinks render as styled bold text (navigable in editor mode).
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type ComponentPropsWithoutRef,
} from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import rehypeReact from "rehype-react";
import mermaid from "mermaid";

import { useEditorStore } from "@/stores/editorStore";
import { useVaultStore } from "@/stores/vaultStore";
import { createMarkdownPipeline, preprocessMarkdown } from "@/utils/markdownProcessor";

// Initialize mermaid once
mermaid.initialize({
  startOnLoad: false,
  theme: "neutral",
  fontFamily: "var(--font-sans)",
  securityLevel: "strict",
});

/** Mermaid diagram component — renders fenced ```mermaid blocks. */
function MermaidBlock({ children }: { children?: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const code =
    typeof children === "string"
      ? children
      : Array.isArray(children)
        ? children.map(String).join("")
        : String(children ?? "");

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
    mermaid.render(id, code.trim()).then(
      ({ svg: rendered }) => {
        if (!cancelled) setSvg(rendered);
      },
      (err) => {
        if (!cancelled) setError(String(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <pre className="rounded-md border border-[var(--color-cork-danger-tint)] bg-[var(--color-cork-danger-tint)] px-3 py-2 text-[12px] text-[var(--color-cork-danger)]">
        Mermaid error: {error}
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="py-4 text-center text-[12px] text-[var(--color-cork-muted)]">
        Rendering diagram...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Interactive checkbox that toggles the task in the source markdown. */
function TaskCheckbox(props: ComponentPropsWithoutRef<"input"> & Record<string, unknown>) {
  const cbIndex = Number(props["data-cb-index"] ?? -1);

  const handleChange = () => {
    if (cbIndex < 0) return;

    const { body, updateBody } = useEditorStore.getState();
    const re = /^(\s*[-*+]\s)\[([ xX])\]/gm;
    let match: RegExpExecArray | null;
    let seen = 0;

    while ((match = re.exec(body)) !== null) {
      if (seen === cbIndex) {
        const isChecked = match[2] !== " ";
        const replacement = `${match[1]}[${isChecked ? " " : "x"}]`;
        const updated =
          body.slice(0, match.index) + replacement + body.slice(match.index + match[0].length);
        updateBody(updated);
        return;
      }
      seen++;
    }
  };

  return <input {...props} disabled={false} onChange={handleChange} />;
}

/** Custom <pre> that intercepts mermaid code blocks. */
function PreBlock({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
  // children is a <code> element for fenced blocks
  const child = children as
    | React.ReactElement<{ className?: string; children?: React.ReactNode }>
    | undefined;
  if (
    child &&
    typeof child === "object" &&
    "props" in child &&
    typeof child.props?.className === "string" &&
    child.props.className.includes("language-mermaid")
  ) {
    return <MermaidBlock>{child.props.children}</MermaidBlock>;
  }
  return <pre {...props}>{children}</pre>;
}

function createProcessor(vaultRoot: string | null, noteRelDir: string) {
  return createMarkdownPipeline(vaultRoot, noteRelDir).use(rehypeReact, {
    jsx,
    jsxs,
    Fragment,
    components: {
      pre: PreBlock,
      input: TaskCheckbox,
    },
  } as Parameters<typeof rehypeReact>[0]);
}

export function MarkdownPreview() {
  const body = useEditorStore((s) => s.body);
  const notePath = useEditorStore((s) => s.path);
  const vaultRoot = useVaultStore((s) => s.path);
  const [content, setContent] = useState<React.ReactNode>(null);

  // Derive the note's relative directory within the vault
  const noteRelDir = useMemo(() => {
    if (!notePath) return "";
    const parts = notePath.split("/");
    parts.pop(); // remove filename
    return parts.join("/");
  }, [notePath]);

  // Pre-process wikilinks and callouts before parsing
  const processed = useMemo(() => preprocessMarkdown(body), [body]);

  useEffect(() => {
    let cancelled = false;
    const processor = createProcessor(vaultRoot, noteRelDir);
    processor.process(processed).then((file: { result: React.ReactNode }) => {
      if (!cancelled) setContent(file.result as React.ReactNode);
    });
    return () => {
      cancelled = true;
    };
  }, [processed, vaultRoot, noteRelDir]);

  return (
    <div className="cork-preview-scroll absolute inset-0 overflow-y-auto">
      <article className="cork-preview px-[max(2.5rem,7%)] py-6">{content}</article>
    </div>
  );
}
