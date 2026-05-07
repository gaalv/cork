import { client } from "@/shared/ipc/client";
import { useEditorStore } from "@/features/editor/state/editorStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import type { AiProvider } from "@/shared/ipc/types";

const MAX_CONTEXT_BYTES = 50 * 1024; // 50 KB

/**
 * Builds a context string from the currently open note.
 * Reads from the editor and vault stores directly (no React hooks).
 * The result is capped at MAX_CONTEXT_BYTES to avoid overwhelming the CLI.
 */
export function buildContext(noteId: string | null): string {
  if (!noteId) {
    return "(no note open)";
  }

  const note = useVaultStore.getState().notes.find((n) => n.id === noteId);
  const buffer = useEditorStore.getState().buffers.get(noteId);

  const title = note?.title ?? "Untitled";
  const frontmatter = buffer?.frontmatter ?? {};
  const body = buffer?.body ?? "";

  const fmLines = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join("\n");

  const fmBlock = fmLines.length > 0 ? `---\n${fmLines}\n---\n\n` : "";
  const full = `# ${title}\n\n${fmBlock}${body}`;

  if (full.length <= MAX_CONTEXT_BYTES) {
    return full;
  }

  return full.slice(0, MAX_CONTEXT_BYTES) + "\n\n[Note content truncated at 50 KB]";
}

/**
 * Calls the Tauri IPC command to send a prompt to the configured AI provider.
 * Throws on error (including AI-specific errors from the Rust backend).
 */
export async function sendPrompt(
  provider: AiProvider,
  prompt: string,
  context: string,
): Promise<string> {
  return client.ai.sendPrompt(provider, prompt, context);
}
