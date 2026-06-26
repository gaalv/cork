# F33 — Release config (signing, notarization, updater)

**Status:** PARTIAL — UI scaffolding + dependency installed; signing/CI work deferred until certificates are provisioned
**Scope:** Large (touches Tauri config, CI workflow, Rust deps, secrets management)
**Depends on:** F34 (real icons need to exist before signed builds ship publicly)

## Overview

Today the `release.yml` workflow builds Cork on macOS / Windows / Ubuntu and
drafts a GitHub release, but every artifact is **unsigned**. macOS users see
Gatekeeper's "Cork.app is damaged and can't be opened" dialog; Windows users
see SmartScreen "unrecognised app"; nothing has an updater path so v0.2 has
no upgrade story besides "download manually again".

F33 closes that gap so a `git tag v0.x.y && git push --tags` produces:

- A macOS `.dmg` signed with a Developer ID Application certificate and
  successfully notarised + stapled.
- A Windows `.msi`/`.exe` signed with an Authenticode code-signing
  certificate (EV preferred for instant SmartScreen reputation).
- A Linux `.AppImage` (and `.deb`) with a detached GPG signature.
- A `latest.json` manifest hosted on the GitHub release that
  `tauri-plugin-updater` can read to deliver in-app updates.

## In scope

### Tauri config

- **R1** Add `@tauri-apps/plugin-updater` (JS) + `tauri-plugin-updater`
  (Rust) and wire the Rust plugin in `lib.rs::run()` behind a
  feature-flag-free runtime check (always on for desktop builds).
- **R2** Extend `tauri.conf.json` with:
  - `bundle.macOS.signingIdentity` from env (`APPLE_SIGNING_IDENTITY`),
    `entitlements: "entitlements.plist"`, `minimumSystemVersion: "11.0"`.
  - `bundle.macOS.providerShortName` (Apple Team ID) for notarisation
    metadata.
  - `bundle.windows.certificateThumbprint` from env
    (`WINDOWS_CERT_THUMBPRINT`) and `digestAlgorithm: "sha256"` and a
    timestamp URL (`http://timestamp.digicert.com`).
  - `bundle.linux.deb.depends` minimal list (libwebkit2gtk-4.1-0, etc.).
  - `bundle.createUpdaterArtifacts: true`.
  - `plugins.updater.endpoints` pointing to
    `https://github.com/<owner>/<repo>/releases/latest/download/latest.json`.
  - `plugins.updater.pubkey` baked at build time from the env var
    `TAURI_UPDATER_PUBKEY` (the public half of the updater key pair).

### Secrets + key generation

- **R3** Document and commit a `scripts/generate-updater-keys.md` runbook
  describing one-time generation via
  `pnpm tauri signer generate -w ~/.tauri/cork-updater.key`. The private
  key never enters the repo; only the public key (base64) is committed
  via the `tauri.conf.json` pubkey field (a public string).
- **R4** Add a `scripts/release.md` runbook covering: bumping
  `package.json` + `tauri.conf.json` + `Cargo.toml` versions, tagging
  `v<version>`, and the secrets that must exist in GitHub Actions for
  the workflow to succeed:
  - `APPLE_CERTIFICATE` (base64 .p12)
  - `APPLE_CERTIFICATE_PASSWORD`
  - `APPLE_SIGNING_IDENTITY` (e.g. "Developer ID Application: Name (TEAMID)")
  - `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), `APPLE_TEAM_ID`
  - `WINDOWS_CERTIFICATE` (base64 .pfx) + `WINDOWS_CERTIFICATE_PASSWORD`
  - `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
    (the updater key)
  - `GPG_PRIVATE_KEY` + `GPG_PASSPHRASE` (Linux artifact signing)

### CI (`.github/workflows/release.yml`)

- **R5** Inject the macOS signing identity + notarisation env vars
  ahead of the `tauri-apps/tauri-action@v0` step on `macos-latest`.
- **R6** Inject the Windows certificate via the
  `windows-certificate` action input (or a temp-file step) on
  `windows-latest`.
- **R7** Inject the updater signing private key on every platform so
  bundle artifacts include the `.sig` files the updater needs.
- **R8** After the `tauri-action` step, publish a generated
  `latest.json` manifest as an asset on the same draft release. The
  manifest lists `version`, per-platform URLs, per-platform sig blobs,
  and a `pub_date` ISO string. A small `scripts/publish-update-manifest.mjs`
  builds it from `tauri-action` outputs.
- **R9** Continue producing a **draft** GitHub release. Promotion to
  published is a manual step (the runbook calls it out).
- **R10** Leave `quality.yml` untouched — F33 only changes the release
  pipeline, not the per-PR pipeline.

### In-app updater UX

- **R11** Add a `useUpdater()` hook + `Settings → General → Updates`
  panel: "Check now" button, version line, last-check timestamp,
  toggle "Check automatically on launch" (default **on**).
- **R12** On launch, when the toggle is on, call
  `checkUpdate()` after the shell mounts; if an update is available,
  show a Sonner toast with "Update available · v0.x.y" and a "Restart
  to install" action that downloads, applies, and relaunches.
- **R13** Failures (no network, signature mismatch, etc.) degrade
  silently to a log line and a muted status in Settings — never a
  blocking modal.

### Out of scope

- Sparkle-style "delta updates" (deferred — full bundle replacement is
  fine while the app is <50 MB).
- Auto-update for the `tauri-plugin-updater` plugin itself across major
  Tauri versions (handled manually by upgrading Cargo deps).
- Multi-channel releases (stable / beta / nightly). Single `stable`
  channel for v1.
- Linux AppImage updater path beyond what `tauri-plugin-updater` ships
  out of the box (no custom `.deb` repository).
- Renewal automation for certificates — runbook documents the manual
  process.

## Decisions captured

- **D-1 Updater endpoint:** GitHub Releases `latest.json` over
  `https://github.com/<owner>/<repo>/releases/latest/download/latest.json`.
  Rationale: zero-infra, public, free, and `tauri-action` already
  uploads to the release. Trade-off: rate-limit and outage are tied
  to GitHub.
- **D-2 Signing scope:** macOS Developer ID + Windows Authenticode are
  **required** for v1 launch. Linux GPG signing is best-effort (no
  enforced verification path).
- **D-3 Default to auto-check on launch:** local-first does not mean
  "never phone home" — the updater is a privacy-respecting GET to
  GitHub's CDN, no telemetry. Toggle in Settings is the user's escape
  hatch.
- **D-4 Cert storage:** never in the repo. Always GitHub Actions
  encrypted secrets. The runbook lists every required secret with the
  generation command.

## Requirements traceability

| ID  | Story                              | Phase | Status      |
| --- | ---------------------------------- | ----- | ----------- |
| R1  | Add updater plugin (TS + Rust)     | Build | Partial     |
| R2  | Tauri config: macOS/Win/Linux sign | Build | Deferred    |
| R3  | Updater key runbook                | Build | Deferred    |
| R4  | Release runbook + required secrets | Build | Deferred    |
| R5  | CI: macOS notarisation env         | Build | Deferred    |
| R6  | CI: Windows code-signing env       | Build | Deferred    |
| R7  | CI: updater key on every platform  | Build | Deferred    |
| R8  | CI: publish `latest.json` manifest | Build | Deferred    |
| R9  | Drafts only — manual promotion     | Build | Deferred    |
| R10 | Quality workflow untouched         | Build | Implemented |
| R11 | Settings → Updates panel           | Build | Partial     |
| R12 | Auto-check on launch + toast       | Build | Deferred    |
| R13 | Failure modes degrade silently     | Build | Deferred    |

## Acceptance

- `git tag v0.2.0-dryrun && git push --tags` produces signed artifacts
  on all three platforms; the macOS `.dmg` opens without Gatekeeper
  blocking, and the Windows `.msi` reports "Verified publisher" in
  the UAC dialog.
- The draft release on GitHub contains: macOS `.dmg`, macOS `.app.tar.gz`
  - `.sig`, Windows `.msi` + `.sig`, Linux `.AppImage` + `.sig`,
    `latest.json`.
- Installing the dryrun build and then tagging `v0.2.0-dryrun.1` shows
  the in-app update prompt within 60 seconds of launch; clicking the
  toast action restarts the app on the new version.
- A user with the auto-check toggle **off** sees no network call to
  GitHub on launch (verifiable via system network monitor).
- `pnpm typecheck && pnpm lint && pnpm exec vitest run && cargo test`
  remain green; bundle size budget (R-006) holds — updater plugin must
  not push the gzipped main chunk above the configured limit.

## Notes / follow-ups

- Apple Developer ID certificates expire annually; track the expiry
  date in STATE.md and add a calendar reminder when the cert lands.
- Consider switching to an EV code-signing certificate after launch to
  earn instant SmartScreen reputation (~$300/yr higher cost).
- A future F-NN can add a "What's new" modal that reads release notes
  from the manifest's `notes` field after a successful update.
- **Implementation notes (M10 landing):**
  - `tauri-plugin-updater = "2"` added to `src-tauri/Cargo.toml`
    but **not yet registered** in `lib.rs::run()` — registration
    requires a non-empty pubkey in `tauri.conf.json` which we don't
    have until the signing keypair is generated (see R3).
  - `Settings → Updates` section ships now with: current app
    version (from `getVersion()`), "Auto-check on launch" toggle
    (persisted as `appSettings.updates.autoCheck`, default `true`),
    and a "View releases" button that opens the GitHub releases
    page until the real updater is wired. A help row links back to
    this spec for the rollout plan.
  - `tauri.conf.json` is intentionally **unchanged** — adding the
    `plugins.updater` block with an empty pubkey would break the
    build.
- **Deferred work (still owned by F33, blocked on secrets):**
  R2–R9 + R12–R13. Unblocked when the maintainers provision Apple
  Developer ID + Authenticode certificates and generate the updater
  signing keypair. The runbooks in R3/R4 will land alongside that
  work.
