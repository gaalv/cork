export type OutlineItem = {
  id: string;
  depth: number;
  text: string;
  line: number;
};

const headingPattern = /^(#{1,6})\s+(.+)$/;

export function deriveOutline(markdown: string): OutlineItem[] {
  return markdown.split("\n").flatMap((line, index) => {
    const match = headingPattern.exec(line.trim());
    if (!match) {
      return [];
    }
    const text = (match[2] ?? "").replace(/#+$/, "").trim();
    if (!text) {
      return [];
    }
    return [{ id: `${index + 1}-${slugify(text)}`, depth: match[1]?.length ?? 1, text, line: index + 1 }];
  });
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "heading";
}
