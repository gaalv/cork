# Code Conventions

These are the rules every agent (human or AI) must follow when writing code in Cork.

## Naming

**Files:**
- React components: `PascalCase.tsx` (e.g., `CommandPalette.tsx`)
- Hooks: `useCamelCase.ts` (e.g., `useActiveNote.ts`)
- Stores: `camelCaseStore.ts` (e.g., `vaultStore.ts`)
- IPC wrappers: `camelCase.ts` matching the command namespace (e.g., `vault.ts`, `notes.ts`)
- Pure helpers: `camelCase.ts`
- Test files: same base name + `.test.ts(x)` (component tests) or `.spec.ts` (Playwright)
- Rust modules: `snake_case.rs`

**Symbols:**
- React components: `PascalCase`
- Hooks: `useXxx`
- Zustand selectors: `useXxxStore` (the hook itself); selectors named after what they return (`(s) => s.recentNotes`)
- TS types/interfaces: `PascalCase`. Prefer `type` over `interface` unless declaration merging is needed.
- Constants: `SCREAMING_SNAKE_CASE` only for true module-level constants. Otherwise `camelCase`.
- Rust functions/methods: `snake_case`. Types: `PascalCase`. Constants: `SCREAMING_SNAKE_CASE`.

**Tauri commands:**
- Namespaced dot-separated names: `vault.open`, `notes.save`, `index.search`, `links.resolve`.

## Imports

Order (enforced by ESLint):

1. Node/builtins
2. External packages (`react`, `@tauri-apps/api`, …)
3. Aliases (`@/shared/...`, `@/features/...`)
4. Relative (`./...`, `../...`)
5. Type-only imports last, prefixed with `import type`

Use `@/` path alias for imports that cross feature/shared boundaries. Same-folder imports stay relative.

## File structure within a component

```tsx
// 1. Imports
import { …} from '…'
import type { … } from '…'

// 2. Types (component-local)
type Props = { … }

// 3. Component (default export at the bottom or named)
export function Foo({ a, b }: Props) {
  // 4. Hooks (in order: state → context → effects → handlers)
  const [x, setX] = useState(…)

  // 5. Render
  return <div>…</div>
}

// 6. Subcomponents (only if private to this file)
function FooHeader() { … }
```

Keep components < 200 lines. If bigger, split into subcomponents in the same folder.

## Type safety

- `tsconfig` has `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `verbatimModuleSyntax: true`.
- Never `any`. If you truly need an escape hatch, use `unknown` and narrow.
- Prefer discriminated unions over optional fields for state machines.
- Public exports MUST be typed; inferred types are fine inside a function body.
- Public Rust functions: explicit lifetimes only when the compiler asks; prefer owned types at IPC boundaries.

## Styling (Tailwind v4)

- All design tokens go in `@theme` inside `src/index.css`. Do not hardcode hex values in components.
- Use `clsx` + `tailwind-merge` (`cn(...)`) helper from `@/shared/ui/cn.ts` for conditional classes.
- Avoid arbitrary values when a token exists. `text-[var(--color-cork-ink)]` is allowed and preferred over `text-stone-900`.
- No CSS Modules, no styled-components, no Emotion. Tailwind only.

## State management

- Local UI state → `useState` / `useReducer`.
- Cross-feature state → Zustand store in `shared/stores/`.
- Server-ish state (notes, index queries) → custom hooks in the feature that call IPC and cache locally; no React Query in v1 (keeps deps lean).
- No prop-drilling deeper than 2 levels — lift to a store.

## Optimistic mutations

All data mutations (tags, pins, notes, folders) follow ONE consistent pattern. Mutations live in Zustand stores — components never call IPC directly for writes.

**Pattern (store side):**

```ts
mutationMethod: async (args) => {
  // 1. Snapshot previous state
  const prev = get().someState;

  // 2. Optimistic update (synchronous — UI reflects immediately)
  set((state) => ({ someState: applyChange(state.someState, args) }));

  // 3. Persist via IPC (async)
  try {
    await client.namespace.command(args);
  } catch (err) {
    // 4. Rollback on error and re-throw
    set({ someState: prev });
    throw err;
  }
}
```

**Pattern (component side):**

```tsx
try {
  await store.mutationMethod(args);
  toast.success("Done");
} catch {
  toast.error("Failed"); // store already rolled back
}
```

**Exception — tag-on-note mutations:** `addTagToNote` / `removeTagFromNote` are synchronous (no IPC persist) because persistence is handled by the editor's auto-save of frontmatter. The optimistic update still applies immediately so counters and lists reflect the change.

**Where mutations live:**
- `indexStore`: `toggleNotePin`, `addTagToNote`, `removeTagFromNote`, `createTag`, `renameTag`, `deleteTag`
- `vaultStore`: `trashNote`, `moveNote`

**Rules:**
- Components MUST NOT call `client.*` for writes — use store mutation methods.
- Components handle toast feedback only; stores handle state + persistence + rollback.
- The `index:updated` event from the Rust indexer triggers `refreshIndex()` which reconciles optimistic state with the truth in SQLite. This is the background consistency mechanism.

## Error handling

**Rust → frontend:**
- Each IPC command returns `Result<T, IpcError>` where `IpcError` is a serializable enum (`NotFound`, `Io`, `Parse`, `Conflict`, `Unauthorized`, …).
- Never panic across the IPC boundary; convert `?` to `IpcError` via `From` impls.

**Frontend:**
- Wrap IPC calls in try/catch in the typed wrapper layer (`shared/ipc/`); UI receives discriminated unions or throws and is caught by an `<ErrorBoundary>` per route.
- User-visible errors go through a single `toast()` helper (TBD in F04).

## Comments

Only when code needs clarification. No JSDoc on every function. Document _why_, not _what_.

Allowed:
- Tricky algorithm explanations
- TODO/FIXME with a tracking issue or STATE.md entry reference
- Public API docstrings on shared utilities

## Tests

- Unit + component tests live next to the source: `Foo.tsx` ↔ `Foo.test.tsx`.
- E2E specs live in `tests/e2e/` and use Playwright fixtures.
- One assertion theme per test. Test names read as user-visible behavior: `'opens command palette on ⌘K'`.
- Avoid snapshot tests except for stable, opinionated UI primitives.

## Git

- Branch naming: `feat/Fxx-short-slug`, `fix/short-slug`, `docs/...`.
- Conventional Commits 1.0 (see `references/implement.md`). One task = one commit.
- Trailer: every commit by an agent ends with `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.
- PRs reference the feature ID and requirement IDs they cover.

## Accessibility

- Every interactive element has an accessible name (`aria-label` if not text).
- Keyboard: tab order matches visual order; ⌘K, Esc, ↑/↓ wired in palette and drawers.
- Focus rings preserved (Tailwind `focus-visible:` classes); never `outline: none` without a replacement.
- Use Radix primitives where possible — they ship a11y by default.

## Performance baselines

- Cold start (Tauri release build): < 1.5 s on M1/M2 Mac.
- Open a 1k-note vault: index < 3 s; subsequent loads < 200 ms.
- Editor typing latency: < 16 ms keystroke → render.
- Bundle size budget: < 500 kB gzipped JS for the WebView.

These are guardrails. If a task threatens them, it must be flagged in STATE.md and discussed before merging.
