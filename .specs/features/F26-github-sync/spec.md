# F26 – GitHub Sync (D2 v1)

> **Status:** Spec only — not yet implemented. Builds on F18 (local git auto-commit) and DEFERRED.md § D2 v1.

## Overview

Lift the per-vault local git repo from F18 into a private GitHub repo so a single user can sync the vault across machines. **Single-user, single-active-device assumption** — concurrent edits on multiple devices use a deliberately conservative conflict strategy (see R5). Multi-user / true real-time co-editing remains deferred.

The intended UX target is "Obsidian Sync minus the server fee": opt in once, then forget — push happens after auto-commit, pull happens at vault open and on a heartbeat.

---

## Open questions (must resolve before Design)

These are the gray-area decisions that cannot be made by the agent. Each blocks implementation.

- **Q1 — Auth strategy.** `gh` CLI (assume the user is logged in via `gh auth login`) vs OAuth Device Flow inside the app. `gh` is easier to ship; OAuth is better UX but significantly more code (token storage, refresh, scopes UI).
- **Q2 — Repo provisioning.** Auto-create on first enable (`gh repo create --private noxe-vault-<rand>`) vs ask the user to paste an existing remote URL vs both (recommended).
- **Q3 — Conflict policy.** Three concrete options:
  - (a) "Last writer wins" — pull with `-X theirs`, never block; simpler.
  - (b) Pull → if conflict, mark file with `<<<<<<<` markers and surface a "Conflict" banner per note; require user to resolve in the editor.
  - (c) Pull → if conflict, save remote as `Note (conflict from device-X).md` so both sides survive (Obsidian's pre-Sync behaviour). **Likely best default for a notes app.**
- **Q4 — Pull cadence.** Pull on vault open only, or also on a 60 s timer, or only when window regains focus?
- **Q5 — Failure surfacing.** Should push errors show a toast every time, or just light up a badge in the rail / status bar? Same for pull errors.
- **Q6 — `.gitignore` for `.noxe/`.** Sync `.noxe/config.json` and `todos.json`? They are per-vault state but contain device-specific bits. Recommend: ignore `.noxe/` entirely and keep settings/todos local.
- **Q7 — Large binary files.** Vault may contain images / PDFs via assets. Do we ship Git LFS support, or hard-cap file size and warn?

> Implementation cannot start until Q1, Q3, Q4, and Q6 are answered. Q2, Q5, Q7 have safe defaults.

---

## Requirements (assuming `gh` CLI + conflict-as-copy + pull-on-open+focus)

### R1 – Remote enablement
- **R1.1** New vault-scoped setting `gitRemote: { enabled: boolean; url?: string; provider: "github" }`. Default `{ enabled: false, provider: "github" }`.
- **R1.2** New IPC `vcs.remote.enable({ url? })`:
  - If `url` omitted, run `gh auth status` → `gh repo create --private --source . --push` to provision.
  - If `url` provided, run `git remote add origin <url>` (or update if exists) + `git push -u origin main`.
  - Persists `gitRemote.enabled = true` and the URL.
- **R1.3** New IPC `vcs.remote.disable()` removes the remote and clears the setting (does NOT delete the GitHub repo).

### R2 – Auto-push
- **R2.1** After every auto-commit produced by F18, schedule a `git push` (debounced 5 s, coalesces while a push is in flight).
- **R2.2** On push failure (non-fast-forward, network, auth), record the error in `vcs.status` and surface a toast (severity = warning) once per error transition. Subsequent identical errors are silent until status changes.
- **R2.3** If `gitRemote.enabled = false`, this is a no-op.

### R3 – Auto-pull
- **R3.1** On vault open, if remote is enabled, run `git pull --ff-only`.
- **R3.2** On window `focus` event after >60 s idle, repeat R3.1.
- **R3.3** A user-visible "Sync now" command (palette + tray) that forces pull-then-push.

### R4 – Status surface
- **R4.1** Extend `vcs.status` to return `{ remote: { enabled, url?, lastPush?, lastPull?, lastError? } }`.
- **R4.2** Rail badge: a small dot on the Settings (or new Sync) icon indicating `idle | syncing | error`.
- **R4.3** Settings → Files & Vaults → "GitHub sync" subsection shows enable toggle, URL, last sync time, last error (if any).

### R5 – Conflict strategy (chosen: option c — preserve both)
- **R5.1** When `git pull --ff-only` fails with merge conflicts, abort the merge, then for each conflicted file: copy the *remote* version to `<basename> (conflict from <hostname> <ISO-timestamp>).md`, restore the local working tree, commit both files, and push.
- **R5.2** Surface a "Conflicts resolved by copy" toast listing the affected paths.
- **R5.3** Never block the editor; never present `<<<<<<<` markers to the user.

### R6 – Settings UI
- **R6.1** Files & Vaults → "GitHub sync" panel:
  - Toggle "Enable GitHub sync".
  - When enabling: dialog asks "Create new private repo" or "Use existing URL".
  - Shows remote URL, last push, last pull, last error.
  - Button "Sync now" (calls R3.3).
  - Button "Disable" (calls R1.3).

### R7 – Telemetry / logs
- **R7.1** Push/pull stdout+stderr logged to `.noxe/sync.log` in the vault, capped at 1 MB rolling.

---

## Out of scope (still deferred — D2 v2+)

- Real-time multi-device editing (CRDT / Yjs / Automerge).
- Multi-user collaboration on the same vault.
- In-editor 3-way merge UI.
- Git LFS / large binary handling (see Q7).
- Provider plurality (GitLab, Bitbucket, self-hosted Forgejo).
- Mobile sync (depends on Tauri mobile target).

---

## Acceptance criteria

- `pnpm typecheck` ✓ / `pnpm lint` ✓ / `pnpm vitest run` ✓ / `cargo test --lib` ✓
- Toggling "Enable GitHub sync" in Settings on a fresh vault provisions a private repo and pushes the initial commit.
- Editing a note offline, then coming online, pushes the auto-commit within ~10 s.
- Editing the same note on two machines while both are offline, then connecting both → both versions exist in the repo with the conflict-copy filename suffix on the second-arriving side. No data loss.
- Disabling sync removes the remote but leaves the GitHub repo intact.

---

## Dependencies / assumptions

- F18 local git module (`src-tauri/src/vcs/`) is the foundation. New code lives alongside, not replaces.
- User has `git` and `gh` on PATH and is authenticated via `gh auth login`. **The app does not handle OAuth in this version.** First enable runs `gh auth status`; if it fails, show a setup hint.
- Vault has a `main` branch (F18 already enforces this).

---

## Risks

- **`gh` not installed.** Mitigation: detect on enable, show install hint, keep feature dormant.
- **Push storms.** Mitigation: 5 s debounce + in-flight coalescing.
- **Hostile repo state** (force-pushed remote): pull will fail; user must resolve manually via terminal. Out of scope to recover from.
- **Secrets in vault.** Notes can contain anything; private repo + user awareness is the only protection.
