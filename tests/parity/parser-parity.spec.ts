import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { parse } from "@/shared/parsers/markdown";

type NormalizedAst = {
  file: string;
  title: string;
  frontmatter: Record<string, unknown>;
  links: Array<{ targetText: string; alias: string | null; position: number }>;
  headings: Array<{ level: number; text: string; position: number }>;
  markdownExtensions: Array<{ kind: string; value: string; position: number }>;
};

describe("parser parity fixtures", () => {
  it("matches the committed AST snapshot", () => {
    const output = collectFixtureAsts();
    expect(output).toHaveLength(18);
    expect(output).toMatchSnapshot();
    if (process.env.CORK_PARITY_EXPORT === "1") {
      const path = join(process.cwd(), "target", "parser-parity-ts.json");
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(output, null, 2)}\n`);
    }
  });
});

function collectFixtureAsts(): NormalizedAst[] {
  const fixtureDir = join(process.cwd(), "tests", "fixtures", "parity");
  return readdirSync(fixtureDir)
    .filter((file) => file.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => {
      const body = readFileSync(join(fixtureDir, file), "utf8");
      const parsed = parse(body, file);
      return {
        file,
        title: parsed.title,
        frontmatter: parsed.frontmatter,
        links: parsed.links,
        headings: parsed.headings,
        markdownExtensions: parsed.markdownExtensions,
      };
    });
}
