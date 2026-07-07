use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
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

use crate::ai::runner::{AiSkillResult, ProcessSpawner};
use crate::ai::skills::SkillStore;
use crate::settings::{settings_app_load, AppSettings};
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
        Self { kind: "provider_disabled", message: msg.into() }
    }
    pub fn binary_not_found(msg: impl Into<String>) -> Self {
        Self { kind: "binary_not_found", message: msg.into() }
    }
    pub fn subprocess_failed(msg: impl Into<String>) -> Self {
        Self { kind: "subprocess_failed", message: msg.into() }
    }
    pub fn timeout(msg: impl Into<String>) -> Self {
        Self { kind: "timeout", message: msg.into() }
    }
    pub fn skill_not_found(msg: impl Into<String>) -> Self {
        Self { kind: "skill_not_found", message: msg.into() }
    }
    pub fn internal(msg: impl Into<String>) -> Self {
        Self { kind: "internal", message: msg.into() }
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
        let guard = self.inner.lock().map_err(|_| AiError::internal("ai state mutex poisoned"))?;
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

/// Checks whether `binary` is reachable on PATH using `which` (Unix) / `where` (Windows).
pub fn binary_available(binary: &str) -> bool {
    #[cfg(target_os = "windows")]
    let check_cmd = "where";
    #[cfg(not(target_os = "windows"))]
    let check_cmd = "which";

    Command::new(check_cmd)
        .arg(binary)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

// ── Helpers (used by runner.rs) ───────────────────────────────────────────────

/// Read the current AI provider slug from app settings (`disabled` / `claude` / `copilot`).
fn current_provider(app: &AppHandle) -> String {
    settings_app_load(app.clone())
        .map(|s: AppSettings| s.ai.provider)
        .unwrap_or_else(|_| "disabled".to_string())
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Run a registered skill end-to-end (cache → spawn → telemetry).
#[tauri::command]
pub async fn ai_run_skill(
    input: RunSkillInput,
    state: State<'_, AiState>,
    app: AppHandle,
) -> Result<AiSkillResult, AiError> {
    let provider = current_provider(&app);
    state.with_runtime(|runtime| {
        let store = runtime
            .skills
            .lock()
            .map_err(|_| AiError::internal("skills mutex poisoned"))?;
        let skill = runner::lookup(&store, &input.skill_id)?;
        let conn = runtime
            .conn
            .lock()
            .map_err(|_| AiError::internal("ai db mutex poisoned"))?;
        runner::run(skill, &input.variables, &provider, &ProcessSpawner, &conn)
    })
}

/// Clear cached responses (all or for a single skill).
#[tauri::command]
pub fn ai_cache_clear(
    input: CacheClearInput,
    state: State<'_, AiState>,
) -> Result<usize, AiError> {
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
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvidersAvailable {
    pub claude: bool,
    pub copilot: bool,
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
