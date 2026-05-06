export type CommandActionId = "open-vault" | "new-note" | "open-daily" | "open-settings" | "rebuild-index" | "go-home";

export type CommandRegistryItem = {
  kind: "command";
  id: CommandActionId;
  label: string;
  section: "Commands" | "Vault Actions";
};

export const commandsRegistry: CommandRegistryItem[] = [
  { kind: "command", id: "go-home", label: "Go to Home", section: "Commands" },
  { kind: "command", id: "open-daily", label: "Open today's daily note", section: "Commands" },
  { kind: "command", id: "new-note", label: "New Note", section: "Commands" },
  { kind: "command", id: "open-settings", label: "Open Settings", section: "Commands" },
  { kind: "command", id: "rebuild-index", label: "Rebuild Index", section: "Vault Actions" },
  { kind: "command", id: "open-vault", label: "Open Vault", section: "Vault Actions" },
];
