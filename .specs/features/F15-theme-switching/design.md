# F15 — Theme Switching · Design

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User picks theme                        │
│  (SettingsPanel <select>) ──┐    ┌── (cmd: toggle-theme) ─────┐ │
└──────────────────────────────│────│─────────────────────────────┘
                               ▼    ▼
                       settingsBridge.set("appearance.theme", v)
                                 │
                                 ▼
                      useAppSettingsStore (Zustand)
                                 │
                  setSettings({...appearance, theme}) → persist + IPC
                                 │
                       store subscribers fired
                                 ▼
                    ┌────────────────────────────────┐
                    │       themeRuntime (new)       │
                    │ subscribes to store + matchMedia│
                    │ → resolveTheme()               │
                    │ → document.documentElement.    │
                    │     dataset.theme = "light|dark"│
                    └────────────────────────────────┘
                                 │
        CSS var cascade swaps; no React re-render needed for chrome
                                 │
                                 ▼
        ┌────────────────────────────────┐
        │  Shiki highlighter consumer    │
        │  passes resolved theme per call │
        └────────────────────────────────┘
```

## Components

### 1. Token system (`src/index.css`)

Default block keeps current light palette (untouched names so consumers don't break). Add a `:root[data-theme="dark"]` block redefining the same custom properties for dark.

```css
:root[data-theme="dark"] {
  --color-noxe-bg: #0c0a09;
  --color-noxe-panel: #1c1917;
  --color-noxe-panel-2: #292524;
  --color-noxe-border: #44403c;
  --color-noxe-border-strong: #57534e;
  --color-noxe-ink: #fafaf9;
  --color-noxe-muted: #a8a29e;
  --color-noxe-subtle: #78716c;
  --color-noxe-accent: #818cf8;
  --color-noxe-accent-soft: #1e1b4b;
  --color-noxe-tag: #5eead4;
  --color-noxe-tag-soft: #134e4a;
}

:root[data-theme="dark"] *::-webkit-scrollbar-thumb { background: #44403c; }
:root[data-theme="dark"] *::-webkit-scrollbar-thumb:hover { background: #57534e; }
```

Every existing component that reads `var(--color-noxe-*)` works automatically. CodeMirror already uses these vars, so no extension change.

### 2. Types (`src/features/settings/state/settingsTypes.ts`)

```ts
export type AppearanceTheme = "light" | "dark" | "system";
```

`DEFAULT_APP_SETTINGS.appearance.theme` becomes `"system"`.

`src/shared/ipc/types.ts` — same widening on `AppSettings.appearance.theme`.

### 3. Persistence/normalize (`appSettingsStore.ts`)

`normalizeAppSettings` validates `theme ∈ {light,dark,system}`, fallback `"system"`.
Rust side (`src-tauri/src/settings.rs`) already stores theme as `String` → no change required.

### 4. Bridge (`settingsBridge.ts`)

```ts
case "appearance.theme": {
  const next = value === "dark" || value === "system" ? value : "light";
  await store.updateSettings({ appearance: { ...current.appearance, theme: next } });
  return;
}
```

### 5. Theme runtime (`src/features/settings/runtime/themeRuntime.ts`) — NEW

Responsibilities:
- On install, subscribe to `useAppSettingsStore` and to `matchMedia("(prefers-color-scheme: dark)")`.
- Resolve the active theme: `stored === "system" ? (mql.matches ? "dark" : "light") : stored`.
- Apply via `document.documentElement.dataset.theme = resolved`.
- Expose `resolveActiveTheme(): "light" | "dark"` so non-React consumers (Shiki) can read it synchronously.
- Idempotent install (returns disposer).
- jsdom-safe: bail if `window` is undefined; tolerate `matchMedia` returning a stub.

```ts
export type ResolvedTheme = "light" | "dark";

let activeResolved: ResolvedTheme = "light";

export function resolveActiveTheme(): ResolvedTheme {
  return activeResolved;
}

export function installThemeRuntime(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const mql = window.matchMedia?.("(prefers-color-scheme: dark)");

  const apply = () => {
    const choice = useAppSettingsStore.getState().settings.appearance.theme;
    const next: ResolvedTheme =
      choice === "system" ? (mql?.matches ? "dark" : "light") : choice;
    activeResolved = next;
    document.documentElement.dataset.theme = next;
  };

  apply();
  const unsubStore = useAppSettingsStore.subscribe((s) => s.settings.appearance.theme, apply);
  const onMql = () => apply();
  mql?.addEventListener?.("change", onMql);

  return () => {
    unsubStore();
    mql?.removeEventListener?.("change", onMql);
  };
}
```

(Zustand v4 needs `subscribeWithSelector` middleware OR plain `subscribe(listener)` with shallow check inside. We'll keep it simple: `subscribe(state => apply())` and short-circuit when `theme` unchanged.)

Mounted once from `Shell` via `useEffect(() => installThemeRuntime(), [])`.

### 6. Settings UI (`SettingsPanel.tsx`)

```tsx
<select
  className={controlClass}
  value={settings.appearance.theme}
  aria-label="Theme"
  onChange={(e) => updateSettings({ appearance: { ...settings.appearance, theme: e.target.value as AppearanceTheme } })}
>
  <option value="system">System</option>
  <option value="light">Light</option>
  <option value="dark">Dark</option>
</select>
```

Description updated to: *"Switch between Light and Dark, or follow your OS appearance."*

### 7. Shiki (`shikiHighlighter.ts`)

```ts
type DevTheme = "vitesse-light" | "vitesse-dark";
// ...
const theme: DevTheme = resolveActiveTheme() === "dark" ? "vitesse-dark" : "vitesse-light";
return highlighter.codeToHtml(code, { lang: resolvedLang, theme });
```

Highlighter is created once with both themes loaded:

```ts
createHighlighter({ themes: ["vitesse-light", "vitesse-dark"], langs: [...] });
```

Existing rendered HTML doesn't auto-rerender on theme switch — but `MarkdownPreview` re-runs on note re-render. To make existing previews re-flow on theme change, we can subscribe to the store inside the preview component (small change in `MarkdownPreview` if it caches highlighted output). Investigated separately during execute.

### 8. Command + shortcut

- `commands/registry.ts`: add `{ kind: "command", id: "toggle-theme", label: "Toggle theme", section: "Commands" }`.
- `menu/menuActions.ts`: handle `"toggle-theme"` → cycle `light → dark → system → light`.
- `hooks/useShortcuts.ts`: add `mod+shift+l` → invoke action.
- `CommandPalette.tsx`: dispatch into existing actions object.

## Risks & mitigations

| Risk                                                      | Mitigation                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------- |
| Shiki highlighter cached with single theme breaks         | Recreate highlighter with both themes; cache once.               |
| Already-rendered preview HTML not refreshed on theme swap | Force `MarkdownPreview` to re-render via subscribing to resolved theme — small effect that bumps a key. |
| jsdom missing `matchMedia` causes test crash              | Optional-chain calls; tests can set `window.matchMedia` stub.    |
| Zustand `subscribe` API differences                       | Use plain `subscribe(listener)` + getState; no middleware needed.|
| CodeMirror snapshot tests fail because tokens change      | CodeMirror uses CSS vars at runtime — no change to compiled output expected. |

## Test plan

- `themeRuntime.test.ts` (new): install → confirms `dataset.theme` matches store; switch to "system" + flip mql → updates; uninstalls cleanly.
- `settingsBridge.test.ts` (existing or new): `set("appearance.theme", "dark")` → store reflects "dark".
- `appSettingsStore.test.ts`: `normalizeAppSettings({ appearance: { theme: "dark" }})` returns "dark"; bogus value → "system".
- `SettingsPanel.test.tsx` (existing): theme select is enabled; selecting "Dark" updates the store.

## Files touched

| File                                                                   | Change      |
| ---------------------------------------------------------------------- | ----------- |
| `src/index.css`                                                        | +dark block |
| `src/features/settings/state/settingsTypes.ts`                         | widen type  |
| `src/features/settings/state/appSettingsStore.ts`                      | normalize   |
| `src/features/settings/services/settingsBridge.ts`                     | accept all  |
| `src/features/settings/runtime/themeRuntime.ts`                        | NEW         |
| `src/features/settings/runtime/themeRuntime.test.ts`                   | NEW         |
| `src/features/settings/ui/SettingsPanel.tsx`                           | enable select |
| `src/features/editor/preview/shikiHighlighter.ts`                      | both themes |
| `src/features/editor/preview/MarkdownPreview.tsx` (if cached)          | theme dep   |
| `src/features/shell/index.tsx`                                         | install runtime |
| `src/features/shell/commands/registry.ts`                              | toggle-theme entry |
| `src/features/shell/menu/menuActions.ts`                               | handler     |
| `src/features/shell/hooks/useShortcuts.ts`                             | shortcut    |
| `src/features/shell/ui/CommandPalette.tsx`                             | route action |
| `src/shared/ipc/types.ts`                                              | widen type  |
