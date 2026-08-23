/**
 * Live specimen of the current editor typography.
 *
 * Reads the same custom properties the CodeMirror theme does, so what shows
 * here is exactly what the writing surface will render.
 *
 * It carries a label because without one it reads as a mystery section rather
 * than a preview — the sample text looks like real content sitting in the
 * middle of Settings.
 */

export function FontSpecimen() {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium tracking-wide text-[var(--color-cork-subtle)] uppercase">
        Preview
      </p>
      <div
        aria-label="Preview of the editor typography"
        className="rounded-lg border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-4 py-3"
        style={{
          fontFamily: "var(--font-editor)",
          fontSize: "var(--editor-font-size)",
          lineHeight: "var(--editor-line-height)",
        }}
      >
        {/* Sample text, chosen to exercise the things that differ between
            typefaces: heading weight, bold and italic, an em dash, lining
            numerals, and the characters that expose a bad mono (il1, O0). */}
        <div className="font-semibold" style={{ fontSize: "1.35em", lineHeight: 1.3 }}>
          The quick brown fox
        </div>
        <p className="mt-2">
          Sample text in <strong>bold</strong> and <em>italic</em> — 1,240 notes, 3.5s, 87%.
        </p>
        <p className="mt-1">
          <span
            className="rounded px-1"
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.9em" }}
          >
            inline code
          </span>{" "}
          · Handgloves il1 O0 &amp; {"{}"} =&gt;
        </p>
      </div>
    </div>
  );
}
