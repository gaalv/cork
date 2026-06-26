/**
 * CodeMirror 6 extension for drag-drop and clipboard paste of images/files.
 *
 * Handles:
 * - Dropping image files from Finder/desktop onto the editor
 * - Pasting images from clipboard (screenshots, copied files)
 *
 * Writes attachments via the Tauri IPC backend, then inserts
 * Markdown image/link syntax at the cursor/drop position.
 *
 * @see F11 — Assets & Images spec (ASSET-09, ASSET-10)
 */

import { EditorView } from "@codemirror/view";

import { writeAttachment } from "@/features/assets/services/assetIngest";
import { isImagePath } from "@/features/assets/services/assetResolver";

import type { Extension } from "@codemirror/state";

const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/avif"]);

function isImageFile(file: File): boolean {
  return IMAGE_MIME.has(file.type) || isImagePath(file.name);
}

function markdownLink(relativePath: string, fileName: string, isImage: boolean): string {
  if (isImage) {
    return `![${fileName}](${relativePath})`;
  }
  return `[${fileName}](${relativePath})`;
}

async function ingestFile(file: File): Promise<{ relativePath: string; fileName: string; isImage: boolean } | null> {
  try {
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
    const result = await writeAttachment({
      bytes,
      suggestedName: file.name,
    });
    return {
      relativePath: result.relativePath,
      fileName: file.name,
      isImage: isImageFile(file),
    };
  } catch {
    return null;
  }
}

function insertText(view: EditorView, pos: number, text: string) {
  view.dispatch({
    changes: { from: pos, insert: text },
    selection: { anchor: pos + text.length },
  });
}

/** CM6 extension: handles drop and paste of files into the editor. */
export function assetDropPaste(): Extension {
  return [
    EditorView.domEventHandlers({
      drop(event, view) {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        // Only handle if there are actual files (not text drags)
        const fileList = Array.from(files);
        if (fileList.length === 0) return false;

        event.preventDefault();

        const dropPos = view.posAtCoords({
          x: event.clientX,
          y: event.clientY,
        }) ?? view.state.selection.main.head;

        void (async () => {
          const insertions: string[] = [];

          for (const file of fileList) {
            const result = await ingestFile(file);
            if (result) {
              insertions.push(markdownLink(result.relativePath, result.fileName, result.isImage));
            }
          }

          if (insertions.length > 0) {
            insertText(view, dropPos, insertions.join("\n"));
          }
        })();

        return true;
      },

      paste(event, view) {
        const items = event.clipboardData?.items;
        if (!items) return false;

        const files: File[] = [];
        for (const item of items) {
          if (item.kind === "file") {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }

        // Only intercept if there are files — let normal text paste through
        if (files.length === 0) return false;

        event.preventDefault();

        const pos = view.state.selection.main.head;

        void (async () => {
          const insertions: string[] = [];

          for (const file of files) {
            // Generate a name for clipboard images (e.g., screenshots)
            const name = file.name && file.name !== "image.png"
              ? file.name
              : `paste-${Date.now()}.${extensionFromMime(file.type)}`;

            const result = await ingestFile(new File([file], name, { type: file.type }));
            if (result) {
              insertions.push(markdownLink(result.relativePath, result.fileName, result.isImage));
            }
          }

          if (insertions.length > 0) {
            insertText(view, pos, insertions.join("\n"));
          }
        })();

        return true;
      },
    }),
  ];
}

function extensionFromMime(mime: string): string {
  switch (mime) {
    case "image/png": return "png";
    case "image/jpeg": return "jpg";
    case "image/gif": return "gif";
    case "image/webp": return "webp";
    case "image/svg+xml": return "svg";
    case "image/avif": return "avif";
    default: return "png";
  }
}
