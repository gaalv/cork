/// <reference types="vite/client" />

import type { WriteAttachmentInput, WriteAttachmentResult } from "@/features/assets/services/assetIngest";
import type { NoteEntry } from "@/shared/ipc/types";

declare global {
  interface Window {
    __noxe_test_setVault?: (path: string, notes?: NoteEntry[]) => void;
    __noxe_test_writeAttachment?: (input: WriteAttachmentInput) => Promise<WriteAttachmentResult>;
  }
}
