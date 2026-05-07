# Deferred — ideas to revisit

These features were proposed but deferred from the current sprint because each is large enough to deserve its own design pass. Saved here so we can pick them up cleanly.

## D1 — Calendar / agenda + Google Calendar integration

**Status.** v0 (month grid with daily-note indicators) and v1 (right-side agenda panel) were implemented in **F19** — see `.specs/features/F19-calendar-view/`.

**What was implemented in F19:**
- `{ kind: "calendar" }` screen accessible from the Rail sidebar (`CalendarBlank` icon).
- Month grid with 7-column DOW header, up to 6 rows of day cells, prev/next/today navigation, and month+year title.
- Day cells highlight today, show a dot indicator when a daily note or `event:`-frontmatter note exists for that day.
- Clicking a day with a daily note opens it; clicking a day without one opens the Agenda panel.
- Agenda panel lists the daily note + event notes for the selected day, each clickable; shows "Create daily note" CTA when none exists; dismissable via close button or Escape.

**Still deferred:**
- Google Calendar OAuth / one-way sync (using `tauri-plugin-oauth` or a Rust OAuth flow, store `refresh_token` in OS keychain).
- Week view and day view.
- Drag-to-create events.
- Recurring events.
- Settings flag to configure calendar source.

## D2 — GitHub sync (Obsidian-style) + per-note history sidebar

**Idea.** With the user's permission, create a private GitHub repo and push the vault to it. Show per-note commit history in the right sidebar (similar to Tolaria) with rollback. Multi-device picks up the latest.

**Why deferred.**
- Two real subsystems: vault-level git repo management, and a UX for browsing/restoring history.
- Conflict handling is the hard part (Obsidian Sync handles it well but they own the protocol — with vanilla git we have to solve merge UX).
- GitHub OAuth + repo provisioning needs scopes the user must grant.
- Need to decide: shell out to `git` CLI (small, robust) vs `git2` (libgit2 binding, heavy).

**Sketch when picked up.**
1. v0 — local git only: `git init` on the vault, autocommit on save with a debounce, show local history. ✅ **Implemented in F18** — see `.specs/features/F18-local-git-sync/`.
2. v1 — GitHub: `gh auth status` integration to authorise; `gh repo create --private`; auto push on commit.
3. v2 — multi-device: pull-on-open, per-file conflict resolver UI ("keep mine / keep theirs / 3-way merge").
4. Sidebar: list commits touching the open note; clicking a commit shows a diff and a "Restore this version" button that writes the file at that revision. ✅ **Implemented in F18 (without diff view — diff is still deferred).**

**Still deferred (D2 remainder):**
- GitHub OAuth / remote push (v1)
- Multi-device pull-on-open + conflict resolution UI (v2–v3)
- In-sidebar diff view

## D3 — AI integration (Claude Code + Copilot CLI)

**Status.** v1 (right-side chat panel scoped to open note) implemented in **F20** — see `.specs/features/F20-ai-chat/`.

**What was implemented in F20:**
- `AppSettings.ai.provider` setting (`disabled` | `claude` | `copilot`), default `disabled`.
- Settings "AI" section with provider Select.
- Rust `ai` module: `ai_send_prompt` Tauri command — binary discovery via `which`/`where`, stdin piping, 60s timeout, typed `AiError` with `kind` field.
- IPC contract + client for `ai.sendPrompt`.
- `useAiStore` Zustand store (in-memory messages, `sendPrompt`, `clearChat`, `togglePanel`).
- `aiClient` service (context builder capped at 50 KB, IPC wrapper).
- `ChatPanel` + `MessageBubble` components — assistant replies rendered as Markdown via `react-markdown`.
- AI chat toggle button in TopBar (visible when a note is open).

**Still deferred:**
- Streaming output (SSE / chunked stdout).
- Multi-note context / pinned notes.
- Vector search / RAG / embeddings.
- AI-driven note editing (inline rewrites, insertions).
- Conversation persistence across restarts.
- Tool calls / function calling.
- Response caching keyed on note hash + prompt.

---

When you want to pick any of these up: open `.specs/features/F<NN>-<slug>/` with `tlc-spec-driven` and we'll size it from this sketch.
