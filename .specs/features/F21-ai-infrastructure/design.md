# F21 — AI Infrastructure: Design

## Architecture

```
Frontend (React/TS)                  Rust (Tauri commands)
─────────────────────────────────    ────────────────────────────────────
ai/services/skillsClient.ts     ←→   src-tauri/src/ai/
ai/state/aiStatsStore.ts                ├── mod.rs            (existing — ai_send_prompt subprocess primitive)
                                         ├── skills.rs         (NEW — skill loader, frontmatter parse)
settings/ui/AiUsageSection.tsx           ├── prompt.rs         (NEW — PromptBuilder, smart truncation)
                                         ├── cache.rs          (NEW — ai_cache table, BLAKE3 keying)
                                         ├── telemetry.rs      (NEW — ai_calls table, stats query)
                                         ├── tiers.rs          (NEW — model_tier → CLI args mapping)
                                         └── runner.rs         (NEW — orchestrates skill → cache → subprocess)

src-tauri/skills/                    (NEW — bundled defaults via include_dir!)
├── summarize.md
├── suggest-tags.md
├── related-notes.md
├── generate-note.md
├── slash-rephrase.md
├── slash-expand.md
└── slash-continue.md

~/.noxe/skills/*.md                  (user overrides — same format as bundled)
<vault>/.noxe/skills/*.md            (per-vault overrides — load last)
```

## Data flow — `ai.runSkill("summarize", {title, body, frontmatter})`

```
Frontend                    Rust runner.rs
────────                    ──────────────
runSkill IPC ──────────►    1. SkillStore::get("summarize")
                                  └─ if missing → AiError::skill_not_found
                            2. PromptBuilder::build(skill, vars)
                                  └─ smart-truncate to skill.max_tokens_in × 4 bytes
                            3. key = BLAKE3(skill_id || prompt)
                            4. cache.get(key)
                                  ├─ HIT  → write ai_calls(cache_hit=1) → return cached
                                  └─ MISS → ai_send_prompt(provider, prompt, "")
                                              ├─ on error → write ai_calls(error_kind=...) → bubble
                                              └─ on ok   → if json: validate
                                                          → cache.put(key, output)
                                                          → write ai_calls(cache_hit=0, latency)
                                                          → return AiSkillResult
            ◄────────────   AiSkillResult { output, cache_hit, tokens_in, tokens_out, latency_ms }
```

## Skill file format

```markdown
---
id: summarize
name: Summarize note
model_tier: small
max_tokens_in: 8000
max_tokens_out: 400
cache: true
output_schema: text
triggers: [insights.summary]
---
You are summarising a Markdown note for the user's personal knowledge base.

Note title: {{title}}
Frontmatter:
{{frontmatter}}

Body:
{{body}}

Write a 3-sentence summary in the same language as the note. Plain text only, no Markdown.
```

Bundled defaults are loaded with `include_dir!("$CARGO_MANIFEST_DIR/skills")`. Each `.md` file is parsed with `gray_matter` (already in deps via `pulldown-cmark`? — verify; otherwise add `gray_matter` crate).

## Smart truncation (`prompt.rs`)

```rust
fn smart_truncate(skill: &Skill, vars: &mut HashMap<String, String>) {
    let cap_bytes = (skill.max_tokens_in as usize) * 4;
    // Title and frontmatter are always preserved as-is.
    // Body is the last truncated, from the tail.
    let title_len = vars.get("title").map(|s| s.len()).unwrap_or(0);
    let fm_len = vars.get("frontmatter").map(|s| s.len()).unwrap_or(0);
    let overhead = skill.system_prompt.len() + title_len + fm_len + 256; // safety margin
    let body_budget = cap_bytes.saturating_sub(overhead);
    if let Some(body) = vars.get_mut("body") {
        if body.len() > body_budget {
            body.truncate(body_budget);
            body.push_str("\n\n[...truncated]");
        }
    }
}
```

## Model tier mapping (`tiers.rs`)

| tier       | claude          | copilot       |
| ---------- | --------------- | ------------- |
| `small`    | `--model haiku` | (no flag)     |
| `standard` | (no flag)       | (no flag)     |
| `premium`  | `--model opus`  | (no flag)     |

If a flag isn't supported by the binary in the user's PATH, the subprocess returns the same output as default — telemetry records the **requested** tier (real tier is opaque without parsing per-CLI version output, deferred).

## SQLite migration

Add a new migration step in the existing index DB initializer (see `src-tauri/src/index/db.rs`). Idempotent `CREATE TABLE IF NOT EXISTS`. No version bump needed since we only add tables.

## Cache invalidation

Implicit by content hash — there's no explicit invalidation on note edit because the note's body changes ⇒ the prompt changes ⇒ the hash changes. Old entries become unreachable but not deleted. A manual "Clear cache" button in Settings handles cleanup; an LRU eviction policy is **deferred**.

## Test plan

Rust:
- `skills::tests::loads_bundled_defaults`
- `skills::tests::user_override_takes_precedence`
- `skills::tests::malformed_frontmatter_is_skipped`
- `prompt::tests::smart_truncate_preserves_title_and_frontmatter`
- `cache::tests::hit_returns_cached_and_records_call`
- `cache::tests::miss_spawns_subprocess_and_caches` (mock the subprocess via a test feature flag — see existing pattern in `ai/mod.rs` if any, otherwise extract a small `Spawner` trait)
- `telemetry::tests::stats_aggregates_correctly`

TS:
- `skillsClient.test.ts`: invokes correct IPC commands with correct arg shapes (mock `client.ts`).
- `aiStatsStore.test.ts`: refresh updates state.

## Migration off F20

The existing `ChatPanel`, `aiStore`, and TopBar toggle button are deleted in the same commit that wires `runSkill` into the first consumer (F22 Insights sidebar) — not in this F21 commit. F21 lands the infra; F22 is what justifies removing the chat. This keeps F21 reviewable on its own.

## Open questions

- **Cache size telemetry granularity** — do we expose per-skill bytes or just totals? v1 = totals only.
- **JSON schema for `related-notes`** — designed in F22 spec, not here.
- **Skill version field?** — not in v1; the file is the source of truth and there's no upgrade path to manage. Add later if/when bundled skills evolve while users have overrides.
