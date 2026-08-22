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

    const store = useEditorStore.getState();
    const body = store.body;
    // A freshly created daily note holds only its `# YYYY-MM-DD` heading.
    const isEmpty = body.trim().split("\n").filter(Boolean).length <= 1;
    store.updateBody(
      isEmpty ? `${body.trimEnd()}\n\n${brief}\n` : `${body.trimEnd()}\n\n${brief}\n`,
    );

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
