export type CommandActionId = "open-vault" | "new-note" | "open-daily" | "open-settings" | "rebuild-index" | "go-home" | "toggle-theme" | "open-graph" | "ai-generate-note" | "open-todos" | "new-todo";

export type CommandRegistryItem = {
  kind: "command";
  id: CommandActionId;
  label: string;
  section: "Commands" | "Vault Actions" | "AI";
};

export const commandsRegistry: CommandRegistryItem[] = [
  { kind: "command", id: "go-home", label: "Go to Home", section: "Commands" },
  { kind: "command", id: "open-graph", label: "Open Graph view", section: "Commands" },
  { kind: "command", id: "open-todos", label: "Open Todos", section: "Commands" },
  { kind: "command", id: "open-daily", label: "Open today's daily note", section: "Commands" },
  { kind: "command", id: "new-note", label: "New Note", section: "Commands" },
  { kind: "command", id: "new-todo", label: "New todo…", section: "Commands" },
  { kind: "command", id: "ai-generate-note", label: "Generate note with AI…", section: "AI" },
  { kind: "command", id: "open-settings", label: "Open Settings", section: "Commands" },
  { kind: "command", id: "toggle-theme", label: "Toggle theme (Light · Dark · System)", section: "Commands" },
  { kind: "command", id: "rebuild-index", label: "Rebuild Index", section: "Vault Actions" },
  { kind: "command", id: "open-vault", label: "Open Vault", section: "Vault Actions" },
];
