/// <reference types="vite/client" />

import type { WriteAttachmentInput, WriteAttachmentResult } from "@/services/assetIngest";
import type { JsonRecord, NoteEntry, RecentVault } from "@/ipc/types";

declare global {
  const __APP_VERSION__: string;
  interface Window {
    __cork_test_setVault?: (path: string, notes?: NoteEntry[]) => void;
    __cork_test_readNote?: (
      path: string,
    ) => { path: string; frontmatter: JsonRecord; body: string; mtime: number } | null;
    __cork_test_togglePin?: (path: string) => boolean;
    __cork_test_writeAttachment?: (input: WriteAttachmentInput) => Promise<WriteAttachmentResult>;
    __cork_test_setRecentVaults?: (vaults: RecentVault[]) => void;
  }
}
