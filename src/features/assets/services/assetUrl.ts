import { convertFileSrc } from "@tauri-apps/api/core";

export type ConvertFileSrc = (path: string, protocol?: string) => string;

export function assetUrl(path: string, converter: ConvertFileSrc = convertFileSrc): string {
  if (hasTauriConvertFileSrc()) {
    return converter(path, "asset");
  }
  return manualAssetUrl(path);
}

function hasTauriConvertFileSrc(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const internals = (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  return isRecord(internals) && typeof internals.convertFileSrc === "function";
}

function manualAssetUrl(path: string): string {
  const normalized = normalizeAbsolutePath(path);
  return `asset://localhost/${normalized.split("/").map(encodeURIComponent).join("/")}`;
}

function normalizeAbsolutePath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const prefix = /^[A-Za-z]:\//.test(normalized) ? normalized.slice(0, 2) : "";
  const body = prefix ? normalized.slice(2) : normalized;
  const parts: string[] = [];
  for (const part of body.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return `${prefix}/${parts.join("/")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
