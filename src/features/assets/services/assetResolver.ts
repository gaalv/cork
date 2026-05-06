export type AssetResolveResult =
  | { status: "resolved"; path: string; url: string }
  | { status: "blocked"; reason: "outside-vault" | "unsupported-url"; path: string }
  | { status: "missing"; path: string };

export type ResolveAssetOptions = {
  exists?: (path: string) => boolean;
  toUrl?: (path: string) => string;
};

export function resolveAssetSrc(
  linkPath: string,
  currentNotePath: string,
  vaultRoot: string,
  options: ResolveAssetOptions = {},
): AssetResolveResult {
  const trimmed = linkPath.trim();
  if (isRemoteUrl(trimmed) || isDataUrl(trimmed)) {
    return { status: "resolved", path: trimmed, url: trimmed };
  }
  if (trimmed.startsWith("file://") || trimmed.includes("://")) {
    return { status: "blocked", reason: "unsupported-url", path: trimmed };
  }

  const normalizedVault = normalizeAbsolutePath(vaultRoot);
  const currentDir = dirname(normalizeAbsolutePath(currentNotePath));
  const candidate = isAbsolutePath(trimmed) ? normalizeAbsolutePath(trimmed) : normalizeAbsolutePath(joinPath(currentDir, trimmed));

  if (!isInsidePath(candidate, normalizedVault)) {
    return { status: "blocked", reason: "outside-vault", path: candidate };
  }
  if (options.exists && !options.exists(candidate)) {
    return { status: "missing", path: candidate };
  }

  return {
    status: "resolved",
    path: candidate,
    url: options.toUrl ? options.toUrl(candidate) : toAssetProtocolUrl(candidate),
  };
}

export function toAssetProtocolUrl(path: string): string {
  return `asset://localhost/${encodePathSegments(normalizeAbsolutePath(path))}`;
}

function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isDataUrl(value: string): boolean {
  return /^data:/i.test(value);
}

function isAbsolutePath(value: string): boolean {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
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

function joinPath(base: string, child: string): string {
  return `${base.replace(/\/$/, "")}/${child}`;
}

function dirname(path: string): string {
  const normalized = normalizeAbsolutePath(path);
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? "/" : normalized.slice(0, index);
}

function isInsidePath(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root.replace(/\/$/, "")}/`);
}

function encodePathSegments(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
