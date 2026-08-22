/**
 * CodeMirror 6 extension for inline image previews.
 *
 * Shows a rendered `<img>` widget below lines containing
 * `![alt](path)` or `![[image]]` markdown image syntax.
 *
 * Lives in a StateField, not a ViewPlugin: CM6 rejects block decorations
 * supplied by plugins ("Block decorations may not be specified via plugins"),
 * and the resulting throw disabled the plugin outright — so previews silently
 * never appeared on any note that contained an image.
 *
 * @see F11 — Assets & Images spec (ASSET-01, ASSET-02)
 */

import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { StateField, type EditorState, type Range } from "@codemirror/state";

import { resolveAssetCandidates, isImagePath } from "@/services/assetResolver";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";

const IMG_MD_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
const IMG_WIKI_RE = /!\[\[([^[\]|]+?)(?:\|[^[\]]+?)?\]\]/g;

class ImageWidget extends WidgetType {
  constructor(readonly sources: string[]) {
    super();
  }

  eq(other: ImageWidget) {
    return (
      other.sources.length === this.sources.length &&
      other.sources.every((s, i) => s === this.sources[i])
    );
  }

  toDOM() {
    const wrapper = document.createElement("div");
    wrapper.className = "cork-cm-image-preview";

    const img = document.createElement("img");
    img.loading = "lazy";
    img.draggable = false;

    // The note- vs vault-root-relative question can't be answered without
    // touching disk, so try each candidate and keep the one that loads.
    let attempt = 0;
    const tryNext = () => {
      if (attempt >= this.sources.length) {
        wrapper.style.display = "none";
        return;
      }
      img.src = this.sources[attempt];
      attempt += 1;
    };
    img.addEventListener("error", tryNext);
    tryNext();

    wrapper.appendChild(img);
    return wrapper;
  }

  ignoreEvent() {
    return true;
  }
}

function getNoteRelDir(): string {
  const vaultRoot = useVaultStore.getState().path;
  const notePath = useEditorStore.getState().path;
  if (!notePath || !vaultRoot) return "";
  const relative = notePath.startsWith(vaultRoot)
    ? notePath.slice(vaultRoot.length).replace(/^\//, "")
    : notePath;
  const parts = relative.split("/");
  parts.pop();
  return parts.join("/");
}

/** Candidate URLs for the first image on a line, best guess first. */
function imageSrcOnLine(text: string, vaultRoot: string, noteRelDir: string): string[] {
  IMG_MD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMG_MD_RE.exec(text)) !== null) {
    if (!isImagePath(match[2])) continue;
    const urls = resolveAssetCandidates(match[2], vaultRoot, noteRelDir);
    if (urls.length > 0) return urls;
  }

  IMG_WIKI_RE.lastIndex = 0;
  while ((match = IMG_WIKI_RE.exec(text)) !== null) {
    if (!isImagePath(match[1])) continue;
    const urls = resolveAssetCandidates(match[1], vaultRoot, noteRelDir);
    if (urls.length > 0) return urls;
  }

  return [];
}

/** True when the caret sits on this line — then the raw markdown stays put. */
function caretOnLine(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((r) => r.to >= from && r.from <= to);
}

function buildDecorations(state: EditorState, concealSource: boolean): DecorationSet {
  const vaultRoot = useVaultStore.getState().path;
  if (!vaultRoot) return Decoration.none;

  const noteRelDir = getNoteRelDir();
  const decorations: Range<Decoration>[] = [];

  // Whole-doc scan (a StateField has no viewport). The `![` guard keeps this
  // to a cheap line walk on the overwhelmingly common image-free note.
  for (let i = 1; i <= state.doc.lines; i += 1) {
    const line = state.doc.line(i);
    if (!line.text.includes("![")) continue;

    const sources = imageSrcOnLine(line.text, vaultRoot, noteRelDir);
    if (sources.length === 0) continue;

    // With live preview on, an embed line renders as the image itself; move the
    // caret onto it to get the markdown back and edit the path.
    if (
      concealSource &&
      line.text.trim().startsWith("![") &&
      !caretOnLine(state, line.from, line.to)
    ) {
      decorations.push(Decoration.replace({}).range(line.from, line.to));
    }

    decorations.push(
      Decoration.widget({ widget: new ImageWidget(sources), block: true, side: 1 }).range(line.to),
    );
  }

  return Decoration.set(decorations, true);
}

function imagePreviewField(concealSource: boolean) {
  return StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, concealSource);
    },
    update(value, tr) {
      if (tr.docChanged || tr.selection) return buildDecorations(tr.state, concealSource);
      return value;
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}

/**
 * @param livePreview When on, the `![…](…)` source line is replaced by the
 *   rendered image; when off the markdown stays visible with a preview below.
 */
export function imagePreviewExtension(livePreview: boolean) {
  return [
    imagePreviewField(livePreview),
    EditorView.baseTheme({
      ".cork-cm-image-preview": {
        padding: "6px 0 10px",
      },
      ".cork-cm-image-preview img": {
        maxWidth: "min(100%, 520px)",
        borderRadius: "8px",
        display: "block",
        border: "1px solid var(--color-cork-border)",
      },
    }),
  ];
}
