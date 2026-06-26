import { describe, expect, it } from "vitest";

import { parse } from "./markdown";

describe("markdown parser", () => {
  it("uses filename stem as title and extracts headings", () => {
    const parsed = parse("# Title\n\n## Child\nText", "note.md");
    expect(parsed.title).toBe("note");
    expect(parsed.headings).toHaveLength(2);
    expect(parsed.headings[0]?.text).toBe("Title");
    expect(parsed.headings[1]?.level).toBe(2);
  });

  it("falls back to filename without extension", () => {
    expect(parse("Body only", "folder/My Note.md").title).toBe("My Note");
  });

  it("stores frontmatter tags as raw comma string", () => {
    expect(parse("---\ntags: dev, bad tag\n---\nBody", "a.md").frontmatter.tags).toBe(
      "dev, bad tag",
    );
  });

  it("ignores links inside fenced code blocks", () => {
    const parsed = parse("```\n[[Nope]]\n```\n[[Yes]]", "a.md");
    expect(parsed.links[0]?.targetText).toBe("Yes");
  });

  it("extracts wikilink aliases", () => {
    const parsed = parse("See [[Target Note|Alias text]] and [[Other]].", "a.md");
    expect(parsed.links).toHaveLength(2);
    expect(parsed.links[0]).toMatchObject({ targetText: "Target Note", alias: "Alias text" });
    expect(parsed.links[1]?.alias).toBeNull();
  });

  it("parses frontmatter tags from array", () => {
    expect(parse("---\ntags:\n  - dev\n  - '#rust/lang'\n---\nBody", "a.md").frontmatter.tags).toEqual([
      "dev",
      "#rust/lang",
    ]);
  });

  it("parses frontmatter tags from comma string", () => {
    expect(parse("---\ntags: dev, rust, bad tag\n---\nBody", "a.md").frontmatter.tags).toBe(
      "dev, rust, bad tag",
    );
  });

  it("handles unicode heading and nested emphasis", () => {
    const parsed = parse("# Olá **mundo _dev_**\nTexto", "a.md");
    expect(parsed.title).toBe("a");
    expect(parsed.headings[0]?.text).toBe("Olá mundo dev");
  });

  it("computes body hash from body without frontmatter", () => {
    const parsed = parse("---\ntags: dev\n---\nBody", "a.md");
    expect(parsed.body).toBe("Body");
    expect(parsed.bodyHash).toHaveLength(40);
  });
});
