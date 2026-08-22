/**
 * Dev-build marker.
 *
 * A dev build and an installed release build are both called "Cork" and look
 * identical, so it is easy to test the wrong window. This paints an accent
 * outline around the app and a small corner pill — only under `vite dev`,
 * where `import.meta.env.DEV` is true. It is tree-shaken out of release
 * bundles entirely.
 */

export function DevBadge() {
  if (!import.meta.env.DEV) return null;

  return (
    <>
      {/* Outline sits above everything but must never eat clicks. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[9999] rounded-[10px] border-2 border-[var(--color-cork-dev)]"
      />
      <div
        className="pointer-events-none fixed right-0 bottom-0 z-[9999] rounded-tl-md bg-[var(--color-cork-dev)] px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-white select-none"
        title="Development build — not the installed app"
      >
        DEV
      </div>
    </>
  );
}
