use std::collections::HashMap;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

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
pub struct SendPromptInput {
    pub provider: String,
    pub prompt: String,
    pub context: String,
}

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

const TIMEOUT_SECS: u64 = 60;

/// Read the current AI provider slug from app settings (`disabled` / `claude` / `copilot`).
fn current_provider(app: &AppHandle) -> String {
    settings_app_load(app.clone())
        .map(|s: AppSettings| s.ai.provider)
        .unwrap_or_else(|_| "disabled".to_string())
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Send a prompt to the configured AI provider CLI (legacy F20 primitive — kept for
/// backwards compatibility with the chat panel until it is removed in F22).
#[tauri::command]
pub fn ai_send_prompt(input: SendPromptInput) -> Result<String, AiError> {
    if input.provider == "disabled" {
        return Err(AiError::provider_disabled(
            "AI provider is disabled. Configure a provider in Settings → AI.",
        ));
    }

    let binary = binary_for_provider(&input.provider).ok_or_else(|| {
        AiError::provider_disabled(format!("Unknown AI provider: {}", input.provider))
    })?;

    if !binary_available(binary) {
        return Err(AiError::binary_not_found(format!(
            "Binary '{}' not found on PATH. Please install it and restart Noxe.",
            binary
        )));
    }

    let full_prompt = format!("{}\n\n---\nContext:\n{}", input.prompt, input.context);

    let mut child = Command::new(binary)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| AiError::subprocess_failed(format!("Failed to spawn '{}': {}", binary, e)))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(full_prompt.as_bytes())
            .map_err(|e| AiError::subprocess_failed(format!("Failed to write stdin: {}", e)))?;
    }

    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let _ = tx.send(child.wait_with_output());
    });

    let output = rx
        .recv_timeout(Duration::from_secs(TIMEOUT_SECS))
        .map_err(|_| {
            AiError::timeout(format!(
                "AI request timed out after {} seconds.",
                TIMEOUT_SECS
            ))
        })?
        .map_err(|e| AiError::subprocess_failed(format!("Subprocess error: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AiError::subprocess_failed(format!(
            "Process '{}' exited with error: {}",
            binary,
            stderr.trim()
        )));
    }

    let reply = String::from_utf8_lossy(&output.stdout).into_owned();
    Ok(reply)
}

/// Run a registered skill end-to-end (cache → spawn → telemetry).
#[tauri::command]
pub fn ai_run_skill(
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

/// Reload skills from `~/.noxe/skills/` (bundled defaults are also re-read).
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn binary_for_known_providers() {
        assert_eq!(binary_for_provider("claude"), Some("claude"));
        assert_eq!(binary_for_provider("copilot"), Some("copilot"));
    }

    #[test]
    fn binary_for_disabled_returns_none() {
        assert_eq!(binary_for_provider("disabled"), None);
        assert_eq!(binary_for_provider("unknown"), None);
        assert_eq!(binary_for_provider(""), None);
    }

    #[test]
    fn ai_error_kinds_are_correct() {
        assert_eq!(AiError::provider_disabled("x").kind, "provider_disabled");
        assert_eq!(AiError::binary_not_found("x").kind, "binary_not_found");
        assert_eq!(AiError::subprocess_failed("x").kind, "subprocess_failed");
        assert_eq!(AiError::timeout("x").kind, "timeout");
        assert_eq!(AiError::skill_not_found("x").kind, "skill_not_found");
        assert_eq!(AiError::internal("x").kind, "internal");
    }

    #[test]
    fn provider_disabled_returns_error_without_subprocess() {
        let input = SendPromptInput {
            provider: "disabled".to_string(),
            prompt: "hello".to_string(),
            context: "".to_string(),
        };
        let result = ai_send_prompt(input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().kind, "provider_disabled");
    }

    #[test]
    fn unknown_provider_returns_provider_disabled_error() {
        let input = SendPromptInput {
            provider: "openai".to_string(),
            prompt: "hello".to_string(),
            context: "".to_string(),
        };
        let result = ai_send_prompt(input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().kind, "provider_disabled");
    }

    #[test]
    fn missing_binary_returns_binary_not_found() {
        let input = SendPromptInput {
            provider: "claude".to_string(),
            prompt: "hello".to_string(),
            context: "".to_string(),
        };
        if !binary_available("claude") {
            let result = ai_send_prompt(input);
            assert!(result.is_err());
            assert_eq!(result.unwrap_err().kind, "binary_not_found");
        }
    }
}
