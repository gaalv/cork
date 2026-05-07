# F15 — Theme Switching (Light / Dark / System)

**Owner phase:** Post-v1 polish
**Depends on:** F04 (shell), F13 (settings panel)
**Status:** In progress

## Problem Statement

Noxe v1 ships with a hard-coded light theme. The Settings panel exposes a Theme select that is `disabled`, the type `AppearanceTheme` is `"light"` only, and the bridge silently rewrites any value back to `"light"`. There is no dark token palette, no runtime that applies a theme, and the Shiki preview highlighter is hard-pinned to `vitesse-light`. This feature lights up the existing UI knob end-to-end so users can switch between light, dark, and system-follow themes.

## Goals

- [ ] **G1** — User can pick Light / Dark / System from the Settings panel and the change applies immediately, with no reload.
- [ ] **G2** — The chosen theme persists across restarts (already covered by `appSettingsStore` persistence + Tauri settings IPC).
- [ ] **G3** — When `System` is selected, the app follows `prefers-color-scheme` and reacts when the OS toggles dark mode at runtime.
- [ ] **G4** — All chrome (shell, drawers, top bar, settings, home, note view) and the Markdown preview (Shiki) render correctly in both modes; CodeMirror inherits the new tokens automatically because its theme already uses CSS variables.
- [ ] **G5** — Command palette + native menu offer a "Toggle theme" command that cycles Light → Dark → System.

## Out of Scope

| Item                                  | Reason                                            |
| ------------------------------------- | ------------------------------------------------- |
| Custom user themes / color overrides  | v2 — captured in PROJECT.md                       |
| Per-vault theme overrides             | v2 — global setting only                          |
| Animated theme transitions            | Not necessary; CSS var swap is already imperceptible |
| Editor font theme variants            | Editor already uses CSS variables; nothing else needed |

---

## User Stories

- **US1** — As a user, I open Settings → General, change *Theme* from *Light* to *Dark*, and the entire app instantly switches palette without reloading.
- **US2** — As a user, I select *System* and toggle macOS appearance; the app follows the OS choice live.
- **US3** — As a user, I press ⌘⇧L (or run *Toggle theme* from the palette/menu) and the theme cycles Light → Dark → System → Light.
- **US4** — As a user, I close and reopen the app; my theme choice is preserved.

## Functional Requirements

- **FR1** — `AppearanceTheme = "light" | "dark" | "system"`.
- **FR2** — A `themeRuntime` module sets `data-theme="light"|"dark"` on `<html>` whenever the resolved theme changes. When the stored choice is `"system"`, it resolves via `window.matchMedia("(prefers-color-scheme: dark)")` and listens for changes.
- **FR3** — `index.css` exposes the existing palette as the default (light) and a `:root[data-theme="dark"]` override block with all `--color-noxe-*` tokens redefined for dark.
- **FR4** — `settingsBridge.set("appearance.theme", value, "global")` accepts `"light"`, `"dark"`, or `"system"` and persists the literal value (no silent rewrite).
- **FR5** — `normalizeAppSettings` accepts the three valid values and falls back to `"system"` if the persisted value is unknown.
- **FR6** — The Theme `<select>` in `SettingsPanel.tsx` is no longer disabled; offers three options: System (follow OS), Light, Dark.
- **FR7** — Shiki preview highlights with `vitesse-light` in light mode and `vitesse-dark` in dark mode; the highlighter is loaded once with both themes and the active theme is selected per call based on the resolved theme.
- **FR8** — Command registry adds `toggle-theme` (palette + menu); shortcut ⌘⇧L cycles Light → Dark → System.

## Non-Functional Requirements

- **NFR1** — Switching theme must not cause flicker or a full re-render storm: rely on CSS variable cascade.
- **NFR2** — No hard reload, no IPC roundtrip required to apply (persistence is async and best-effort).
- **NFR3** — Tests cover the runtime resolver (system query subscription) and the bridge accepting/normalizing all three values.
- **NFR4** — SSR/jsdom safety: `themeRuntime` must guard `window`/`matchMedia` access.

## Acceptance Criteria

- AC1 — Selecting *Dark* in Settings flips `data-theme="dark"` on `<html>` and visibly changes background, panels, borders, ink color, accent, and code preview.
- AC2 — Selecting *System*, then toggling macOS appearance, updates the app within ~100 ms.
- AC3 — Reload preserves the choice.
- AC4 — Typecheck + 194+ tests green; new unit tests for `themeRuntime` and updated bridge normalization pass.
- AC5 — Shiki code blocks render with dark colors in dark mode.
- AC6 — Command palette exposes "Toggle theme" and the shortcut cycles correctly.
