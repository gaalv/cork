import { useCallback, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const NO_DRAG_SELECTOR = [
  "button",
  "input",
  "select",
  "textarea",
  "a",
  '[role="menu"]',
  '[role="menuitem"]',
  "[data-no-drag]",
].join(", ");

function isDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest(NO_DRAG_SELECTOR) === null;
}

/**
 * Hook that returns a ref for window dragging.
 * Uses `getCurrentWindow().startDragging()` which is more reliable
 * than `data-tauri-drag-region` with titleBarStyle: Overlay in Tauri v2.
 */
export function useDragRegion<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);

  const onMouseDown = useCallback((e: MouseEvent) => {
    if (e.button !== 0) return;
    if (!isDragTarget(e.target)) return;
    e.preventDefault();
    void getCurrentWindow().startDragging();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("mousedown", onMouseDown);
    return () => el.removeEventListener("mousedown", onMouseDown);
  }, [onMouseDown]);

  return ref;
}
