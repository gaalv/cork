# F21 — AI Infrastructure (skills + cache + telemetry)

## Overview

Foundational layer that the next AI features (Insights sidebar, Generate-from-topic, Slash commands) build on top of. The user dropped the generic chat panel (F20) in favor of contextual AI features that integrate directly into the editor and note view. Before building any of those, we need a small, opinionated infrastructure to:

1. Define **skills** as first-class units (system prompt + token cap + model tier + output schema), discoverable from disk, similar to how this CLI loads skills.
2. **Cache** AI responses by content hash so re-opening a note never costs tokens twice.
3. Track **telemetry** (skill, tokens in/out, latency, provider) so the user can see what they've spent.

This stays subprocess-only (`claude` / `copilot` CLI) — no HTTP API, no embeddings, no RAG. Heavier semantic search is delegated to the user's own AI CLI of choice (notes are plain `.md` on disk). See `.specs/features/F20-ai-chat/` for what's being superseded.

---

## Requirements

### R1 — Skills system

- **R1.1** A skill is a Markdown file with YAML frontmatter:
  ```markdown
  ---
  id: summarize
  name: Summarize
  model_tier: small        # small | standard | premium (provider-mapped)
  max_tokens_in: 8000
  max_tokens_out: 400
  cache: true
  output_schema: text       # text | json (json validates against schema_path if set)
  schema_path: schemas/summary.json   # optional
  triggers: [insights.summary]        # logical names features call
  ---
  System prompt body in Markdown. Variables like {{title}}, {{body}}, {{frontmatter}}
  are interpolated at call time.
  ```
- **R1.2** Skills load from two locations, in this order (later overrides earlier by `id`):
  1. **Bundled defaults**, shipped inside the Tauri binary (loaded via `include_dir!` from `src-tauri/skills/`).
  2. **User overrides** in `~/.cork/skills/*.md` (and per-vault overrides in `<vault>/.cork/skills/*.md`).
- **R1.3** Skills are loaded once at startup and re-loaded on demand via a `skills.reload` IPC command. A file watcher on `~/.cork/skills/` is **deferred** (out of scope).
- **R1.4** A skill that fails to parse is logged (skill id + error) and skipped — it never crashes the loader.
- **R1.5** Bundled defaults shipped in v1: `summarize`, `suggest-tags`, `related-notes`, `generate-note`, `slash-rephrase`, `slash-expand`, `slash-continue`. These cover all three upcoming features.

### R2 — Prompt assembly

- **R2.1** A `PromptBuilder` Rust helper takes `(skill_id, variables: HashMap<String, String>)` and returns the fully interpolated prompt string.
- **R2.2** `{{var}}` is substituted by string replacement; missing variables produce an empty string and a warning in the logs (never panics).
- **R2.3** Total prompt size is capped at `skill.max_tokens_in × 4` bytes (rough chars-per-token approximation). Excess is **smart-truncated**: title + frontmatter are always kept; body is truncated from the tail with a `\n\n[...truncated]` marker.
- **R2.4** No external tokenizer dependency in v1 — the byte cap above is the explicit trade-off (documented in design.md).

### R3 — Response cache

- **R3.1** New SQLite table `ai_cache` in the existing index DB:
  ```sql
  CREATE TABLE ai_cache (
    key         TEXT PRIMARY KEY,    -- BLAKE3(skill_id || prompt_full)
    skill_id    TEXT NOT NULL,
    output      TEXT NOT NULL,
    tokens_in   INTEGER,
    tokens_out  INTEGER,
    provider    TEXT NOT NULL,       -- 'claude' | 'copilot'
    created_at  INTEGER NOT NULL     -- unix epoch seconds
  );
  CREATE INDEX ai_cache_skill_idx ON ai_cache(skill_id);
  ```
- **R3.2** Cache lookup is keyed by `BLAKE3(skill_id || full_prompt)`. Same skill + same input bytes ⇒ instant hit.
- **R3.3** On hit: return cached output, do NOT call the subprocess, still record a row in `ai_calls` with `cache_hit = true` and `tokens_in/out = 0`.
- **R3.4** Skills with `cache: false` (e.g. slash commands that should always run fresh) skip the cache entirely.
- **R3.5** A `ai.cacheClear({ skillId? })` IPC command wipes the cache (all rows, or only one skill).
- **R3.6** Cache entries never expire automatically in v1 (TTL deferred). Total cache size is exposed via `ai.stats()` so the UI can warn at very large sizes.

### R4 — Telemetry

- **R4.1** New SQLite table `ai_calls`:
  ```sql
  CREATE TABLE ai_calls (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_id    TEXT NOT NULL,
    provider    TEXT NOT NULL,
    cache_hit   INTEGER NOT NULL,    -- 0 | 1
    tokens_in   INTEGER NOT NULL,
    tokens_out  INTEGER NOT NULL,
    latency_ms  INTEGER NOT NULL,
    error_kind  TEXT,                -- null on success
    created_at  INTEGER NOT NULL
  );
  CREATE INDEX ai_calls_created_idx ON ai_calls(created_at DESC);
  ```
- **R4.2** Every invocation through the new `ai.runSkill` command writes exactly one `ai_calls` row, success or failure, cache hit or miss.
- **R4.3** `tokens_in` is approximated as `prompt_bytes / 4`. `tokens_out` as `output_bytes / 4`. The approximation is documented; per-provider real counts are deferred.
- **R4.4** New IPC `ai.stats({ since? })` returns:
  ```ts
  {
    callsTotal: number;
    cacheHitRate: number;       // 0..1
    tokensIn: number;
    tokensOut: number;
    bySkill: Array<{ skillId: string; calls: number; tokens: number }>;
    cacheRows: number;
    cacheBytes: number;
  }
  ```
- **R4.5** A simple `Settings → AI → Usage` section renders the stats with a "Clear telemetry" button (which truncates `ai_calls`, not `ai_cache`).

### R5 — Skill runner IPC

- **R5.1** New Tauri command `ai_run_skill(skill_id: String, variables: HashMap<String, String>) -> Result<AiSkillResult, AiError>`.
- **R5.2** `AiSkillResult { output: String, cache_hit: bool, tokens_in: u32, tokens_out: u32, latency_ms: u32 }`.
- **R5.3** Internally the runner: loads skill → builds prompt → checks cache → on miss spawns subprocess (reusing existing logic in `src-tauri/src/ai/mod.rs`) → on success writes cache + telemetry → returns.
- **R5.4** Errors reuse the existing `AiError` type from F20. New variants added if needed: `skill_not_found`, `schema_validation_failed`.
- **R5.5** When `output_schema = json`, the runner trims fenced code blocks and validates against `schema_path` (using `jsonschema` crate). On fail returns `schema_validation_failed`; the response is still cached as raw text under a separate key prefix `invalid:` to avoid re-spending tokens during debugging — **clarification:** invalid responses are NOT cached (so a retry spends tokens; this is intentional).

### R6 — Provider settings reuse

- **R6.1** The existing `settings.ai.provider` (`disabled | claude | copilot`) keeps its meaning. Skill calls return `AiError::provider_disabled` when the provider is `disabled`.
- **R6.2** `model_tier` from the skill maps to an arg passed to the CLI binary (e.g. `claude --model haiku` for `small`, no flag for `standard`, `claude --model opus` for `premium`). Mapping table lives in `src-tauri/src/ai/tiers.rs` and is documented in design.md.
- **R6.3** When the provider doesn't support a tier (e.g. `copilot` may not expose model selection), the runner falls back silently to the provider's default and records the actual tier used in telemetry.

### R7 — Frontend client

- **R7.1** New `src/features/ai/services/skillsClient.ts` wrapping the IPC commands: `runSkill(skillId, variables)`, `cacheClear(skillId?)`, `stats(since?)`, `reload()`.
- **R7.2** `useAiStatsStore` (Zustand) holds the last fetched stats and a `refresh()` action. Used by the Settings → AI → Usage section.
- **R7.3** No UI for managing individual skills in v1 — the user edits files in `~/.cork/skills/` and clicks `Reload skills` in Settings.

### R8 — Removal of F20 generic chat

- **R8.1** The chat panel (`ChatPanel.tsx`), its store (`aiStore.ts`), the toggle button in TopBar, and the Settings → AI panel-toggle entry are removed.
- **R8.2** The existing `ai_send_prompt` Rust command stays as the lower-level subprocess primitive that `ai_run_skill` calls into. It is no longer exposed to the frontend `client.ts`.
- **R8.3** F20 is marked SUPERSEDED in the roadmap with a pointer to F21–F24. Its spec stays in place as historical reference.

---

## Non-Requirements (out of scope for F21)

- Streaming output (still deferred — see DEFERRED.md § D3).
- Real per-provider tokenizers (we use `bytes / 4` approximation).
- HTTP API providers (OpenAI/Anthropic SDK) — only `claude` / `copilot` CLI in v1.
- File watcher on `~/.cork/skills/` (manual `Reload` button only).
- Embeddings, vector search, RAG.
- Per-skill cost computation in fiat — telemetry shows tokens, not dollars.
- A UI to author skills inside Cork — v1 is "edit Markdown in `~/.cork/skills/`".

---

## Acceptance criteria

- [ ] Bundled `summarize` skill loads on startup; `ai.runSkill("summarize", {title, body, frontmatter})` returns a string.
- [ ] Calling the same skill with identical variables a second time returns instantly with `cache_hit = true` and writes a row to `ai_calls`.
- [ ] Setting provider to `disabled` makes `ai.runSkill` fail with `provider_disabled` and writes a telemetry row with `error_kind = "provider_disabled"`.
- [ ] Editing `~/.cork/skills/summarize.md` and clicking `Reload` in Settings replaces the bundled skill.
- [ ] `Settings → AI → Usage` shows non-zero counters after a call and goes back to zero after `Clear telemetry`.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `cargo check`, `cargo test --lib` all green.
