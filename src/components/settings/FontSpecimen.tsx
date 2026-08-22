/**
 * Live specimen of the current editor typography.
 *
 * Reads the same custom properties the CodeMirror theme does, so what shows
 * here is exactly what the writing surface will render.
 */

export function FontSpecimen() {
  return (
    <div
      className="rounded-lg border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-4 py-3"
      style={{
        fontFamily: "var(--font-editor)",
        fontSize: "var(--editor-font-size)",
        lineHeight: "var(--editor-line-height)",
      }}
    >
      <div className="font-semibold" style={{ fontSize: "1.35em", lineHeight: 1.3 }}>
        Release checklist
      </div>
      <p className="mt-2">
        Ship the <strong>0.2.0</strong> build once the <em>indexer</em> settles — 1,240 notes in
        under 3s.
      </p>
      <p className="mt-1">
        <span
          className="rounded px-1"
          style={{ fontFamily: "var(--font-mono)", fontSize: "0.9em" }}
        >
          pnpm tauri:build
        </span>{" "}
        · Handgloves 0123456789 — il1 O0 &amp; {"{}"} =&gt;
      </p>
    </div>
  );
}
