import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import { useShellStore } from "@/features/shell/state/shellStore";

export const OPEN_TODOS_EVENT = "todos:open";

let unlisten: UnlistenFn | null = null;

export async function installOpenTodosRuntime(): Promise<void> {
  if (unlisten) {
    return;
  }
  try {
    unlisten = await listen(OPEN_TODOS_EVENT, () => {
      useShellStore.getState().navigate({ kind: "todos" });
    });
  } catch {
    unlisten = null;
  }
}

export function uninstallOpenTodosRuntime(): void {
  if (unlisten) {
    unlisten();
    unlisten = null;
  }
}
