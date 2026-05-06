export type ParsedHeading = {
  level: number;
  text: string;
  position: number;
};

export type ParsedLink = {
  targetText: string;
  alias: string | null;
  position: number;
};

export type ParsedNote = {
  title: string;
  body: string;
  bodyHash: string;
  tags: string[];
  links: ParsedLink[];
  headings: ParsedHeading[];
  frontmatter: Record<string, unknown>;
};

type Range = { start: number; end: number };

const tagRegex = /(^|[^A-Za-z0-9/_-])#([A-Za-z0-9][A-Za-z0-9/_-]{0,63})/g;
const linkRegex = new RegExp("\\[\\[([^\\]\\[|]+?)(?:\\|([^\\]\\[]+?))?\\]\\]", "g");

export function parse(markdown: string, filename: string): ParsedNote {
  const { frontmatter, body } = stripFrontmatter(markdown);
  const skipRanges = codeRanges(body);
  const tags = new Set<string>();
  collectFrontmatterTags(frontmatter, tags);
  collectTags(body, skipRanges, tags);
  const links = collectLinks(body, skipRanges);
  const headings = collectHeadings(body);

  return {
    title: headings.find((heading) => heading.level === 1)?.text ?? fallbackTitle(filename),
    body,
    bodyHash: sha1(body),
    tags: [...tags].sort((a, b) => a.localeCompare(b)),
    links,
    headings,
    frontmatter,
  };
}

function stripFrontmatter(markdown: string): { frontmatter: Record<string, unknown>; body: string } {
  const normalized = markdown.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) {
    return { frontmatter: {}, body: markdown };
  }
  const lineBreak = normalized.startsWith("---\r\n") ? "\r\n" : "\n";
  const endMarker = `${lineBreak}---${lineBreak}`;
  const end = normalized.indexOf(endMarker, 3);
  if (end === -1) {
    return { frontmatter: {}, body: markdown };
  }
  const yaml = normalized.slice(3 + lineBreak.length, end);
  return { frontmatter: parseSimpleYaml(yaml), body: normalized.slice(end + endMarker.length) };
}

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = /^(\w[\w-]*):\s*(.*)$/.exec(line);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    if (!key) {
      continue;
    }
    if (rawValue === "") {
      const values: string[] = [];
      while (index + 1 < lines.length) {
        const next = lines[index + 1];
        const item = /^\s*-\s*(.+)$/.exec(next);
        if (!item?.[1]) {
          break;
        }
        values.push(unquote(item[1]));
        index += 1;
      }
      result[key] = values;
    } else {
      result[key] = unquote(rawValue);
    }
  }
  return result;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function codeRanges(body: string): Range[] {
  const ranges: Range[] = [];
  let offset = 0;
  let fenceStart: number | null = null;
  for (const line of body.split(/(?<=\n)/)) {
    if (line.trimStart().startsWith("```")) {
      if (fenceStart === null) {
        fenceStart = offset;
      } else {
        ranges.push({ start: fenceStart, end: offset + line.length });
        fenceStart = null;
      }
    } else if (fenceStart !== null) {
      ranges.push({ start: offset, end: offset + line.length });
    }
    offset += line.length;
  }

  const inlineCode = /`[^`\n]+`/g;
  for (const match of body.matchAll(inlineCode)) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  return ranges;
}

function collectTags(body: string, skipRanges: Range[], tags: Set<string>): void {
  for (const match of body.matchAll(tagRegex)) {
    const prefix = match[1] ?? "";
    const tag = match[2];
    if (!tag) {
      continue;
    }
    const position = match.index + prefix.length;
    if (!isSkipped(position, skipRanges)) {
      tags.add(tag);
    }
  }
}

function collectLinks(body: string, skipRanges: Range[]): ParsedLink[] {
  const links: ParsedLink[] = [];
  for (const match of body.matchAll(linkRegex)) {
    if (isSkipped(match.index, skipRanges) || !match[1]) {
      continue;
    }
    links.push({
      targetText: match[1].trim(),
      alias: match[2]?.trim() ?? null,
      position: match.index,
    });
  }
  return links;
}

function collectHeadings(body: string): ParsedHeading[] {
  const headings: ParsedHeading[] = [];
  let offset = 0;
  let inFence = false;
  for (const line of body.split(/(?<=\n)/)) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      offset += line.length;
      continue;
    }
    if (!inFence) {
      const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line.trimEnd());
      if (match?.[1] && match[2]) {
        headings.push({ level: match[1].length, text: normalizeInline(match[2]), position: offset });
      }
    }
    offset += line.length;
  }
  return headings;
}

function collectFrontmatterTags(frontmatter: Record<string, unknown>, tags: Set<string>): void {
  const value = frontmatter.tags;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") {
        addValidTag(item, tags);
      }
    }
  } else if (typeof value === "string") {
    for (const item of value.split(",")) {
      addValidTag(item, tags);
    }
  }
}

function addValidTag(value: string, tags: Set<string>): void {
  const tag = value.trim().replace(/^#/, "");
  if (/^[A-Za-z0-9][A-Za-z0-9/_-]{0,63}$/.test(tag)) {
    tags.add(tag);
  }
}

function normalizeInline(value: string): string {
  return value
    .replace(/[`*_~]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

function fallbackTitle(filename: string): string {
  return (filename.split("/").pop() ?? filename).replace(/\.md$/i, "").trim();
}

function isSkipped(position: number, ranges: Range[]): boolean {
  return ranges.some((range) => position >= range.start && position < range.end);
}

function sha1(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const words = bytesToWords(bytes);
  const bitLength = bytes.length * 8;
  words[bitLength >> 5] |= 0x80 << (24 - (bitLength % 32));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  for (let i = 0; i < words.length; i += 16) {
    const w = Array.from({ length: 80 }, (_, index) => words[i + index] ?? 0);
    for (let t = 16; t < 80; t += 1) {
      w[t] = rotateLeft(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let t = 0; t < 80; t += 1) {
      const { f, k } = sha1Round(t, b, c, d);
      const temp = (rotateLeft(a, 5) + f + e + k + (w[t] ?? 0)) >>> 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  return [h0, h1, h2, h3, h4].map((word) => word.toString(16).padStart(8, "0")).join("");
}

function bytesToWords(bytes: Uint8Array): number[] {
  const words: number[] = [];
  bytes.forEach((byte, index) => {
    words[index >> 2] = (words[index >> 2] ?? 0) | (byte << (24 - (index % 4) * 8));
  });
  return words;
}

function sha1Round(t: number, b: number, c: number, d: number): { f: number; k: number } {
  if (t < 20) {
    return { f: (b & c) | (~b & d), k: 0x5a827999 };
  }
  if (t < 40) {
    return { f: b ^ c ^ d, k: 0x6ed9eba1 };
  }
  if (t < 60) {
    return { f: (b & c) | (b & d) | (c & d), k: 0x8f1bbcdc };
  }
  return { f: b ^ c ^ d, k: 0xca62c1d6 };
}

function rotateLeft(value: number, bits: number): number {
  return (value << bits) | (value >>> (32 - bits));
}
