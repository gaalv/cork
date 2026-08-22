/**
 * Tracks the on-screen rectangle of the element a tour step points at.
 *
 * Re-measures on resize and scroll: the spotlight is drawn in viewport
 * coordinates, so any layout shift would otherwise leave the cutout behind.
 */

import { useEffect, useState } from "react";

export type Rect = { top: number; left: number; width: number; height: number };

export function useTourTarget(target: string | null): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }

    const measure = () => {
      const el = document.querySelector(`[data-tour="${target}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    // Layout can settle a frame after mount (fonts, virtualised lists).
    const raf = requestAnimationFrame(measure);

    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      cancelAnimationFrame(raf);
    };
  }, [target]);

  return rect;
}
