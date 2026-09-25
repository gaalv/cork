/**
 * ImageLightbox — full-screen viewer for an inline note image.
 *
 * Opened by the CodeMirror image preview widget (`src/cm/imagePreview.ts`) when
 * an image is clicked. Dismisses on Escape, backdrop click, or the close button.
 *
 * @see F11 — Assets & Images spec
 */

import { useEffect } from "react";
import { X } from "@phosphor-icons/react";

import { useLightboxStore } from "@/stores/lightboxStore";

export function ImageLightbox() {
  const src = useLightboxStore((state) => state.src);
  const alt = useLightboxStore((state) => state.alt);
  const close = useLightboxStore((state) => state.close);

  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    // Capture so Escape closes the lightbox before other Escape handlers run.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [src, close]);

  if (!src) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Image preview"}
      onClick={close}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--color-cork-ink)]/80 p-8 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close image preview"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <X size={18} weight="bold" />
      </button>
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-h-full max-w-full cursor-zoom-out rounded-lg object-contain shadow-2xl"
      />
    </div>
  );
}
