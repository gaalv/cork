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
  writeAttachment?: (input: WriteAttachmentInput) => Promise<WriteAttachmentResult>;
};

const DEFAULT_ATTACHMENTS_FOLDER = "attachments";

export async function ingestDroppedImage(file: File, options: AssetIngestOptions = {}): Promise<string> {
  const written = await writeFileAttachment(file, options);
  return `![${imageAlt(file.name)}](${written.relativePath})`;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(file.name);
}

async function writeFileAttachment(file: File, options: AssetIngestOptions): Promise<WriteAttachmentResult> {
  const bytes = Array.from(new Uint8Array(await readFileBytes(file)));
  const writer = options.writeAttachment ?? testWriteAttachment() ?? client.assets.writeAttachment;
  return writer({
    bytes,
    suggestedName: file.name || "image.png",
    vaultRelDir: options.attachmentsFolder ?? DEFAULT_ATTACHMENTS_FOLDER,
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
