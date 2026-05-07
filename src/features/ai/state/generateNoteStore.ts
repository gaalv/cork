import { create } from "zustand";

import { runSkill } from "@/features/ai/services/skillsClient";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { client } from "@/shared/ipc/client";

import type { AiSkillError } from "@/shared/ipc/IpcContract";

type Status = "idle" | "loading" | "error";

interface GenerateNoteState {
  open: boolean;
  status: Status;
  error: string | null;
  openModal: () => void;
  closeModal: () => void;
  generate: (input: { topic: string; folder: string }) => Promise<void>;
}

function describeError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as AiSkillError).message === "string") {
    return (err as AiSkillError).message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export const useGenerateNoteStore = create<GenerateNoteState>((set, get) => ({
  open: false,
  status: "idle",
  error: null,

  openModal() {
    set({ open: true, status: "idle", error: null });
  },

  closeModal() {
    if (get().status === "loading") return;
    set({ open: false, status: "idle", error: null });
  },

  async generate({ topic, folder }) {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      set({ error: "Topic is required" });
      return;
    }

    set({ status: "loading", error: null });
    try {
      const result = await runSkill("generate-note", { topic: trimmedTopic });
      const created = await client.notes.create({ folder, title: trimmedTopic });
      await client.notes.save({
        path: created.path,
        frontmatter: { generated_by: "ai", topic: trimmedTopic },
        body: result.output.trim() + "\n",
      });
      await useVaultStore.getState().loadNotes();
      const note = useVaultStore.getState().notes.find((entry) => entry.path === created.path);
      if (note) {
        useShellStore.getState().navigate({ kind: "note", id: note.id });
      }
      set({ open: false, status: "idle", error: null });
    } catch (err) {
      set({ status: "error", error: describeError(err) });
    }
  },
}));
