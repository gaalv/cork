# Testing Infrastructure

## Test Frameworks

- **Unit / Component:** Vitest 4 + React Testing Library 16 + `@testing-library/jest-dom` + jsdom
- **E2E:** Playwright (against `vite preview` and `pnpm tauri dev`)
- **Coverage:** `@vitest/coverage-v8`
- **Rust:** built-in `cargo test`

## Test Organization

**Unit/component tests live next to the source:**
```
src/features/home/ui/HomeHero.tsx
src/features/home/ui/HomeHero.test.tsx
```

**Naming:**
- Unit/component: `*.test.ts` / `*.test.tsx`
- E2E: `tests/e2e/*.spec.ts`

**Structure:**
- `tests/e2e/` — Playwright specs grouped by feature (`home.spec.ts`, `editor.spec.ts`, …)
- `tests/fixtures/` — sample vaults used by both Vitest (via fixtures) and Playwright

## Testing Patterns

### Unit tests

**Approach:** Pure function + hook tests with Vitest. No mocks unless absolutely needed.
**Location:** Adjacent to source.
**Example shape:**
```ts
import { describe, it, expect } from 'vitest'
import { extractWikilinks } from './wikilinks'

describe('extractWikilinks', () => {
  it('returns wikilinks in source order', () => {
    expect(extractWikilinks('see [[A]] and [[B]]')).toEqual(['A', 'B'])
  })
  it('ignores escaped brackets', () => {
    expect(extractWikilinks('not a \\[\\[link\\]\\]')).toEqual([])
  })
})
```

### Component tests

**Approach:** RTL queries by accessible role/name. No querying by class. Mock IPC via a single `vi.mock('@/shared/ipc/...')`.
**Pattern:**
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

it('opens palette on ⌘K', async () => {
  render(<Shell />)
  await userEvent.keyboard('{Meta>}k{/Meta}')
  expect(screen.getByRole('dialog', { name: /command palette/i })).toBeInTheDocument()
})
```

### E2E tests

**Approach:** One smoke spec per critical flow. Playwright runs against `vite preview` for fast loops; a separate config runs against `pnpm tauri dev` for full Tauri assertions (release-prep).
**Critical flows (must always be green):**
1. App launches → Home renders.
2. Open vault picker → select fixture vault → Home shows seeded notes.
3. Click a note card → editor opens with content.
4. Type → autosave persists (verify via second open).
5. ⌘K → search → enter → navigates.
6. Click wikilink → navigates.
7. Click backlink → navigates.

### Rust tests

**Approach:** `#[cfg(test)]` modules inside the file under test for unit; `src-tauri/tests/*.rs` for integration (full IPC commands against a temp vault + temp SQLite).
**Pattern:**
```rust
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn extract_tags_handles_hierarchy() {
        let body = "# h\n\n#dev/rust some text";
        assert_eq!(extract_tags(body), vec!["dev/rust".into()]);
    }
}
```

## Test Execution

**Local:**
```bash
pnpm test              # vitest run
pnpm test:watch        # vitest watch
pnpm test:coverage     # vitest with coverage
pnpm test:e2e          # playwright (preview)
pnpm test:e2e:tauri    # playwright (tauri dev)
cargo test             # rust unit + integration (run from src-tauri/)
```

**CI (GitHub Actions):**
- `lint-typecheck` job: `pnpm lint && pnpm typecheck`
- `unit` job: `pnpm test --reporter=dot`
- `e2e-smoke` job: `pnpm test:e2e -- tests/e2e/smoke/*.spec.ts`
- `rust` job: `cd src-tauri && cargo test`
- `tauri-build` job (matrix): `pnpm tauri build` per OS, on tags only.

## Coverage Targets

**Goals (not enforced as hard gates in v1, but tracked):**
- Pure helpers (`shared/utils`, `shared/md`): 90%+
- Stores (`shared/stores`): 80%+
- Components: 60% (leaning on E2E for the rest)
- Rust: 70% on `index/` and `vault/`

**Enforcement:** PRs must not drop coverage of any tested file below its existing %. Untested new code is allowed if it has E2E coverage.

## Test Data

- Fixture vault at `tests/fixtures/sample-vault/` — small set of `.md` files exercising tags, wikilinks, KaTeX, Mermaid, code blocks, tasks. Mirrors `prototype/src/data/mock.ts` content but as real files.
- Fixture SQLite seed builder at `src-tauri/tests/common/seed.rs`.
