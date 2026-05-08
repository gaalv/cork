import { useEffect, useState } from "react";

const DEFAULT_DEBOUNCE_MS = 150;

function readWidth(): number {
  if (typeof window === "undefined") return 1440;
  return window.innerWidth;
}

export function useViewportWidth(debounceMs = DEFAULT_DEBOUNCE_MS): number {
  const [width, setWidth] = useState<number>(readWidth);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setWidth(window.innerWidth), debounceMs);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (timer) clearTimeout(timer);
    };
  }, [debounceMs]);

  return width;
}
