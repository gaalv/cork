/// <reference types="vite/client" />

import type { WriteAttachmentInput, WriteAttachmentResult } from "@/features/assets/services/assetIngest";
import type { JsonRecord, NoteEntry } from "@/shared/ipc/types";

declare global {
  interface Window {
    __noxe_test_setVault?: (path: string, notes?: NoteEntry[]) => void;
    __noxe_test_readNote?: (path: string) => { path: string; frontmatter: JsonRecord; body: string; mtime: number } | null;
    __noxe_test_togglePin?: (path: string) => boolean;
    __noxe_test_writeAttachment?: (input: WriteAttachmentInput) => Promise<WriteAttachmentResult>;
  }
}
