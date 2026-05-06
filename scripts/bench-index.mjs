/* global console, process */
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const noteCount = Number.parseInt(process.argv[2] ?? "1000", 10);
const root = join(process.cwd(), "target", "bench-index-vault");
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });

for (let index = 0; index < noteCount; index += 1) {
  const folder = join(root, `folder-${index % 10}`);
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, `note-${index}.md`),
    `# Note ${index}\n\nBody for #tag/${index % 5} with [[Note ${(index + 1) % noteCount}|next]].\n`,
  );
}

const buildStart = performance.now();
const index = buildIndex(root);
const buildMs = performance.now() - buildStart;

const updatePath = join(root, "folder-9", `note-${noteCount - 1}.md`);
const samples = [];
for (let sample = 0; sample < 25; sample += 1) {
  writeFileSync(updatePath, `# Note ${noteCount - 1}\n\nUpdated ${sample} #tag/updated [[Note 0]].\n`);
  const start = performance.now();
  upsert(index, updatePath);
  samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
const p50 = percentile(samples, 0.5);
const p95 = percentile(samples, 0.95);
const output = {
  notes: noteCount,
  build_ms: Math.round(buildMs),
  incremental_ms_p50: round(p50),
  incremental_ms_p95: round(p95),
};
console.log(JSON.stringify(output, null, 2));

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Index bench\n\n- build_ms: ${output.build_ms}\n- incremental_ms_p50: ${output.incremental_ms_p50}\n- incremental_ms_p95: ${output.incremental_ms_p95}\n`,
  );
}

function buildIndex(vaultRoot) {
  const rows = new Map();
  for (const file of markdownFiles(vaultRoot)) {
    upsert(rows, file);
  }
  return rows;
}

function upsert(rows, file) {
  const body = readFileSync(file, "utf8");
  const metadata = statSync(file);
  rows.set(file, {
    path: file,
    title: /^#\s+(.+)$/m.exec(body)?.[1] ?? file.replace(/\.md$/i, ""),
    tags: [...body.matchAll(/(^|[^A-Za-z0-9/_-])#([A-Za-z0-9][A-Za-z0-9/_-]{0,63})/g)].map((match) => match[2]),
    links: [...body.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)].map((match) => match[1]),
    mtime: metadata.mtimeMs,
    size: metadata.size,
  });
}

function markdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return markdownFiles(path);
    }
    return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
  });
}

function percentile(values, fraction) {
  const index = Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1);
  return values[index] ?? 0;
}

function round(value) {
  return Math.round(value * 100) / 100;
}
