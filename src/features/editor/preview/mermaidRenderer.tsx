import { useEffect, useId, useState } from "react";

export function MermaidDiagram({ source }: { source: string }) {
  const id = useId().replace(/:/g, "");
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
        const result = await mermaid.render(`noxe-mermaid-${id}`, source);
        if (!cancelled) {
          setHtml(result.svg);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, source]);

  if (error) {
    return <pre>{source}</pre>;
  }
  return <div data-testid="mermaid-diagram" dangerouslySetInnerHTML={html ? { __html: html } : undefined} />;
}
