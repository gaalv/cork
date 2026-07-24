#!/usr/bin/env node
/* global console, process */
// Fail the build if the gzipped size of the main entry JS chunk
// crosses the budget defined in `.specs/codebase/CONCERNS.md` (R-006).
//
// Usage: node scripts/check-bundle-size.mjs [--budget=500] [--quiet]
//   --budget   gzipped budget in KB (default: 500)
//   --quiet    only print on failure

import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.split("=");
    return [k.replace(/^--/, ""), v ?? "true"];
  }),
);

const budgetKb = Number(args.get("budget") ?? 500);
const quiet = args.get("quiet") === "true";
const distDir = join(process.cwd(), "dist", "assets");

let entries;
try {
  entries = readdirSync(distDir);
} catch (err) {
  console.error(`bundle-size: dist/assets not found. Run \`pnpm build\` first.\n${err.message}`);
  process.exit(1);
}

// The entry chunk is the one referenced by dist/index.html — lazy chunks from
// dynamic imports (mermaid internals, preview, graph) also emit index-*.js
// names and must NOT count against the entry budget.
let mains;
try {
  const html = readFileSync(join(process.cwd(), "dist", "index.html"), "utf8");
  const matches = [...html.matchAll(/assets\/(index-[^"']+\.js)/g)].map((m) => m[1]);
  mains = [...new Set(matches)].filter((name) => entries.includes(name));
} catch {
  mains = [];
}
if (mains.length === 0) {
  console.error("bundle-size: no entry index-*.js referenced by dist/index.html.");
  process.exit(1);
}

let totalRaw = 0;
let totalGzip = 0;
const rows = [];

for (const name of mains) {
  const full = join(distDir, name);
  const raw = readFileSync(full);
  const gz = gzipSync(raw, { level: 9 });
  totalRaw += raw.byteLength;
  totalGzip += gz.byteLength;
  rows.push({ name, raw: raw.byteLength, gzip: gz.byteLength });
}

const gzipKb = totalGzip / 1024;
const rawKb = totalRaw / 1024;

const status = gzipKb <= budgetKb ? "OK" : "FAIL";
if (!quiet || status === "FAIL") {
  for (const row of rows) {
    console.log(
      `  ${row.name}  raw=${(row.raw / 1024).toFixed(1)} KB  gz=${(row.gzip / 1024).toFixed(1)} KB`,
    );
  }
  console.log(
    `bundle-size: ${status}  gzipped=${gzipKb.toFixed(1)} KB  raw=${rawKb.toFixed(1)} KB  budget=${budgetKb} KB`,
  );
}

if (status === "FAIL") {
  console.error(
    `bundle-size: gzipped main chunk ${gzipKb.toFixed(1)} KB exceeds budget ${budgetKb} KB (see R-006 in .specs/codebase/CONCERNS.md).`,
  );
  process.exit(1);
}

// Touch statSync so linters keep it imported (kept for forward use).
void statSync;
