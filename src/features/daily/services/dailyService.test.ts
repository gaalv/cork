import { beforeEach, describe, expect, it, vi } from "vitest";

import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { computeDailyPath, dailyTemplateVars, openOrCreateToday, renderTemplate } from "./dailyService";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    notes: {
      create: vi.fn(),
      save: vi.fn(),
    },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

beforeEach(() => {
  vi.clearAllMocks();
  useShellStore.getState().reset();
  useVaultStore.setState({ path: "/vault", notes: [], isLoading: false, error: null, loadNotes: vi.fn().mockResolvedValue(undefined) });
});

describe("dailyService", () => {
  it("computes daily paths from date tokens", () => {
    const date = new Date(2026, 4, 6, 9, 7);

    expect(computeDailyPath(date)).toBe("Daily/2026/05/2026-05-06.md");
    expect(computeDailyPath(date, "daily/YY/MM/DD-HH-mm.md")).toBe("daily/26/05/06-09-07.md");
  });

  it("renders known template variables and leaves unknown variables literal", () => {
    const rendered = renderTemplate("# {{date}} {{time}} {{weekday}} {{vault}} {{unknown}}", {
      date: "2026-05-06",
      time: "09:07",
      weekday: "Wednesday",
      vault: "Work",
    });

    expect(rendered).toBe("# 2026-05-06 09:07 Wednesday Work {{unknown}}");
  });

  it("derives daily template variables", () => {
    const vars = dailyTemplateVars(new Date(2026, 4, 6, 9, 7), "/Users/me/Work");

    expect(vars.date).toBe("2026-05-06");
    expect(vars.time).toBe("09:07");
    expect(vars.vault).toBe("Work");
  });

  it("opens an existing daily note without creating a duplicate", async () => {
    useVaultStore.setState({
      notes: [{ id: "daily", path: "/vault/Daily/2026/05/2026-05-06.md", title: "2026-05-06", folder: "Daily/2026/05", size: 1, mtime: 1 }],
    });

    await openOrCreateToday(new Date(2026, 4, 6, 9, 7));

    expect(clientMock.notes.create).not.toHaveBeenCalled();
    expect(useShellStore.getState().view).toEqual({ kind: "note", id: "daily" });
  });

  it("creates and saves today's daily note", async () => {
    clientMock.notes.create.mockResolvedValue({ path: "/vault/Daily/2026/05/2026-05-06.md" });
    clientMock.notes.save.mockResolvedValue({ path: "/vault/Daily/2026/05/2026-05-06.md", mtime: 2 });
    const loadNotes = vi.fn().mockImplementation(async () => {
      useVaultStore.setState({
        notes: [{ id: "daily", path: "/vault/Daily/2026/05/2026-05-06.md", title: "2026-05-06", folder: "Daily/2026/05", size: 1, mtime: 2 }],
      });
    });
    useVaultStore.setState({ loadNotes });

    await openOrCreateToday(new Date(2026, 4, 6, 9, 7));

    expect(clientMock.notes.create).toHaveBeenCalledWith({ folder: "Daily/2026/05", title: "2026-05-06" });
    expect(clientMock.notes.save).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining("# 2026-05-06") }));
    expect(useShellStore.getState().view).toEqual({ kind: "note", id: "daily" });
  });
});
