import { describe, expect, it } from "vitest";

import { parse } from "./markdown";

describe("markdown parser", () => {
  it("extracts first h1 title and headings", () => {
    const parsed = parse("# Title\n\n## Child\nText", "note.md");
    expect(parsed.title).toBe("Title");
    expect(parsed.headings).toHaveLength(2);
    expect(parsed.headings[1]?.level).toBe(2);
  });

  it("falls back to filename without extension", () => {
    expect(parse("Body only", "folder/My Note.md").title).toBe("My Note");
  });

  it("extracts body tags and sorts deduplicates", () => {
    expect(parse("#x #dev/rust and #x #todo-list", "a.md").tags).toEqual(["dev/rust", "todo-list", "x"]);
  });

  it("rejects frontmatter tags with spaces", () => {
    expect(parse("---\ntags: dev, bad tag\n---\nBody #ok", "a.md").tags).toEqual(["dev", "ok"]);
  });

  it("ignores tags and links inside fenced code blocks", () => {
    const parsed = parse("```\n#code [[Nope]]\n```\n#real [[Yes]]", "a.md");
    expect(parsed.tags).toEqual(["real"]);
    expect(parsed.links[0]?.targetText).toBe("Yes");
  });

  it("ignores inline code tags", () => {
    const parsed = parse("`#code [[Nope]]` #real", "a.md");
    expect(parsed.tags).toEqual(["real"]);
    expect(parsed.links).toHaveLength(0);
  });

  it("extracts wikilink aliases", () => {
    const parsed = parse("See [[Target Note|Alias text]] and [[Other]].", "a.md");
    expect(parsed.links).toHaveLength(2);
    expect(parsed.links[0]).toMatchObject({ targetText: "Target Note", alias: "Alias text" });
    expect(parsed.links[1]?.alias).toBeNull();
  });

  it("parses frontmatter tags from array", () => {
    expect(parse("---\ntags:\n  - dev\n  - '#rust/lang'\n---\nBody", "a.md").tags).toEqual(["dev", "rust/lang"]);
  });

  it("parses frontmatter tags from comma string", () => {
    expect(parse("---\ntags: dev, rust, bad tag\n---\nBody", "a.md").tags).toEqual(["dev", "rust"]);
  });

  it("handles unicode heading and nested emphasis", () => {
    const parsed = parse("# Olá **mundo _dev_**\nTexto", "a.md");
    expect(parsed.title).toBe("Olá mundo dev");
  });

  it("computes body hash from body without frontmatter", () => {
    const parsed = parse("---\ntags: dev\n---\nBody", "a.md");
    expect(parsed.body).toBe("Body");
    expect(parsed.bodyHash).toHaveLength(40);
  });
});
