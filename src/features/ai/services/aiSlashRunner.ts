import { runSkill } from "@/features/ai/services/skillsClient";
import { useAppSettingsStore } from "@/features/shell/state/appSettingsStore";
import { useShellStore } from "@/features/shell/state/shellStore";

import type { AiSkillError } from "@/shared/ipc/IpcContract";
import type { EditorView } from "@codemirror/view";

export type SlashAiKind = "summarize" | "rephrase" | "expand" | "continue";

const CONTINUE_PREFIX_CHARS = 1500;

const SKILL_BY_KIND: Record<SlashAiKind, string> = {
  summarize: "summarize",
  rephrase: "slash-rephrase",
  expand: "slash-expand",
  continue: "slash-continue",
};

const LABEL_BY_KIND: Record<SlashAiKind, string> = {
  summarize: "Summarize",
  rephrase: "Rephrase",
  expand: "Expand",
  continue: "Continue writing",
};

function describeError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as AiSkillError).message === "string") {
    return (err as AiSkillError).message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export type RunAiSlashDeps = {
  runSkill: typeof runSkill;
  pushToast: (toast: { title: string; description?: string }) => void;
  isAiDisabled: () => boolean;
};

const defaultDeps: RunAiSlashDeps = {
  runSkill,
  pushToast: (toast) => useShellStore.getState().pushToast(toast),
  isAiDisabled: () => (useAppSettingsStore.getState().settings.ai?.provider ?? "disabled") === "disabled",
};

export async function runAiSlash(
  view: EditorView,
  kind: SlashAiKind,
  triggerFrom: number,
  triggerTo: number,
  deps: RunAiSlashDeps = defaultDeps,
): Promise<void> {
  view.dispatch({ changes: { from: triggerFrom, to: triggerTo, insert: "" } });

  if (deps.isAiDisabled()) {
    deps.pushToast({
      title: "AI provider is disabled",
      description: "Enable Claude or Copilot CLI in Settings → AI.",
    });
    return;
  }

  const state = view.state;
  const selection = state.selection.main;
  const hasSelection = !selection.empty;
  const selectedText = hasSelection ? state.doc.sliceString(selection.from, selection.to) : "";
  const wholeBody = state.doc.toString();
  const cursor = selection.from;

  let variables: Record<string, string>;
  let replaceFrom = selection.from;
  let replaceTo = selection.to;
  let mode: "replace" | "insert" = "replace";

  if (kind === "continue") {
    const start = Math.max(0, cursor - CONTINUE_PREFIX_CHARS);
    variables = { prefix: state.doc.sliceString(start, cursor) };
    replaceFrom = cursor;
    replaceTo = cursor;
    mode = "insert";
  } else if (kind === "summarize") {
    const body = hasSelection ? selectedText : wholeBody;
    variables = { title: "", frontmatter: "", body };
    if (!hasSelection) {
      replaceFrom = cursor;
      replaceTo = cursor;
      mode = "insert";
    }
  } else {
    if (!hasSelection) {
      deps.pushToast({
        title: `${LABEL_BY_KIND[kind]} needs a selection`,
        description: "Select some text first, then run the command.",
      });
      return;
    }
    variables = { selection: selectedText };
  }

  deps.pushToast({ title: `${LABEL_BY_KIND[kind]} — running…` });

  try {
    const result = await deps.runSkill(SKILL_BY_KIND[kind], variables);
    const output = result.output.trim();
    if (!output) {
      deps.pushToast({ title: `${LABEL_BY_KIND[kind]} returned empty output` });
      return;
    }
    const insert = mode === "insert" ? (output.startsWith("\n") ? output : `\n\n${output}`) : output;
    view.dispatch({
      changes: { from: replaceFrom, to: replaceTo, insert },
      selection: { anchor: replaceFrom + insert.length },
    });
    deps.pushToast({ title: `${LABEL_BY_KIND[kind]} — done` });
  } catch (err) {
    deps.pushToast({ title: `${LABEL_BY_KIND[kind]} failed`, description: describeError(err) });
  }
}
