# F34 — App icons + branding

**Status:** PLANNED
**Scope:** Medium (assets + Tauri config + a handful of UI strings)
**Depends on:** none (independent of F33/F35)

## Overview

The repo currently ships with Tauri's default scaffolded icons
(rocket placeholder under `src-tauri/icons/`). The brand row in
`NavPane` deliberately omits a logo glyph because none exists (see
F31 D-1). Before v1 ships publicly Noxe needs a real visual identity:
a single source-of-truth logo, the full Tauri icon matrix, and the
small set of UI surfaces that should pick up the new mark.

## In scope

### Source asset

- **R1** A vector source (`brand/noxe-logo.svg`) committed under a new
  top-level `brand/` directory, square, drawn on a 512×512 viewport,
  with both light-on-dark and dark-on-light variants and an
  outline-only "monochrome" variant for the rail / favicon use.
- **R2** A wordmark variant (`brand/noxe-wordmark.svg`) used in the
  NavPane brand row, the EmptyVault hero, and the README banner.
- **R3** Brand tokens documented in `brand/README.md`:
  - Primary indigo (matches `--color-noxe-accent`, currently `#4f46e5`)
  - Ink black + paper white tokens
  - Typography choices (Inter for UI, JetBrains Mono for code)

### Tauri icon matrix

- **R4** Run `pnpm tauri icon brand/noxe-logo.svg` to regenerate
  every file under `src-tauri/icons/` (replacing the placeholder
  rocket). The tauri-icon CLI produces the macOS `.icns`, the
  Windows `.ico` (multi-resolution), the Linux PNGs, and the
  MS Store `Square*Logo.png` set.
- **R5** Verify all expected files exist and overwrite the
  placeholder entries — failure mode is a partial set that breaks
  `pnpm tauri build` on one platform.

### App-side wiring

- **R6** `public/favicon.svg` (vector) + a 32×32 fallback PNG used by
  `index.html`. Replace the existing Vite default `react.svg` favicon.
- **R7** `index.html` `<title>` + `<meta name="description">` updated
  to "Noxe — local-first Markdown notes for developers".
- **R8** `NavPane` brand row gains a 14-px monochrome logo glyph to
  the left of the "Noxe" wordmark (the F31 D-1 follow-up). Glyph SVG
  imported as a React component via `?react` (vite-plugin-svgr) to
  inherit `currentColor`.
- **R9** `EmptyVault.tsx` hero icon swap: replace the Phosphor
  placeholder with the wordmark + a short tagline ("Open a vault to
  begin").
- **R10** `HelpModal.tsx` header gains the wordmark.
- **R11** Tauri window `title` stays "Noxe" (already correct); macOS
  `Info.plist` `CFBundleName` derived from `productName` stays
  "Noxe".

### README + GitHub presence

- **R12** Replace the top-of-`README.md` heading with the wordmark
  PNG (1280×320 export of `brand/noxe-wordmark.svg` on a transparent
  background) so the GitHub repo page renders the brand.
- **R13** Add a `.github/assets/social-preview.png` (1280×640) used
  as the repository social preview. Documented in the brand README.

### Out of scope

- Animated logo / Lottie. Static SVG only.
- Dark-mode-aware favicon (browsers handle this poorly; we ship the
  monochrome variant which works on both).
- Marketing website / landing page assets — handled in a future
  M11 once v1 ships.
- Renaming the npm package or Rust crate.
- Localised wordmarks.

## Decisions captured

- **D-1 Source-of-truth:** SVG, committed in `brand/`. PNG/ICO/ICNS
  are derived artifacts produced by `tauri icon`. We commit the
  derived files too (so contributors don't need to run the CLI),
  but they are clearly marked as generated in `brand/README.md`.
- **D-2 No logo download script:** the brand assets live in the repo,
  not a CDN. Keeps the project self-contained.
- **D-3 Monochrome glyph in NavPane:** matches the prototype's
  understated look. Coloured-logo treatments stay reserved for
  Empty Vault hero and README.
- **D-4 Naming:** "Noxe" is the product name everywhere. Lowercase
  in code identifiers (`noxe-app`, `com.noxe.app`); title case
  in user-facing copy.

## Requirements traceability

| ID  | Story                                | Phase  | Status  |
| --- | ------------------------------------ | ------ | ------- |
| R1  | Vector logo source + variants        | Design | Pending |
| R2  | Wordmark variant                     | Design | Pending |
| R3  | Brand tokens documented              | Design | Pending |
| R4  | Regenerate Tauri icon matrix         | Design | Pending |
| R5  | Verify full icon set present         | Design | Pending |
| R6  | `public/favicon.svg` + PNG fallback  | Design | Pending |
| R7  | `index.html` title + description     | Design | Pending |
| R8  | NavPane glyph                        | Design | Pending |
| R9  | EmptyVault wordmark hero             | Design | Pending |
| R10 | HelpModal wordmark                   | Design | Pending |
| R11 | Window title / bundle name unchanged | Design | Pending |
| R12 | README banner                        | Design | Pending |
| R13 | GitHub social preview asset          | Design | Pending |

## Acceptance

- Every file under `src-tauri/icons/` is the real Noxe logo, not the
  Tauri rocket. `pnpm tauri build` produces a bundle where the macOS
  Dock icon, Windows taskbar icon, and Linux notification icon all
  show the new mark.
- `pnpm dev` shows the new favicon in the browser tab.
- Opening Noxe with no vault selected shows the new EmptyVault hero
  with the wordmark.
- NavPane brand row renders the monochrome glyph + "Noxe" wordmark
  side by side.
- The GitHub repo's README renders the wordmark banner at the top.
- `pnpm typecheck && pnpm lint && pnpm exec vitest run` stay green.

## Notes / follow-ups

- The brand kit should be revisited if the product name ever changes
  — every reference is sourced from `brand/`, so a future rename is
  a one-folder operation.
- A dark-mode logo variant might be needed once the EmptyVault hero
  picks up a dark-mode background; currently the monochrome variant
  handles both themes.
