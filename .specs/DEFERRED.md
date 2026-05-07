# Deferred — ideas to revisit

These features were proposed but deferred from the current sprint because each is large enough to deserve its own design pass. Saved here so we can pick them up cleanly.

## D1 — Calendar / agenda + Google Calendar integration

**Idea.** Dedicated screen with a calendar view (month/week) that surfaces daily notes plus events. Optional Google Calendar OAuth so events can be opened as notes (one note per event).

**Why deferred.**
- Calendar UI itself is non-trivial (month grid, week grid, navigation, event blocks).
- Google Calendar requires OAuth2 client registration, token refresh storage, and an offline strategy.
- Touches new IPC endpoints and probably a new sqlite table.

**Sketch when picked up.**
1. Read-only calendar view that aggregates `Daily/` notes by date — no Google API yet.
2. Frontmatter `event:` field on regular notes that pins them to a date.
3. Behind a settings flag: Google Calendar sync (one-way pull) using `tauri-plugin-oauth` or a Rust OAuth flow. Store `refresh_token` in the OS keychain (`tauri-plugin-stronghold`).
4. "Create note from event" action.

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

**Idea.** Hook Noxe up to the user's existing CLI assistants. Could be: side-panel chat, "summarise this note", "generate frontmatter", or arbitrary "ask the AI about my vault".

**Why deferred.**
- Two integration shapes are very different (chat panel vs in-line actions). Need to pick one.
- Claude Code and Copilot CLI both expose CLI surfaces, not stable HTTP APIs we can call from Tauri without spawning subprocesses.
- Authn / sandboxing of subprocess execution from a desktop app is its own design problem.
- "AI reads the vault" implies vector indexing, embeddings storage, retrieval — a substantial subproject.

**Sketch when picked up.**
1. Pick a single shape: a right-sidebar chat that scopes context to the open note + user-pinned notes.
2. Provider selection in Settings: `claude`, `copilot`, or `disabled`.
3. Backend spawns the chosen CLI as a subprocess (`std::process::Command`) and pipes prompts through it.
4. Stretch: cache responses keyed on note hash + prompt.

---

When you want to pick any of these up: open `.specs/features/F<NN>-<slug>/` with `tlc-spec-driven` and we'll size it from this sketch.
