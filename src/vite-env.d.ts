/// <reference types="vite/client" />

import type { NoteEntry } from "@/shared/ipc/types";

declare global {
  interface Window {
    __noxe_test_setVault?: (path: string, notes?: NoteEntry[]) => void;
  }
}
