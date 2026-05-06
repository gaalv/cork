import { openPath } from "@tauri-apps/plugin-opener";

import { resolveAssetSrc } from "./assetResolver";

export const SAFE_OPEN_EXT = new Set(["pdf", "txt", "csv", "json", "mp4", "mov", "mp3", "wav", "zip", "docx", "xlsx", "pptx"]);

export type OpenAssetResult =
  | { status: "opened"; path: string }
  | { status: "blocked"; reason: "outside-vault" | "unsupported-url"; path: string }
  | { status: "missing"; path: string }
  | { status: "confirmation-required"; path: string; fileName: string };

export type OpenAssetOptions = {
  exists?: (path: string) => boolean;
  opener?: (path: string) => Promise<void>;
  confirmUnsafe?: (path: string) => Promise<boolean> | boolean;
};

export async function openAsset(
  linkPath: string,
  currentNotePath: string,
  vaultRoot: string,
  options: OpenAssetOptions = {},
): Promise<OpenAssetResult> {
  const resolved = resolveAssetSrc(linkPath, currentNotePath, vaultRoot, {
    exists: options.exists,
    toUrl: (path) => path,
  });

  if (resolved.status === "blocked" || resolved.status === "missing") {
    return resolved;
  }
  if (/^https?:\/\//i.test(resolved.path) || /^data:/i.test(resolved.path)) {
    return { status: "blocked", reason: "unsupported-url", path: resolved.path };
  }

  const extension = fileExtension(resolved.path);
  if (!SAFE_OPEN_EXT.has(extension)) {
    const approved = options.confirmUnsafe ? await options.confirmUnsafe(resolved.path) : false;
    if (!approved) {
      return { status: "confirmation-required", path: resolved.path, fileName: fileName(resolved.path) };
    }
  }

  await (options.opener ?? openPath)(resolved.path);
  return { status: "opened", path: resolved.path };
}

function fileExtension(path: string): string {
  const name = fileName(path);
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index + 1).toLowerCase();
}

function fileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}
