# F35 — Crash + error reporting (opt-in)

**Status:** PLANNED
**Scope:** Large (Rust panic hook, JS error boundary, log rotation, Settings panel, opt-in flow)
**Depends on:** F33 (release builds need symbols for useful stack traces)

## Overview

Noxe is local-first (PROJECT.md vision) — we do **not** send telemetry
by default. But once it ships publicly, we still need a way for users
who hit a bug to give us reproducible signal without scraping logs by
hand. F35 adds:

1. **Always-on local logging:** Rust panics and unhandled JS errors
   get written to a rotating file under the OS log dir. Nothing
   leaves the machine.
2. **Opt-in remote reporting:** A Settings toggle (default **off**)
   that, when enabled, ships the same payload to a single configured
   endpoint (default: a free Sentry project) with a clear consent
   notice describing exactly what gets sent.

The privacy contract is: zero data leaves the machine until the user
explicitly opts in, and we surface the payload before they do.

## In scope

### Always-on local logging

- **R1** Add a Rust panic hook in `src-tauri/src/lib.rs::run()` (set
  via `std::panic::set_hook`) that captures `payload`, `location`,
  `thread`, and a Rust backtrace (when `RUST_BACKTRACE=1`), and
  appends a structured JSON line to
  `<app_log_dir>/crashes.log`.
- **R2** Add a JS-side error boundary (`<RootErrorBoundary>`) wrapping
  the shell, plus a `window.addEventListener("error" | "unhandledrejection")`
  global listener. Both call a new IPC command
  `errors.report({ source, message, stack, route, version })` that
  appends to the same `crashes.log` file (one JSON line per event).
- **R3** Log rotation: cap `crashes.log` at 1 MB; on exceeding, rename
  to `crashes.log.1` (overwriting any prior `.1`) and start fresh.
  Keep at most two files (current + `.1`).
- **R4** A `Settings → Advanced → Diagnostics → Open crash log`
  button that calls `client.diag.openCrashLog()` and reveals the
  file in the OS file manager. Easy copy/paste path for issue
  reports.
- **R5** Local logging is **non-blocking** and **best-effort**: if the
  write fails (disk full, permissions), it silently drops the event
  rather than crashing the reporter itself.

### Opt-in remote reporting

- **R6** New setting `diagnostics.crashReporting`:
  - `"off"` (default) — never send.
  - `"ask"` — when a crash occurs, show a Sonner toast "Send crash
    report?" with `Send / No / Don't ask again` actions.
  - `"on"` — send automatically in the background.
- **R7** Settings → Advanced → Diagnostics panel exposes the
  three-option control plus a **Preview** button that opens a modal
  showing the exact JSON payload that would be sent given the current
  buffered events. Modal also lists the fields explicitly: payload,
  stack, route name, app version, OS family + version, no IP, no
  vault path, no note content.
- **R8** The reporter respects an "Endpoint" setting
  `diagnostics.endpoint` (default: the Sentry DSN bundled at build
  time via `VITE_SENTRY_DSN` env). User can override or clear it.
  Empty endpoint disables remote sending regardless of toggle.
- **R9** The Rust transport uses `reqwest` with a 5-second timeout
  and ignores TLS failures only when the endpoint is `http://`
  (developer escape hatch). Failures are logged locally; the user
  is never re-prompted in-session for the same event.
- **R10** First time the toggle moves from `"off"` to `"ask"` or
  `"on"`, show a **one-time confirmation modal** quoting the
  privacy contract. The user must click "Enable" to confirm; the
  toggle stays `"off"` if they close the modal.

### Redaction rules

- **R11** Before writing or sending, the reporter scrubs:
  - Any string longer than 8 characters that contains `/` and
    matches the current vault path prefix → replaced with
    `<vault>/…`.
  - Any string matching `[A-Za-z0-9+/=]{40,}` (potential tokens,
    keys, signatures) → replaced with `<redacted>`.
  - Note bodies — `errors.report` rejects any payload field longer
    than 4 KB; longer fields are truncated with `…[truncated]`
    appended.
- **R12** The redactor is the same code path for local logging
  and remote sending — the file on disk never contains anything
  the network call wouldn't.

### Out of scope

- A custom backend service. We use Sentry (or any Sentry-compatible
  endpoint) and stay vendor-agnostic via the `endpoint` setting.
- Source maps and Rust symbol upload automation in the CI pipeline.
  Manual upload remains an option; F33's release runbook will note
  the recommended Sentry CLI command after F35 lands.
- User identification — no user ID is collected, ever. Crash reports
  are anonymous and not joinable across users.
- macOS / Windows native crash dumps (`.crashlog`, `.dmp`). JS + Rust
  panics cover the realistic failure modes for an Electron-class app.
- Reporting on the Vite preview / Playwright test runtime — F35 is
  desktop-only.

## Decisions captured

- **D-1 Default OFF.** Local-first means zero outbound calls until
  the user opts in. The "ask" middle ground is offered for users
  who want to decide per-crash.
- **D-2 Same payload, locally and remotely.** The on-disk crash log
  is the source of truth for what could be sent. The user can
  always preview before opting in. Builds trust.
- **D-3 Sentry as the reference endpoint.** Sentry's free tier is
  generous, the API is widely tested, and the `tauri-plugin-sentry`
  crate (or a small custom client) handles the wire format. We do
  **not** lock in to Sentry: any compatible endpoint works.
- **D-4 No background uploader.** Crash reports are sent at the
  moment they happen (or buffered to the next crash if offline).
  No daemon, no cron.
- **D-5 Redaction is mandatory.** Even on the local file. Future
  features (e.g., remote support) that might surface the log get a
  clean baseline.

## Requirements traceability

| ID  | Story                                       | Phase  | Status  |
| --- | ------------------------------------------- | ------ | ------- |
| R1  | Rust panic hook → `crashes.log`             | Design | Pending |
| R2  | JS error boundary + global listeners        | Design | Pending |
| R3  | Log rotation (1 MB, 2 files)                | Design | Pending |
| R4  | Settings → "Open crash log" button          | Design | Pending |
| R5  | Local logging is best-effort                | Design | Pending |
| R6  | `diagnostics.crashReporting` tri-state      | Design | Pending |
| R7  | Settings panel with payload Preview         | Design | Pending |
| R8  | Configurable endpoint (default Sentry DSN)  | Design | Pending |
| R9  | Rust transport with timeout + degrade       | Design | Pending |
| R10 | One-time consent modal                      | Design | Pending |
| R11 | Redaction rules (path, tokens, body length) | Design | Pending |
| R12 | Same redactor on disk + wire                | Design | Pending |

## Acceptance

- Forcing a Rust panic via a hidden "Crash now (debug)" button in
  `Settings → Advanced` writes a new entry to `crashes.log` and,
  with the toggle set to `"on"`, ships the same payload to the
  configured endpoint within 5 seconds.
- Throwing an uncaught JS error inside the editor produces a
  `crashes.log` entry with the route and stack — the app shows the
  error boundary fallback instead of a blank screen.
- Toggling `diagnostics.crashReporting` from `"off"` to `"on"`
  always shows the consent modal; closing it without clicking
  Enable leaves the toggle `"off"`.
- The Preview modal renders the exact JSON of buffered events with
  vault paths replaced by `<vault>/…` and any token-shaped string
  replaced by `<redacted>`.
- Disabling network and triggering a crash with the toggle on:
  local file is updated, no error toast surfaces, and the entry is
  not retried later (we accept the loss).
- Existing test suites stay green (`pnpm typecheck && pnpm lint &&
pnpm exec vitest run && cargo test`).

## Notes / follow-ups

- Once we have real-user crashes flowing, revisit the redactor with a
  real adversarial test suite (cf. `.specs/codebase/CONCERNS.md`).
- A future feature could let users **export** the latest crash log
  as a ZIP for sharing with support — handy when the consent toggle
  is off but the user still wants to send context manually.
- F33's release runbook should be amended after F35 to mention
  uploading Rust debug symbols to Sentry so stack traces resolve to
  source lines.
