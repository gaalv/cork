import { beforeEach, describe, expect, it, vi } from "vitest";

const { ipcMock } = vi.hoisted(() => ({
  ipcMock: {
    client: {
      todos: {
        load: vi.fn(),
        save: vi.fn(),
      },
    },
  },
}));

vi.mock("@/shared/ipc/client", () => ipcMock);

import { selectCompletedTodos, selectOpenTodos, useTodosStore } from "./todosStore";

const initial = useTodosStore.getState();

beforeEach(() => {
  ipcMock.client.todos.load.mockReset();
  ipcMock.client.todos.save.mockReset().mockImplementation(async ({ list }) => list);
  useTodosStore.setState({ ...initial, todos: [], status: "idle", error: null });
});

describe("todosStore", () => {
  it("load() populates todos", async () => {
    ipcMock.client.todos.load.mockResolvedValue({
      todos: [{ id: "a", text: "hi", done: false, createdAt: "t1" }],
    });
    await useTodosStore.getState().load();
    expect(useTodosStore.getState().todos).toHaveLength(1);
    expect(useTodosStore.getState().status).toBe("idle");
  });

  it("add() trims and rejects empty", async () => {
    expect(await useTodosStore.getState().add("   ")).toBeNull();
    expect(ipcMock.client.todos.save).not.toHaveBeenCalled();

    const created = await useTodosStore.getState().add("  buy milk  ");
    expect(created?.text).toBe("buy milk");
    expect(created?.done).toBe(false);
    expect(useTodosStore.getState().todos[0].text).toBe("buy milk");
    expect(ipcMock.client.todos.save).toHaveBeenCalledTimes(1);
  });

  it("toggle() flips done and stamps completedAt", async () => {
    await useTodosStore.getState().add("a");
    const id = useTodosStore.getState().todos[0].id;

    await useTodosStore.getState().toggle(id);
    let after = useTodosStore.getState().todos[0];
    expect(after.done).toBe(true);
    expect(after.completedAt).toBeDefined();

    await useTodosStore.getState().toggle(id);
    after = useTodosStore.getState().todos[0];
    expect(after.done).toBe(false);
    expect(after.completedAt).toBeUndefined();
  });

  it("setText updates text or removes when empty", async () => {
    await useTodosStore.getState().add("a");
    const id = useTodosStore.getState().todos[0].id;

    await useTodosStore.getState().setText(id, "renamed");
    expect(useTodosStore.getState().todos[0].text).toBe("renamed");

    await useTodosStore.getState().setText(id, "   ");
    expect(useTodosStore.getState().todos).toHaveLength(0);
  });

  it("remove() drops the todo", async () => {
    await useTodosStore.getState().add("a");
    const id = useTodosStore.getState().todos[0].id;
    await useTodosStore.getState().remove(id);
    expect(useTodosStore.getState().todos).toHaveLength(0);
  });

  it("clearCompleted() keeps only open todos", async () => {
    await useTodosStore.getState().add("a");
    await useTodosStore.getState().add("b");
    const a = useTodosStore.getState().todos[1].id;
    await useTodosStore.getState().toggle(a);
    await useTodosStore.getState().clearCompleted();
    const remaining = useTodosStore.getState().todos;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].done).toBe(false);
  });

  it("selectors split open/completed", async () => {
    await useTodosStore.getState().add("a");
    await useTodosStore.getState().add("b");
    const second = useTodosStore.getState().todos[0].id;
    await useTodosStore.getState().toggle(second);
    const state = useTodosStore.getState();
    expect(selectOpenTodos(state)).toHaveLength(1);
    expect(selectCompletedTodos(state)).toHaveLength(1);
  });

  it("captures load error", async () => {
    ipcMock.client.todos.load.mockRejectedValue(new Error("boom"));
    await useTodosStore.getState().load();
    expect(useTodosStore.getState().status).toBe("error");
    expect(useTodosStore.getState().error).toBe("boom");
  });
});
