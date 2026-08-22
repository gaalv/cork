/**
 * Asset resolver — converts vault-relative image paths to Tauri asset protocol URLs.
 *
 * @see F11 — Assets & Images spec (ASSET-01, ASSET-02)
 */

import { convertFileSrc } from "@tauri-apps/api/core";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"]);

/** Returns true if the path points to an image based on extension. */
export function isImagePath(filePath: string): boolean {
  // Inline images carry their type in the URI, not in a file extension.
  if (filePath.startsWith("data:image/")) return true;
  // Ignore any query string or fragment before reading the extension.
  const clean = filePath.split(/[?#]/)[0];
  const ext = clean.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXT.has(ext);
}

/**
 * Folders that, by convention, live at the vault root rather than beside a
 * note. `assets_write_attachment` writes to `_attachments/` at the root and
 * returns a root-relative path, and Obsidian vaults use the same shape.
 */
const ROOT_ATTACHMENT_DIRS = new Set([
  "_attachments",
  "attachments",
  "assets",
  "media",
  "files",
  "images",
]);

/**
 * Every place a Markdown `src` could point, best guess first.
 *
 * A bare path like `_attachments/shot.png` is genuinely ambiguous: it may be
 * relative to the note's folder or to the vault root. The backend hands back
 * root-relative paths, but the resolver only ever tried note-relative — so a
 * pasted image rendered in a root note and silently 404'd in any note inside a
 * folder. Return both and let the caller fall back.
 */
export function resolveAssetCandidates(
  src: string,
  vaultRoot: string,
  noteRelDir: string,
): string[] {
  // Pass through remote URLs and data URIs
  if (/^https?:\/\//i.test(src) || src.startsWith("data:")) {
    return [src];
  }

  // Already resolved
  if (src.startsWith("asset://") || src.startsWith("https://asset.localhost/")) {
    return [src];
  }

  const noteRelative = resolveRelativePath(noteRelDir, src);
  const rootRelative = resolveRelativePath("", src);

  // An explicitly relative path (`./x`, `../x`) is never root-relative.
  const explicitlyRelative = src.startsWith(".");
  const firstSegment = src.split("/")[0];
  const looksRooted = !explicitlyRelative && ROOT_ATTACHMENT_DIRS.has(firstSegment);

  const ordered = looksRooted ? [rootRelative, noteRelative] : [noteRelative, rootRelative];

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const candidate of ordered) {
    // Block path traversal outside the vault
    if (candidate.startsWith("..") || candidate.startsWith("/")) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    urls.push(convertFileSrc(`${vaultRoot}/${candidate}`));
  }
  return urls;
}

/**
 * Resolves a Markdown image/link `src` to a Tauri asset protocol URL.
 *
 * Returns the single best guess. Prefer `resolveAssetCandidates` where the
 * consumer can retry (an `<img>` with an error handler), since the note- vs
 * root-relative question cannot be settled without touching the filesystem.
 */
export function resolveAssetSrc(src: string, vaultRoot: string, noteRelDir: string): string | null {
  return resolveAssetCandidates(src, vaultRoot, noteRelDir)[0] ?? null;
}

/**
 * Resolves a relative path against a base directory.
 * Normalizes `.` and `..` segments.
 */
function resolveRelativePath(baseDir: string, relativePath: string): string {
  // If the path starts from vault root (e.g. _attachments/img.png), use as-is
  if (!relativePath.startsWith(".") && !relativePath.startsWith("/")) {
    // Could be relative to note dir or vault root — resolve against note dir
    const parts = [...baseDir.split("/").filter(Boolean), ...relativePath.split("/")];
    return normalizeParts(parts);
  }

  if (relativePath.startsWith("/")) {
    return relativePath.slice(1);
  }

  const parts = [...baseDir.split("/").filter(Boolean), ...relativePath.split("/")];
  return normalizeParts(parts);
}

function normalizeParts(parts: string[]): string {
  const stack: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      if (stack.length > 0 && stack[stack.length - 1] !== "..") {
        stack.pop();
      } else {
        stack.push("..");
      }
    } else {
      stack.push(part);
    }
  }
  return stack.join("/");
}
