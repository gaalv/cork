/**
 * Daily note brief — turn a blank daily note into a starting point.
 *
 * Gathers what the user was actually doing (yesterday's note, notes touched
 * this week, unfinished tasks) and asks the model to lay it out. The material
 * is real: the skill is instructed never to invent a task, because a daily
 * note that lies about your commitments is worse than an empty one.
 */

import { toast } from "sonner";

import { client } from "@/ipc/client";
import { useEditorStore } from "@/stores/editorStore";
import { appendToNoteBody } from "@/services/editorWrite";
import { useShellStore } from "@/stores/shellStore";
import { useVaultStore } from "@/stores/vaultStore";
import { recentNotes } from "@/services/aiVault";
import { openDailyNote } from "@/services/dailyNote";

import type { NoteEntry } from "@/ipc/types";

const UNCHECKED_TASK = /^\s*[-*+]\s\[ \]\s+(.+)$/gm;
/** Reading bodies costs an IPC round trip each — keep the window tight. */
const TASK_SCAN_LIMIT = 15;

/** Unfinished `- [ ]` items from recently touched notes, with their source. */
async function openTasks(notes: NoteEntry[]): Promise<string> {
  const found: string[] = [];

  await Promise.all(
    notes.slice(0, TASK_SCAN_LIMIT).map(async (note) => {
      try {
        const file = await client.notes.read(note.path);
        const body = (file as { body: string }).body;
        UNCHECKED_TASK.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = UNCHECKED_TASK.exec(body)) !== null) {
          found.push(`- [ ] ${match[1].trim()}   (from ${note.title})`);
        }
      } catch {
        // A note that cannot be read simply contributes nothing.
      }
    }),
  );

  return found.slice(0, 40).join("\n");
}

/**
 * Wait until the editor is actually showing `noteId`.
 *
 * `openNote` only sets shell state; the editor remounts and loads the buffer
 * in a later React effect. Writing before that lands the text in whichever
 * note was open before — today the AI round trip usually hides the gap, which
 * is not something to depend on.
 */
async function waitForEditor(noteId: string, timeoutMs = 4000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const state = useEditorStore.getState();
    if (state.noteId === noteId && !state.loading) return true;
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** Yesterday's daily note body, if there is one. */
async function previousDaily(): Promise<string> {
  const dailies = useVaultStore
    .getState()
    .notes.filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n.title))
    .sort((a, b) => b.title.localeCompare(a.title));

  const today = new Date().toISOString().slice(0, 10);
  const previous = dailies.find((n) => n.title < today);
  if (!previous) return "(none)";

  try {
    const file = await client.notes.read(previous.path);
    return `# ${previous.title}\n${(file as { body: string }).body.slice(0, 3000)}`;
  } catch {
    return "(none)";
  }
}

/**
 * Open today's daily note and insert a brief.
 *
 * Appends rather than replaces when the note already has content — the point
 * is to remove the blank page, not to overwrite a morning's writing.
 */
export async function insertDailyBrief(): Promise<void> {
  toast("Building today's brief…", { id: "daily-brief", duration: Infinity });

  try {
    await openDailyNote();

    // Capture the target before the slow work, so a note opened in the
    // meantime cannot receive the brief.
    const opened = useShellStore.getState().view;
    const targetId = opened.kind === "note" ? opened.id : null;

    const recent = recentNotes(7, 12);
    const [previous, tasks] = await Promise.all([previousDaily(), openTasks(recent)]);

    const result = (await client.ai.runSkill("daily-brief", {
      date: new Date().toISOString().slice(0, 10),
      previous,
      recent: recent.map((n) => `- ${n.title}${n.folder ? ` (${n.folder})` : ""}`).join("\n"),
      tasks: tasks || "(none found)",
    })) as { output: string };

    const brief = result.output.trim();
    if (!brief) {
      toast.error("Nothing to brief today", { id: "daily-brief", duration: 4000 });
      return;
    }

    if (targetId && !(await waitForEditor(targetId))) {
      toast.error("The daily note did not finish opening", {
        id: "daily-brief",
        duration: 4000,
      });
      return;
    }

    // Refuse rather than write into whatever note is open now.
    if (targetId && useEditorStore.getState().noteId !== targetId) {
      toast.error("Daily note is no longer open — brief not added", {
        id: "daily-brief",
        duration: 4000,
      });
      return;
    }

    appendToNoteBody(brief);

    toast.success("Brief added", { id: "daily-brief", duration: 3000 });
  } catch (err) {
    const error = err as { kind?: string; message?: string };
    toast.error(
      error.kind === "provider_disabled"
        ? "Configure an AI provider in Settings"
        : `Could not build the brief: ${error.message ?? String(err)}`,
      { id: "daily-brief", duration: 5000 },
    );
  }
}
