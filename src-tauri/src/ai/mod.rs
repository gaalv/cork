use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

pub mod cache;
pub mod db;
pub mod prompt;
pub mod runner;
pub mod skills;
pub mod telemetry;
pub mod tiers;

use crate::ai::runner::{AiSkillResult, ProcessSpawner, Spawner};
use crate::ai::skills::SkillStore;
use crate::settings::{AiModelSettings, AiSettings};
use crate::IpcError;

// ── Error type ────────────────────────────────────────────────────────────────

/// AI-specific error returned from the AI commands.
/// Serialises as `{ "kind": "...", "message": "..." }` for frontend pattern-matching.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiError {
    pub kind: &'static str,
    pub message: String,
}

impl AiError {
    pub fn provider_disabled(msg: impl Into<String>) -> Self {
        Self {
            kind: "provider_disabled",
            message: msg.into(),
        }
    }
    pub fn binary_not_found(msg: impl Into<String>) -> Self {
        Self {
            kind: "binary_not_found",
            message: msg.into(),
        }
    }
    pub fn subprocess_failed(msg: impl Into<String>) -> Self {
        Self {
            kind: "subprocess_failed",
            message: msg.into(),
        }
    }
    pub fn timeout(msg: impl Into<String>) -> Self {
        Self {
            kind: "timeout",
            message: msg.into(),
        }
    }
    pub fn skill_not_found(msg: impl Into<String>) -> Self {
        Self {
            kind: "skill_not_found",
            message: msg.into(),
        }
    }
    pub fn internal(msg: impl Into<String>) -> Self {
        Self {
            kind: "internal",
            message: msg.into(),
        }
    }
    pub fn invalid_model(msg: impl Into<String>) -> Self {
        Self {
            kind: "invalid_model",
            message: msg.into(),
        }
    }
}

// ── Shared state ──────────────────────────────────────────────────────────────

/// Long-lived AI state stored in the Tauri app.
#[derive(Default)]
pub struct AiState {
    inner: Mutex<Option<AiRuntime>>,
}

struct AiRuntime {
    conn: Mutex<Connection>,
    skills: Mutex<SkillStore>,
}

impl AiState {
    pub fn setup(&self, app_data_dir: PathBuf) -> Result<(), IpcError> {
        let conn = db::open_ai_db(&app_data_dir)?;
        let store = skills::load_all(skills::default_user_dir());
        *self.inner.lock().expect("ai state poisoned") = Some(AiRuntime {
            conn: Mutex::new(conn),
            skills: Mutex::new(store),
        });
        Ok(())
    }

    fn with_runtime<F, R>(&self, f: F) -> Result<R, AiError>
    where
        F: FnOnce(&AiRuntime) -> Result<R, AiError>,
    {
        let guard = self
            .inner
            .lock()
            .map_err(|_| AiError::internal("ai state mutex poisoned"))?;
        let runtime = guard
            .as_ref()
            .ok_or_else(|| AiError::internal("ai state not initialised"))?;
        f(runtime)
    }
}

pub fn setup(app: &AppHandle) -> Result<(), IpcError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| IpcError::Other(format!("app data dir: {e}")))?;
    let state: State<'_, AiState> = app.state();
    state.setup(app_data_dir)
}

// ── Input types ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunSkillInput {
    pub skill_id: String,
    #[serde(default)]
    pub variables: HashMap<String, String>,
    pub ai: AiSettings,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CacheClearInput {
    #[serde(default)]
    pub skill_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StatsInput {
    #[serde(default)]
    pub since: Option<i64>,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Returns the binary name for a provider slug, or None if unrecognised / disabled.
pub fn binary_for_provider(provider: &str) -> Option<&'static str> {
    match provider {
        "claude" => Some("claude"),
        "copilot" => Some("copilot"),
        _ => None,
    }
}

/// Absolute path to `binary`. See [`crate::proc`] for why PATH needs help.
pub fn resolve_binary(binary: &str) -> Option<PathBuf> {
    crate::proc::resolve_binary(binary)
}

/// PATH handed to spawned CLIs, so their own child processes resolve too.
pub fn spawn_path() -> &'static str {
    crate::proc::search_path()
}

/// Checks whether `binary` is reachable.
pub fn binary_available(binary: &str) -> bool {
    crate::proc::binary_available(binary)
}

// ── Helpers (used by runner.rs) ───────────────────────────────────────────────

/// The user's model choice for `provider` at `tier`, or empty for the default.
fn model_override(
    models: &AiModelSettings,
    provider: &str,
    tier: &crate::ai::skills::ModelTier,
) -> String {
    let per_provider = match provider {
        "claude" => &models.claude,
        "copilot" => &models.copilot,
        "codex" => &models.codex,
        _ => return String::new(),
    };
    match crate::ai::tiers::tier_key(tier) {
        "small" => per_provider.small.clone(),
        "premium" => per_provider.premium.clone(),
        _ => per_provider.standard.clone(),
    }
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Run a registered skill end-to-end (cache → spawn → telemetry).
#[tauri::command]
pub async fn ai_run_skill(
    input: RunSkillInput,
    state: State<'_, AiState>,
) -> Result<AiSkillResult, AiError> {
    let provider = input.ai.provider;
    state.with_runtime(|runtime| {
        let store = runtime
            .skills
            .lock()
            .map_err(|_| AiError::internal("skills mutex poisoned"))?;
        let skill = runner::lookup(&store, &input.skill_id)?;
        let chosen = model_override(&input.ai.models, &provider, &skill.model_tier);
        let conn = runtime
            .conn
            .lock()
            .map_err(|_| AiError::internal("ai db mutex poisoned"))?;
        runner::run(
            skill,
            &input.variables,
            &provider,
            &chosen,
            &ProcessSpawner,
            &conn,
        )
    })
}

/// Clear cached responses (all or for a single skill).
#[tauri::command]
pub fn ai_cache_clear(input: CacheClearInput, state: State<'_, AiState>) -> Result<usize, AiError> {
    state.with_runtime(|runtime| {
        let conn = runtime
            .conn
            .lock()
            .map_err(|_| AiError::internal("ai db mutex poisoned"))?;
        cache::clear(&conn, input.skill_id.as_deref())
            .map_err(|e| AiError::internal(format!("clear cache: {e}")))
    })
}

/// Reload skills from `~/.cork/skills/` (bundled defaults are also re-read).
#[tauri::command]
pub fn ai_skills_reload(state: State<'_, AiState>) -> Result<usize, AiError> {
    state.with_runtime(|runtime| {
        let new_store = skills::load_all(skills::default_user_dir());
        let count = new_store.len();
        let mut store = runtime
            .skills
            .lock()
            .map_err(|_| AiError::internal("skills mutex poisoned"))?;
        *store = new_store;
        Ok(count)
    })
}

/// Aggregate telemetry + cache size info for Settings → AI → Usage.
#[tauri::command]
pub fn ai_stats(
    input: StatsInput,
    state: State<'_, AiState>,
) -> Result<telemetry::AiStats, AiError> {
    state.with_runtime(|runtime| {
        let conn = runtime
            .conn
            .lock()
            .map_err(|_| AiError::internal("ai db mutex poisoned"))?;
        let rows = cache::rows_count(&conn).unwrap_or(0);
        let bytes = cache::bytes_total(&conn).unwrap_or(0);
        telemetry::stats(&conn, input.since, rows, bytes)
            .map_err(|e| AiError::internal(format!("stats: {e}")))
    })
}

/// Truncate the `ai_calls` telemetry table.
#[tauri::command]
pub fn ai_telemetry_clear(state: State<'_, AiState>) -> Result<usize, AiError> {
    state.with_runtime(|runtime| {
        let conn = runtime
            .conn
            .lock()
            .map_err(|_| AiError::internal("ai db mutex poisoned"))?;
        telemetry::clear_calls(&conn)
            .map_err(|e| AiError::internal(format!("clear telemetry: {e}")))
    })
}

/// Check which AI provider CLIs are available on PATH.
#[tauri::command]
pub fn ai_providers_available() -> ProvidersAvailable {
    ProvidersAvailable {
        claude: binary_for_provider("claude").map_or(false, binary_available),
        copilot: binary_for_provider("copilot").map_or(false, binary_available),
        codex: false,
    }
}

/// Models Cork knows about, per provider.
///
/// No supported CLI can enumerate its own models, so this is a curated list
/// that will age. It is a starting point, not a constraint: Settings accepts
/// any string, and `ai_test_model` is how a name gets verified.
#[tauri::command]
pub fn ai_model_catalog() -> Vec<ProviderModels> {
    vec![
        ProviderModels {
            provider: "claude".to_string(),
            // Aliases track the newest release of a family, so they age better
            // than pinned ids — which is why they lead the list.
            models: vec![
                tiered("opus", "Opus — most capable", true, "deep"),
                tiered("sonnet", "Sonnet — balanced", true, "standard"),
                tiered("haiku", "Haiku — fastest, cheapest", true, "fast"),
                model("fable", "Fable — deepest reasoning", true),
                model("claude-opus-5", "Claude Opus 5", false),
                model("claude-sonnet-5", "Claude Sonnet 5", false),
                model("claude-haiku-4-5", "Claude Haiku 4.5", false),
                model("claude-fable-5", "Claude Fable 5", false),
            ],
        },
        ProviderModels {
            provider: "copilot".to_string(),
            models: vec![
                tiered("gpt-5-mini", "GPT-5 mini — fastest", false, "fast"),
                tiered("gpt-5", "GPT-5", false, "standard"),
                tiered("o3", "o3 — deepest reasoning", false, "deep"),
                model("claude-sonnet-4.5", "Claude Sonnet 4.5", false),
            ],
        },
    ]
}

fn model(id: &str, label: &str, is_alias: bool) -> ModelChoice {
    ModelChoice {
        id: id.to_string(),
        label: label.to_string(),
        is_alias,
        tier_hint: None,
    }
}

/// Same, but marks this model as the provider's pick for a tier — which is
/// what lets Cork offer "quality" and "economy" without the user knowing any
/// model names.
fn tiered(id: &str, label: &str, is_alias: bool, hint: &str) -> ModelChoice {
    ModelChoice {
        id: id.to_string(),
        label: label.to_string(),
        is_alias,
        tier_hint: Some(hint.to_string()),
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelChoice {
    pub id: String,
    pub label: String,
    /// Aliases resolve to whatever is newest, so they do not go stale.
    pub is_alias: bool,
    /// `fast` | `standard` | `deep` when this is the provider's pick for that
    /// tier. Drives the presets; `None` means "listed, but not a preset pick".
    pub tier_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderModels {
    pub provider: String,
    pub models: Vec<ModelChoice>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelTestResult {
    pub ok: bool,
    /// The CLI's own message when it failed — a wrong model name or a wrong
    /// flag both surface here rather than being guessed at.
    pub message: String,
}

/// Run the smallest possible prompt to prove a provider/model pair works.
#[tauri::command]
pub fn ai_test_model(provider: String, model: String) -> ModelTestResult {
    let Some(binary) = binary_for_provider(&provider) else {
        return ModelTestResult {
            ok: false,
            message: format!("Unknown provider: {provider}"),
        };
    };
    if resolve_binary(binary).is_none() {
        return ModelTestResult {
            ok: false,
            message: format!("'{binary}' is not installed, or Cork cannot see it"),
        };
    }

    let invocation = match tiers::invocation(&provider, &model, "Reply with the single word: ok") {
        Ok(invocation) => invocation,
        Err(error) => {
            return ModelTestResult {
                ok: false,
                message: error.message,
            }
        }
    };

    match ProcessSpawner.spawn(binary, &invocation.args, &invocation.stdin, 45) {
        Ok(out) => ModelTestResult {
            ok: true,
            message: out.trim().chars().take(120).collect(),
        },
        Err(err) => ModelTestResult {
            ok: false,
            message: err.message,
        },
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvidersAvailable {
    pub claude: bool,
    pub copilot: bool,
    pub codex: bool,
}

/// List the currently loaded skills (id + name + source).
#[tauri::command]
pub fn ai_skills_list(state: State<'_, AiState>) -> Result<Vec<SkillSummary>, AiError> {
    state.with_runtime(|runtime| {
        let store = runtime
            .skills
            .lock()
            .map_err(|_| AiError::internal("skills mutex poisoned"))?;
        Ok(store
            .all()
            .into_iter()
            .map(|s| SkillSummary {
                id: s.id.clone(),
                name: s.name.clone(),
                source: format!("{:?}", s.source).to_lowercase(),
                triggers: s.triggers.clone(),
            })
            .collect())
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSummary {
    pub id: String,
    pub name: String,
    pub source: String,
    pub triggers: Vec<String>,
}

// ── Unit tests ────────────────────────────────────────────────────────────────
