import { EditorView } from "@codemirror/view";

import { useEditorStore } from "@/features/editor/state/editorStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { ingestDroppedImage, ingestPastedImage, isImageFile } from "../services/assetIngest";

import type { Extension } from "@codemirror/state";
import type { AssetIngestOptions } from "../services/assetIngest";

type EditorAssetContext = {
  currentNotePath: string | null;
  vaultRoot: string | null;
};

type EditorDropPasteOptions = AssetIngestOptions & {
  getContext?: () => EditorAssetContext;
  ingestDropImage?: typeof ingestDroppedImage;
  ingestPasteImage?: typeof ingestPastedImage;
};

export function createEditorDropPasteExtension(options: EditorDropPasteOptions = {}): Extension {
  return EditorView.domEventHandlers({
    drop(event, view) {
      const files = imageFiles(event.dataTransfer?.files);
      if (files.length === 0 || !hasAssetContext(options.getContext?.() ?? defaultContext())) {
        return false;
      }

      event.preventDefault();
      const position = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.from;
      void insertDroppedImages(view, files, position, options);
      return true;
    },
    paste(event, view) {
      const file = firstClipboardImage(event.clipboardData?.items);
      if (!file || !hasAssetContext(options.getContext?.() ?? defaultContext())) {
        return false;
      }

      event.preventDefault();
      void insertPastedImage(view, file, view.state.selection.main.from, options);
      return true;
    },
  });
}

async function insertDroppedImages(view: EditorView, files: File[], position: number, options: EditorDropPasteOptions) {
  const ingest = options.ingestDropImage ?? ingestDroppedImage;
  const links: string[] = [];
  for (const file of files) {
    links.push(await ingest(file, options));
  }
  insertMarkdown(view, position, links.join("\n"));
}

async function insertPastedImage(view: EditorView, file: File, position: number, options: EditorDropPasteOptions) {
  const ingest = options.ingestPasteImage ?? ingestPastedImage;
  insertMarkdown(view, position, await ingest(file, options));
}

function insertMarkdown(view: EditorView, position: number, insert: string) {
  view.dispatch({ changes: { from: position, insert }, selection: { anchor: position + insert.length } });
  view.focus();
}

function imageFiles(fileList: FileList | undefined): File[] {
  return Array.from(fileList ?? []).filter(isImageFile);
}

function firstClipboardImage(items: DataTransferItemList | undefined): File | null {
  for (const item of Array.from(items ?? [])) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) {
      continue;
    }
    const file = item.getAsFile();
    if (file) {
      return file;
    }
  }
  return null;
}

function defaultContext(): EditorAssetContext {
  const activeNoteId = useEditorStore.getState().activeNoteId;
  return {
    currentNotePath: activeNoteId ? (useEditorStore.getState().buffers.get(activeNoteId)?.path ?? null) : null,
    vaultRoot: useVaultStore.getState().path,
  };
}

function hasAssetContext(context: EditorAssetContext): boolean {
  return Boolean(context.currentNotePath && context.vaultRoot);
}
