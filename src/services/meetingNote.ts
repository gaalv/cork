/**
 * Turn a raw transcript into a structured meeting note.
 *
 * The transcript stays in the note underneath the structure — it is the source,
 * and a summary you cannot check against what was said is worth less.
 */

import { toast } from "sonner";

import { client } from "@/ipc/client";
import { useEditorStore } from "@/stores/editorStore";
import { replaceNoteBody } from "@/services/editorWrite";

/**
 * Characters of transcript sent to the model.
 *
 * Kept below the skill's own `max_tokens_in` (30k tokens ≈ 120k chars) so the
 * backend's truncation never fires. That matters: the backend keeps the head
 * and drops the tail, and in a meeting the tail is where the decisions and
 * action items are. Trimming here instead lets both ends survive.
 */
const MAX_TRANSCRIPT_CHARS = 100_000;
/** How much of each end to keep when a transcript is too long. */
const HEAD_SHARE = 0.45;

const OMITTED_MARKER = "\n\n[… middle of the transcript omitted …]\n\n";

type Trimmed = { text: string; droppedChars: number };

/**
 * Keep the opening and the close, drop the middle.
 *
 * A long meeting opens with who is there and what it is about, and closes with
 * what was decided. The discussion in between compresses far better than
 * either end.
 */
export function trimTranscript(text: string, limit = MAX_TRANSCRIPT_CHARS): Trimmed {
  if (text.length <= limit) return { text, droppedChars: 0 };

  const budget = limit - OMITTED_MARKER.length;
  const headChars = Math.floor(budget * HEAD_SHARE);
  const tailChars = budget - headChars;

  return {
    text: text.slice(0, headChars) + OMITTED_MARKER + text.slice(text.length - tailChars),
    droppedChars: text.length - budget,
  };
}

export async function structureMeetingNote(): Promise<void> {
  const store = useEditorStore.getState();
  const body = store.body;

  if (body.trim().length < 200) {
    toast.error("This note is too short to be a transcript");
    return;
  }

  toast("Structuring the meeting…", { id: "meeting-note", duration: Infinity });

  try {
    const { text, droppedChars } = trimTranscript(body);

    const result = (await client.ai.runSkill("meeting-note", {
      date: new Date().toISOString().slice(0, 10),
      body: text,
    })) as { output: string };

    const structured = result.output.trim();
    if (!structured) {
      toast.error("The model returned nothing", { id: "meeting-note", duration: 4000 });
      return;
    }

    // Structure first, source kept below it — folded behind a heading so the
    // note opens on the summary rather than the wall of transcript.
    replaceNoteBody(`${structured}\n\n---\n\n## Transcript\n\n${body.trim()}\n`);

    toast.success(
      droppedChars > 0
        ? `Meeting structured — the middle ${Math.round(droppedChars / 1000)}k characters were too long to send`
        : "Meeting structured",
      { id: "meeting-note", duration: droppedChars > 0 ? 8000 : 3000 },
    );
  } catch (err) {
    const error = err as { kind?: string; message?: string };
    toast.error(
      error.kind === "provider_disabled"
        ? "Configure an AI provider in Settings"
        : `Could not structure the meeting: ${error.message ?? String(err)}`,
      { id: "meeting-note", duration: 5000 },
    );
  }
}
