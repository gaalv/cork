import { resolveAssetSrc } from "@/features/assets/services/assetResolver";

import type { ComponentProps } from "react";

type AssetImageProps = ComponentProps<"img"> & {
  currentNotePath?: string;
  vaultRoot?: string | null;
  exists?: (path: string) => boolean;
};

export function AssetImage({ currentNotePath, vaultRoot, exists, src, alt, ...props }: AssetImageProps) {
  if (!src || !currentNotePath || !vaultRoot) {
    return <img src={src} alt={alt ?? ""} loading="lazy" {...props} />;
  }

  const resolved = resolveAssetSrc(src, currentNotePath, vaultRoot, { exists });
  if (resolved.status === "resolved") {
    return <img src={resolved.url} alt={alt ?? ""} loading="lazy" {...props} />;
  }

  if (resolved.status === "blocked") {
    return <AssetImagePlaceholder alt={alt} message="External path blocked" title={resolved.path} />;
  }

  return <AssetImagePlaceholder alt={alt} message={`File not found: ${src}`} title={`File not found: ${src}`} />;
}

function AssetImagePlaceholder({ alt, message, title }: { alt?: string; message: string; title: string }) {
  return (
    <span
      role="img"
      aria-label={alt ? `${alt}: ${message}` : message}
      title={title}
      className="inline-flex rounded border border-dashed border-[var(--color-noxe-border-strong)] px-2 py-1 text-sm text-[var(--color-noxe-muted)]"
      data-asset-placeholder="image"
    >
      {alt ? `${alt} — ${message}` : message}
    </span>
  );
}
