/**
 * Asset resolver — converts vault-relative image paths to Tauri asset protocol URLs.
 *
 * @see F11 — Assets & Images spec (ASSET-01, ASSET-02)
 */

import { convertFileSrc } from "@tauri-apps/api/core";

const IMAGE_EXT = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif",
]);

/** Returns true if the path points to an image based on extension. */
export function isImagePath(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXT.has(ext);
}

/**
 * Resolves a Markdown image/link `src` to a Tauri asset protocol URL.
 *
 * - Absolute URLs (http/https/data) are returned as-is.
 * - Vault-relative paths are joined with vaultRoot and converted via `convertFileSrc`.
 * - Paths that escape the vault (via `..`) are blocked and return `null`.
 */
export function resolveAssetSrc(
  src: string,
  vaultRoot: string,
  noteRelDir: string,
): string | null {
  // Pass through remote URLs and data URIs
  if (/^https?:\/\//i.test(src) || src.startsWith("data:")) {
    return src;
  }

  // Already resolved
  if (src.startsWith("asset://") || src.startsWith("https://asset.localhost/")) {
    return src;
  }

  // Resolve relative path against the note's directory within the vault
  const resolved = resolveRelativePath(noteRelDir, src);

  // Block path traversal outside vault
  if (resolved.startsWith("..") || resolved.startsWith("/")) {
    return null;
  }

  const absolutePath = `${vaultRoot}/${resolved}`;
  return convertFileSrc(absolutePath);
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
