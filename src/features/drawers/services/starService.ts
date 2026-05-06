import { client } from "@/shared/ipc/client";

import type { NoteEntry } from "@/shared/ipc/types";

export async function toggleStar(note: Pick<NoteEntry, "path">): Promise<boolean> {
  const file = await client.notes.read(note.path);
  const nextStarred = file.frontmatter.starred !== true;
  await client.notes.save({
    path: file.path,
    frontmatter: { ...file.frontmatter, starred: nextStarred },
    body: file.body,
    expectedMtime: file.mtime,
  });
  return nextStarred;
}
