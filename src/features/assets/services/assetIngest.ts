import { useAppSettingsStore } from "@/features/shell/state/appSettingsStore";
import { client } from "@/shared/ipc/client";

export type WriteAttachmentInput = {
  bytes?: number[];
  sourcePath?: string;
  suggestedName: string;
  vaultRelDir?: string;
};

export type WriteAttachmentResult = {
  path: string;
  relativePath: string;
};

export type AssetIngestOptions = {
  attachmentsFolder?: string;
  now?: () => Date;
  writeAttachment?: (input: WriteAttachmentInput) => Promise<WriteAttachmentResult>;
};

const DEFAULT_ATTACHMENTS_FOLDER = "_attachments";

export async function ingestDroppedImage(file: File, options: AssetIngestOptions = {}): Promise<string> {
  const written = await writeFileAttachment(file, file.name || "image.png", options);
  return `![${imageAlt(file.name)}](${written.relativePath})`;
}

export async function ingestPastedImage(file: File, options: AssetIngestOptions = {}): Promise<string> {
  const written = await writeFileAttachment(file, pastedImageName(options.now?.() ?? new Date()), options);
  return `![](${written.relativePath})`;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(file.name);
}

async function writeFileAttachment(
  file: File,
  suggestedName: string,
  options: AssetIngestOptions,
): Promise<WriteAttachmentResult> {
  const bytes = Array.from(new Uint8Array(await readFileBytes(file)));
  const writer = options.writeAttachment ?? testWriteAttachment() ?? client.assets.writeAttachment;
  return writer({
    bytes,
    suggestedName,
    vaultRelDir: resolveAttachmentsFolder(options),
  });
}

async function readFileBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error("failed to read attachment bytes"));
      }
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("failed to read attachment bytes")));
    reader.readAsArrayBuffer(file);
  });
}

function pastedImageName(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(
    date.getMinutes(),
  )}${pad(date.getSeconds())}`;
  return `Pasted Image ${stamp}.png`;
}

function resolveAttachmentsFolder(options: AssetIngestOptions): string {
  if (options.attachmentsFolder !== undefined) {
    return options.attachmentsFolder;
  }
  return useAppSettingsStore.getState().attachmentsFolder ?? DEFAULT_ATTACHMENTS_FOLDER;
}

function imageAlt(fileName: string): string {
  const lastSegment = fileName.split(/[\\/]/).filter(Boolean).at(-1) ?? fileName;
  const dot = lastSegment.lastIndexOf(".");
  return dot > 0 ? lastSegment.slice(0, dot) : lastSegment;
}

function testWriteAttachment(): ((input: WriteAttachmentInput) => Promise<WriteAttachmentResult>) | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.__noxe_test_writeAttachment ?? null;
}
