/**
 * The host platform, for the few places the layout genuinely differs.
 *
 * Used sparingly: almost everything should be platform-neutral. The real case
 * is the macOS overlay title bar, which floats the traffic lights over the
 * top-left of the window — space that must be reserved there and nowhere else,
 * since Windows and Linux put their window controls on the right.
 */

import { useEffect, useState } from "react";
import { type } from "@tauri-apps/plugin-os";

export type HostPlatform = "macos" | "windows" | "linux" | "unknown";

/** Resolved once — the platform cannot change while the app runs. */
let cached: HostPlatform | null = null;

function detect(): HostPlatform {
  try {
    const os = type();
    if (os === "macos") return "macos";
    if (os === "windows") return "windows";
    if (os === "linux") return "linux";
    return "unknown";
  } catch {
    // Outside Tauri (a browser harness) there is no host to ask.
    return "unknown";
  }
}

export function usePlatform(): HostPlatform {
  const [platform, setPlatform] = useState<HostPlatform>(() => cached ?? "unknown");

  useEffect(() => {
    if (cached) return;
    cached = detect();
    setPlatform(cached);
  }, []);

  return platform;
}

/** True when window controls overlay the top-left of the content. */
export function useOverlayTitleBar(): boolean {
  return usePlatform() === "macos";
}
