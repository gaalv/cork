/**
 * Asset ingest — writes attachments (images, files) into the vault.
 *
 * @see ARCHITECTURE.md — asset management
 */

import { client } from "@/ipc/client";

export type WriteAttachmentInput = {
  sourcePath?: string;
  bytes?: number[];
  suggestedName: string;
  vaultRelDir?: string;
};

export type WriteAttachmentResult = {
  path: string;
  relativePath: string;
};

export async function writeAttachment(input: WriteAttachmentInput): Promise<WriteAttachmentResult> {
  return client.assets.writeAttachment(input) as Promise<WriteAttachmentResult>;
}
