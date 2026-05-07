# F20 — AI Chat Panel: Design

## Architecture

```
Frontend (React/TS)                     Rust (Tauri commands)
──────────────────────────────────      ──────────────────────────────────
ai/services/aiClient.ts            ←→   src-tauri/src/ai/mod.rs
ai/state/aiStore.ts                       ├── binary_available(binary)
ai/ui/ChatPanel.tsx                       ├── build_prompt(prompt, context)
ai/ui/MessageBubble.tsx                   └── ai_send_prompt (Tauri cmd)
                                              ├── stdin piping
NoteView.tsx                               ├── 60s timeout
  └── ChatPanel (when panelOpen)           └── error mapping
TopBar.tsx
  └── AI toggle button (note view)
settings/
  settingsTypes.ts (ai.provider)
  ui/SettingsPanel.tsx (AI section)
```

## Rust AI module (`src-tauri/src/ai/mod.rs`)

### Dedicated error type

A standalone `AiError` struct is used instead of the global `IpcError` to produce the exact `{ kind, message }` shape the frontend pattern-matches on:

```rust
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiError {
    pub kind: &'static str,
    pub message: String,
}
```

This avoids polluting the global `IpcError` enum with AI-specific variants.

### Binary discovery

```rust
fn binary_available(binary: &str) -> bool {
    #[cfg(target_os = "windows")]
    let cmd = "where";
    #[cfg(not(target_os = "windows"))]
    let cmd = "which";

    Command::new(cmd)
        .arg(binary)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}
```

### Stdin piping rationale

Prompt is passed via **stdin**, not as a CLI argument, for two reasons:
1. Avoids any shell injection risk (no shell expansion on stdin data).
2. Handles arbitrarily long prompts without hitting OS argv limits.

### Command execution with timeout

```rust
// 1. Spawn child
let mut child = Command::new(binary)
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()?;

// 2. Write prompt+context to stdin; EOF signals end-of-input
if let Some(mut stdin) = child.stdin.take() {
    stdin.write_all(full_prompt.as_bytes())?;
}

// 3. Wait with timeout using mpsc
let (tx, rx) = mpsc::channel();
thread::spawn(move || { let _ = tx.send(child.wait_with_output()); });
let output = rx.recv_timeout(Duration::from_secs(60))  // timeout error
               .map_err(|_| AiError::timeout(...))?
               .map_err(|e| AiError::subprocess_failed(...))?;
```

On timeout the background thread continues until the process exits; no zombie risk since the thread holds the child handle.

### IPC command signature

```rust
#[tauri::command]
pub fn ai_send_prompt(input: SendPromptInput) -> Result<String, AiError>
```

| Error kind | Condition |
|---|---|
| `provider_disabled` | `provider == "disabled"` or unknown |
| `binary_not_found` | `which`/`where` returns non-zero |
| `subprocess_failed` | Spawn fails, stdin write fails, or non-zero exit |
| `timeout` | Process doesn't respond within 60 s |

## Frontend feature

### `ai/state/aiStore.ts`

```typescript
type AiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

type AiStore = {
  messages: AiMessage[];
  isLoading: boolean;
  error: string | null;
  panelOpen: boolean;
  togglePanel(): void;
  sendPrompt(prompt: string, noteId: string | null): Promise<void>;
  clearChat(): void;
};
```

`sendPrompt` reads note data from `useEditorStore.getState()` and `useVaultStore.getState()` (direct store access from Zustand action — no React hooks needed).

### `ai/services/aiClient.ts`

Two responsibilities:
1. **`buildContext(noteId)`** — assembles `title + frontmatter + body`, capped at 50 KB.
2. **`sendPrompt(provider, prompt, context)`** — calls `client.ai.sendPrompt`.

### `ai/ui/ChatPanel.tsx`

- `position: fixed` right-side panel, `top-14 right-0 bottom-0 w-96 z-30` (clears the TopBar).
- Reads `panelOpen`, `messages`, `isLoading`, `error` from `useAiStore`.
- Reads `provider` from `useAppSettingsStore`.
- Reads `noteId` from `useShellStore` (the current note view).
- On submit: calls `sendPrompt(prompt, noteId)`.

### `ai/ui/MessageBubble.tsx`

- `role === 'user'`: right-aligned monospace bubble.
- `role === 'assistant'`: left-aligned prose, rendered via `react-markdown` (already in `dependencies`).

### Toggle button (TopBar)

Added to `TopBar.tsx` next to the Star button, only visible when `view.kind === 'note'`:

```tsx
<button onClick={() => togglePanel()} aria-pressed={panelOpen} aria-label="Toggle AI chat">
  <Brain size={16} />
</button>
```

Uses `Brain` icon from `@phosphor-icons/react`.

## Settings integration

### TypeScript (`settingsTypes.ts`)

```typescript
export type AiProvider = 'disabled' | 'claude' | 'copilot';

export type AppSettings = {
  // ... existing fields ...
  ai: { provider: AiProvider };
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  // ...
  ai: { provider: 'disabled' },
};
```

`SettingKey` gains `"ai.provider"` and `SettingsSectionId` gains `"ai"`.

### Rust (`settings.rs`)

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettings {
    #[serde(default = "default_ai_provider")]
    pub provider: String,
}
fn default_ai_provider() -> String { "disabled".to_string() }

impl Default for AiSettings {
    fn default() -> Self { Self { provider: default_ai_provider() } }
}
```

## Key design decisions

| Decision | Rationale |
|---|---|
| Stdin for prompt | Avoids argv injection; no shell expansion; handles long prompts |
| Dedicated `AiError` (not `IpcError`) | Clean `kind` serialization without polluting global error enum |
| `react-markdown` for assistant output | Already in deps; no new packages |
| Fixed-position panel | Avoids layout shifts in NoteView; consistent with how other overlays work |
| In-memory chat only | Simple scope for v1; persistence adds state serialization complexity |
| `mpsc::channel` + `recv_timeout` for subprocess timeout | Standard Rust pattern; clean error path |
