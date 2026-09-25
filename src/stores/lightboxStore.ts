/**
 * Lightbox store — holds the image currently opened for full-screen viewing.
 *
 * The inline image preview widget (`src/cm/imagePreview.ts`) opens the lightbox
 * imperatively on click; the `ImageLightbox` overlay in `Shell` reads it.
 *
 * @see F11 — Assets & Images spec
 */

import { create } from "zustand";

type LightboxState = {
  /** Resolved asset URL of the open image, or null when closed. */
  src: string | null;
  /** Optional alt/caption text carried from the markdown. */
  alt: string;
  open: (src: string, alt?: string) => void;
  close: () => void;
};

export const useLightboxStore = create<LightboxState>((set) => ({
  src: null,
  alt: "",
  open: (src, alt = "") => set({ src, alt }),
  close: () => set({ src: null, alt: "" }),
}));
