/**
 * Update checking.
 *
 * Cork never updates itself: it ships through package managers, and replacing
 * its own bundle would leave Homebrew or winget holding a stale record. Instead
 * this asks a static manifest for the latest version and, when there is a newer
 * one, surfaces the command the user should run for their install channel.
 *
 * Deliberately minimal on the wire — a plain GET, no identifier, no telemetry.
 * It is the only outbound request Cork makes, it honours the
 * `updates.autoCheck` setting, fails silently offline, and never blocks
 * startup.
 */

import { client } from "@/ipc/client";
import { useAppSettingsStore } from "@/stores/appSettingsStore";

import type { InstallChannel } from "@/ipc/types";

const MANIFEST_URL = "https://cork.md/version.json";
const RELEASES_URL = "https://github.com/gaalv/cork/releases";
const CACHE_KEY = "cork-update-check";
/** At most one request a day — a notes app has no reason to poll harder. */
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

type Manifest = {
  version: string;
  notes?: string;
  url?: string;
};

export type UpdateInfo = {
  latest: string;
  current: string;
  /** Command for the detected channel, or null when there isn't one. */
  command: string | null;
  channelLabel: string;
  releasesUrl: string;
};

type Cache = {
  checkedAt: number;
  latest: string;
};

/** Compares dotted numeric versions. Pre-release suffixes sort before release. */
export function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => {
    const [core, pre] = v.replace(/^v/, "").split("-", 2);
    return {
      parts: core.split(".").map((n) => Number.parseInt(n, 10) || 0),
      pre: pre ?? null,
    };
  };
  const a = parse(latest);
  const b = parse(current);

  const len = Math.max(a.parts.length, b.parts.length);
  for (let i = 0; i < len; i += 1) {
    const x = a.parts[i] ?? 0;
    const y = b.parts[i] ?? 0;
    if (x !== y) return x > y;
  }
  // Same core: a release beats a pre-release of the same number.
  if (a.pre === b.pre) return false;
  if (a.pre === null) return true;
  if (b.pre === null) return false;
  return a.pre > b.pre;
}

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cache;
    if (typeof parsed.checkedAt === "number" && typeof parsed.latest === "string") return parsed;
  } catch {
    // unreadable cache is the same as no cache
  }
  return null;
}

function writeCache(cache: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // best-effort
  }
}

function currentVersion(): string {
  // Injected by Vite from package.json at build time (see vite.config.ts).
  return typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";
}

/**
 * Check for a newer release.
 *
 * @param force Skip the once-a-day cache (the Settings button uses this).
 * @returns Update details, or null when up to date, disabled, or unreachable.
 */
export async function checkForUpdate(force = false): Promise<UpdateInfo | null> {
  const settings = useAppSettingsStore.getState().settings;
  if (!force && settings.updates?.autoCheck === false) return null;

  const cached = readCache();
  if (!force && cached && Date.now() - cached.checkedAt < CHECK_INTERVAL_MS) {
    return buildInfo(cached.latest);
  }

  let manifest: Manifest;
  try {
    const response = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) return null;
    manifest = (await response.json()) as Manifest;
  } catch {
    // Offline, DNS blocked, corporate proxy — none of it is worth a message.
    return null;
  }

  if (typeof manifest.version !== "string") return null;
  writeCache({ checkedAt: Date.now(), latest: manifest.version });
  return buildInfo(manifest.version);
}

async function buildInfo(latest: string): Promise<UpdateInfo | null> {
  const current = currentVersion();
  if (!isNewer(latest, current)) return null;

  let channel: InstallChannel;
  try {
    channel = (await client.updates.installChannel()) as InstallChannel;
  } catch {
    channel = { channel: "direct", command: null, label: "Direct download" };
  }

  // Dev builds are always "behind" the released version — never nag.
  if (channel.channel === "dev") return null;

  return {
    latest,
    current,
    command: channel.command,
    channelLabel: channel.label,
    releasesUrl: RELEASES_URL,
  };
}
