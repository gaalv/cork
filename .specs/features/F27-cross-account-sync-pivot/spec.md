# F27 — Cross-account sync auth pivot (folded into F26)

**Status:** ABSORBED INTO F26 (no standalone shipping artefact)

## Why this number exists

While stabilising F26 GitHub sync the user's environment (work laptop
with `gh` CLI authed to an enterprise account, personal vault repo
target) exposed a hard limitation of the HTTPS+PAT auth path: macOS
Keychain and the `gh` credential helper consistently override per-repo
`extraheader` PAT credentials, producing HTTP 403 with the PAT showing
as "never used" on GitHub.

We provisionally tracked the follow-up as **F27** in STATE (AD-022)
while exploring REST-API/OAuth Device Flow. After several failed
iterations the team converged on **SSH Deploy Keys via
`ssh.github.com:443`** as the single sanctioned auth path. That choice
collapsed the cross-account problem entirely and made a separate F27
release unnecessary — the work shipped as part of F26 hardening:

- `ef2b523` feat(sync): SSH deploy key option for GitHub sync
- `4950680` fix(sync): auto-fallback SSH push to ssh.github.com:443
- `1aca37b` fix(sync): commit + push all vault changes, not just note saves
- `9e792f0` feat(sync): structured commit messages with file lists + timestamps

## Decision

- HTTPS+PAT path was **removed** from both UI and backend (no dead
  config knobs left behind).
- `gh`-CLI auto-create was **removed** — user creates the empty private
  repo on GitHub and pastes its SSH URL.
- All sync uses SSH with `ssh.github.com:443` autofallback.

## Why no separate F27 ships

The user feedback ("for devs this setup is intuitive and secure") plus
the elimination of cross-account complexity means a dedicated F27
release adds no user-visible surface. The decision is captured here so
future readers find the rationale at the expected location.

See `STATE.md` AD-037 / AD-038 for the architectural decisions.
