import { create } from "zustand";

import { client } from "@/shared/ipc/client";

import type { Todo, TodoList } from "@/shared/ipc/IpcContract";

type Status = "idle" | "loading" | "error";

interface TodosState {
  todos: Todo[];
  status: Status;
  error: string | null;
  load: () => Promise<void>;
  add: (text: string) => Promise<Todo | null>;
  toggle: (id: string) => Promise<Todo | null>;
  setText: (id: string, text: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function persist(todos: Todo[]): Promise<TodoList> {
  return client.todos.save({ todos });
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return String(err);
}

export const useTodosStore = create<TodosState>((set, get) => ({
  todos: [],
  status: "idle",
  error: null,

  async load() {
    set({ status: "loading", error: null });
    try {
      const list = await client.todos.load();
      set({ todos: list.todos, status: "idle", error: null });
    } catch (err) {
      set({ status: "error", error: describeError(err) });
    }
  },

  async add(rawText) {
    const text = rawText.trim();
    if (!text) return null;
    const next: Todo = {
      id: makeId(),
      text,
      done: false,
      createdAt: nowIso(),
    };
    const todos = [next, ...get().todos];
    set({ todos });
    try {
      await persist(todos);
      return next;
    } catch (err) {
      set({ error: describeError(err) });
      return next;
    }
  },

  async toggle(id) {
    const target = get().todos.find((t) => t.id === id);
    if (!target) return null;
    const updated: Todo = target.done
      ? { ...target, done: false, completedAt: undefined }
      : { ...target, done: true, completedAt: nowIso() };
    const todos = get().todos.map((t) => (t.id === id ? updated : t));
    set({ todos });
    try {
      await persist(todos);
    } catch (err) {
      set({ error: describeError(err) });
    }
    return updated;
  },

  async setText(id, rawText) {
    const text = rawText.trim();
    if (!text) {
      await get().remove(id);
      return;
    }
    const todos = get().todos.map((t) => (t.id === id ? { ...t, text } : t));
    set({ todos });
    try {
      await persist(todos);
    } catch (err) {
      set({ error: describeError(err) });
    }
  },

  async remove(id) {
    const todos = get().todos.filter((t) => t.id !== id);
    set({ todos });
    try {
      await persist(todos);
    } catch (err) {
      set({ error: describeError(err) });
    }
  },

  async clearCompleted() {
    const todos = get().todos.filter((t) => !t.done);
    set({ todos });
    try {
      await persist(todos);
    } catch (err) {
      set({ error: describeError(err) });
    }
  },
}));

export function selectOpenTodos(state: TodosState): Todo[] {
  return state.todos.filter((t) => !t.done);
}
export function selectCompletedTodos(state: TodosState): Todo[] {
  return state.todos.filter((t) => t.done);
}
