import { useEffect, useRef, useState } from "react";
import { CheckSquare, Square, Trash, X } from "@phosphor-icons/react";

import { selectCompletedTodos, selectOpenTodos, useTodosStore } from "@/features/todos/state/todosStore";

import type { Todo } from "@/shared/ipc/IpcContract";

export function TodosView() {
  const todos = useTodosStore((s) => s.todos);
  const status = useTodosStore((s) => s.status);
  const error = useTodosStore((s) => s.error);
  const load = useTodosStore((s) => s.load);
  const add = useTodosStore((s) => s.add);
  const clearCompleted = useTodosStore((s) => s.clearCompleted);

  const [input, setInput] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const open = selectOpenTodos({ todos, status, error, load, add, clearCompleted } as never);
  const completed = selectCompletedTodos({ todos, status, error, load, add, clearCompleted } as never);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    void add(text);
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-[var(--color-noxe-bg)]">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-noxe-border)] px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-noxe-ink)]">Todos</h1>
          <p className="text-xs text-[var(--color-noxe-muted)]">
            {open.length} open · {completed.length} done
          </p>
        </div>
        {completed.length > 0 ? (
          <button
            type="button"
            onClick={() => void clearCompleted()}
            className="rounded-md border border-[var(--color-noxe-border)] px-3 py-1 text-xs text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-hover)] hover:text-[var(--color-noxe-ink)]"
          >
            Clear completed
          </button>
        ) : null}
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
        <form onSubmit={onSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(event) => setInput(event.currentTarget.value)}
            placeholder="Add a todo and press Enter…"
            className="w-full rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--color-noxe-border-strong)]"
          />
        </form>

        {error ? (
          <p className="text-xs text-[var(--color-noxe-danger,#dc2626)]" role="alert">
            {error}
          </p>
        ) : null}

        <section aria-label="Open todos" className="space-y-1">
          {open.length === 0 ? (
            <p className="rounded-md border border-dashed border-[var(--color-noxe-border)] px-3 py-6 text-center text-xs text-[var(--color-noxe-muted)]">
              No open todos. Use the input above or <kbd className="rounded bg-[var(--color-noxe-panel-2)] px-1">⌘K</kbd> → "New todo".
            </p>
          ) : (
            open.map((todo) => <TodoRow key={todo.id} todo={todo} />)
          )}
        </section>

        {completed.length > 0 ? (
          <section aria-label="Completed todos" className="space-y-1">
            <button
              type="button"
              onClick={() => setShowCompleted((s) => !s)}
              className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-noxe-muted)] hover:text-[var(--color-noxe-ink)]"
            >
              {showCompleted ? "▾" : "▸"} Completed ({completed.length})
            </button>
            {showCompleted ? completed.map((todo) => <TodoRow key={todo.id} todo={todo} />) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function TodoRow({ todo }: { todo: Todo }) {
  const toggle = useTodosStore((s) => s.toggle);
  const setText = useTodosStore((s) => s.setText);
  const remove = useTodosStore((s) => s.remove);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft !== todo.text) {
      void setText(todo.id, draft);
    }
  }

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--color-noxe-hover)]">
      <button
        type="button"
        aria-label={todo.done ? "Mark as open" : "Mark as done"}
        onClick={() => void toggle(todo.id)}
        className="text-[var(--color-noxe-muted)] hover:text-[var(--color-noxe-ink)]"
      >
        {todo.done ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
      </button>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              setDraft(todo.text);
              setEditing(false);
            }
          }}
          className="flex-1 rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-bg)] px-2 py-1 text-sm outline-none"
        />
      ) : (
        <button
          type="button"
          onDoubleClick={() => {
            setDraft(todo.text);
            setEditing(true);
          }}
          className={`flex-1 cursor-text text-left text-sm ${
            todo.done ? "text-[var(--color-noxe-muted)] line-through" : "text-[var(--color-noxe-ink)]"
          }`}
        >
          {todo.text}
        </button>
      )}
      <button
        type="button"
        aria-label="Delete"
        onClick={() => void remove(todo.id)}
        className="opacity-0 transition group-hover:opacity-100 text-[var(--color-noxe-muted)] hover:text-[var(--color-noxe-danger,#dc2626)]"
      >
        {todo.done ? <X size={14} /> : <Trash size={14} />}
      </button>
    </div>
  );
}
