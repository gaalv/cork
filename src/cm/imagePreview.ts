/**
 * CodeMirror 6 extension for inline image previews.
 *
 * Shows a rendered `<img>` widget below lines containing
 * `![alt](path)` or `![[image]]` markdown image syntax.
 *
 * @see F11 — Assets & Images spec (ASSET-01, ASSET-02)
 */

import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { type Range } from "@codemirror/state";

import { resolveAssetSrc, isImagePath } from "@/services/assetResolver";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";

const IMG_MD_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
const IMG_WIKI_RE = /!\[\[([^[\]|]+?)(?:\|[^[\]]+?)?\]\]/g;

class ImageWidget extends WidgetType {
  constructor(readonly src: string) {
    super();
  }

  eq(other: ImageWidget) {
    return this.src === other.src;
  }

  toDOM() {
    const wrapper = document.createElement("div");
    wrapper.className = "cork-cm-image-preview";

    const img = document.createElement("img");
    img.src = this.src;
    img.loading = "lazy";
    img.draggable = false;
    img.addEventListener("error", () => {
      wrapper.style.display = "none";
    });

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

function buildDecorations(view: EditorView): DecorationSet {
  const vaultRoot = useVaultStore.getState().path;
  if (!vaultRoot) return Decoration.none;

  const noteRelDir = getNoteRelDir();
  const decorations: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const doc = view.state.doc;

    for (let i = doc.lineAt(from).number; i <= doc.lineAt(to).number; i++) {
      const line = doc.line(i);
      const lineEnd = line.to;

      // Standard markdown images: ![alt](path)
      IMG_MD_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = IMG_MD_RE.exec(line.text)) !== null) {
        const imagePath = match[2];
        if (!isImagePath(imagePath)) continue;

        const resolved = resolveAssetSrc(imagePath, vaultRoot, noteRelDir);
        if (!resolved) continue;

        decorations.push(
          Decoration.widget({
            widget: new ImageWidget(resolved),
            block: true,
            side: 1,
          }).range(lineEnd),
        );
        break; // one preview per line
      }

      // Wiki-style image embeds: ![[image.png]]
      if (decorations.length > 0 && decorations[decorations.length - 1].from === lineEnd) {
        continue; // already have a decoration for this line
      }

      IMG_WIKI_RE.lastIndex = 0;
      while ((match = IMG_WIKI_RE.exec(line.text)) !== null) {
        const imagePath = match[1];
        if (!isImagePath(imagePath)) continue;

        const resolved = resolveAssetSrc(imagePath, vaultRoot, noteRelDir);
        if (!resolved) continue;

        decorations.push(
          Decoration.widget({
            widget: new ImageWidget(resolved),
            block: true,
            side: 1,
          }).range(lineEnd),
        );
        break;
      }
    }
  }

  return Decoration.set(decorations);
}

export function imagePreviewExtension() {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildDecorations(view);
        }

        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged) {
            this.decorations = buildDecorations(update.view);
          }
        }
      },
      {
        decorations: (v) => v.decorations,
      },
    ),
    EditorView.baseTheme({
      ".cork-cm-image-preview": {
        padding: "4px 0 8px",
      },
      ".cork-cm-image-preview img": {
        maxWidth: "min(100%, 480px)",
        borderRadius: "6px",
        display: "block",
      },
    }),
  ];
}
