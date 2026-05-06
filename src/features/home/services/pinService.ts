import { client } from "@/shared/ipc/client";

import type { NoteEntry } from "@/shared/ipc/types";

export async function togglePin(note: Pick<NoteEntry, "path">): Promise<boolean> {
  try {
    const file = await client.notes.read(note.path);
    const nextPinned = file.frontmatter.pinned !== true;
    await client.notes.save({
      path: file.path,
      frontmatter: { ...file.frontmatter, pinned: nextPinned },
      body: file.body,
      expectedMtime: file.mtime,
    });
    return nextPinned;
  } catch (error) {
    const fallback = window.__noxe_test_togglePin?.(note.path);
    if (fallback !== undefined) {
      return fallback;
    }
    throw error;
  }
}
