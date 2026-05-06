# Tech Stack

**Analyzed:** 2026-05-06 (greenfield — stack defined, scaffold pending in F01)

## Core

- Framework: **Tauri 2** (`@tauri-apps/api ^2.10`, `@tauri-apps/cli ^2.10`)
- Language: **TypeScript 5.9**, **Rust** (stable)
- Runtime: System WebView (WebKit on macOS, WebView2 on Windows, WebKitGTK 4.1 on Linux)
- Package manager: **pnpm 10+** (via `corepack`)

## Frontend

- UI Framework: **React 19**
- Bundler: **Vite 7** (`@vitejs/plugin-react`)
- Styling: **Tailwind CSS v4** (`@tailwindcss/vite`, `@theme` design tokens, no `tailwind.config.js`)
- Icons: **`@phosphor-icons/react`** (primary), **`lucide-react`** (fallback / Radix-style)
- Primitives: **`@radix-ui/react-*`** (`dialog`, `dropdown-menu`, `tooltip`, `tabs`, `select`, `separator`, `slot`)
- State management: **`zustand`** for cross-cutting state; React state for local
- Markdown render: **`react-markdown`** + **`remark-gfm`** + **`rehype-highlight`** (Shiki theme)
- Math: **`katex`**
- Diagrams: **`mermaid`**
- Editor: **CodeMirror 6** (`@codemirror/state`, `@codemirror/view`, `@codemirror/lang-markdown`, `@codemirror/commands`, `@codemirror/language`, `@lezer/highlight`)
- Class utilities: **`clsx`** + **`tailwind-merge`** + **`class-variance-authority`**
- Sanitization: **`dompurify`** (preview HTML)
- Dates: **`date-fns`**

## Backend (Rust, `src-tauri`)

- DB driver: **`rusqlite`** with `bundled` feature (ships SQLite, no system dep)
- Markdown parser: **`pulldown-cmark`** (indexing pipeline)
- File watcher: **`notify`** (cross-platform native watcher)
- Async: **`tokio`** (Tauri default runtime)
- Serde: **`serde`** + **`serde_json`** (IPC payloads)

## Testing

- Unit / Component: **Vitest 4** + **React Testing Library 16** + **`@testing-library/jest-dom`** + **`jsdom`**
- E2E / Smoke: **Playwright** (driven against `vite preview` and `pnpm tauri dev` — pattern from Tolaria)
- Coverage: **`@vitest/coverage-v8`**
- Rust unit: built-in `cargo test`

## Dev Tools

- Lint: **ESLint 9** flat config + **`typescript-eslint`** + **`eslint-plugin-react-hooks`** + **`eslint-plugin-react-refresh`**
- Format: **Prettier 3** (default, no rules customization unless agreed)
- Hooks: **husky 9** + lint-staged equivalent (pnpm)
- CI: **GitHub Actions** (lint, typecheck, vitest, playwright smoke, tauri build per OS)
- Bundling check: **`pnpm build`** must succeed; bundle size budgeted in F01.

## External Services

_None in v1._ All AI features deferred (AD-012). No telemetry, no Sentry in v1.
