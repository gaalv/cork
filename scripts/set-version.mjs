#!/usr/bin/env node
/**
 * Sets the release version everywhere it is recorded.
 *
 * The version lives in four files that must agree: npm metadata, the Tauri
 * bundle, the Rust crate, and the manifest the app checks for updates. Bumping
 * them by hand is how they drift — a stale version.json would tell every user
 * they are up to date forever.
 *
 * Usage: node scripts/set-version.mjs 0.2.0
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("usage: node scripts/set-version.mjs <semver>   e.g. 0.2.0 or 0.2.0-rc1");
  process.exit(1);
}

/** Replace the first match of `pattern`, failing loudly if it is not found. */
function edit(relPath, pattern, replacement) {
  const path = resolve(root, relPath);
  const before = readFileSync(path, "utf8");
  const after = before.replace(pattern, replacement);
  if (after === before) {
    console.error(`✗ ${relPath}: version field not found — check the pattern`);
    process.exit(1);
  }
  writeFileSync(path, after);
  console.log(`✓ ${relPath}`);
}

edit("package.json", /"version": "[^"]+"/, `"version": "${version}"`);
edit("version.json", /"version": "[^"]+"/, `"version": "${version}"`);
edit("src-tauri/tauri.conf.json", /"version": "[^"]+"/, `"version": "${version}"`);
edit("src-tauri/Cargo.toml", /^version = "[^"]+"/m, `version = "${version}"`);

console.log(`\nVersion set to ${version}.`);
console.log("Remaining steps: date the CHANGELOG entry, commit, then tag v" + version + ".");
