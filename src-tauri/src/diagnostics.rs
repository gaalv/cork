//! F35 — Crash + error reporting (local-first, opt-in).
//!
//! This module owns the local crash log written to `<app_log_dir>/crashes.log`
//! and the redactor that scrubs vault paths and token-shaped strings before
//! anything reaches disk. The Rust panic hook captures panics, and the
//! frontend reports JS errors via [`diagnostics_report_error`].
//!
//! No data ever leaves the machine here — remote reporting is deferred until
//! the user explicitly enables it via a future "Send crash reports" toggle.
//! See `.specs/features/F35-crash-reporting/spec.md` for the full contract.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::IpcError;

const LOG_FILE: &str = "crashes.log";
const ROTATED_FILE: &str = "crashes.log.1";
const MAX_LOG_BYTES: u64 = 1_024 * 1_024; // 1 MB
const MAX_FIELD_BYTES: usize = 4 * 1_024; // 4 KB per string field

/// Crash log directory + active vault path used for redaction. Set during
/// `setup_panic_hook`; updated when a vault opens via [`set_vault_root`].
static STATE: OnceLock<std::sync::Mutex<DiagState>> = OnceLock::new();

#[derive(Debug, Default)]
struct DiagState {
    log_dir: Option<PathBuf>,
    vault_root: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrashEvent {
    pub timestamp: String,
    pub source: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stack: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub route: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportInput {
    pub source: String,
    pub message: String,
    #[serde(default)]
    pub stack: Option<String>,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
}

/// Install the global panic hook and remember the app log directory. Safe to
/// call multiple times — subsequent calls are no-ops.
pub fn setup(app: &AppHandle) {
    let log_dir = match app.path().app_log_dir() {
        Ok(dir) => dir,
        Err(err) => {
            eprintln!("noxe: failed to resolve app log dir: {err}");
            return;
        }
    };

    if let Err(err) = fs::create_dir_all(&log_dir) {
        eprintln!("noxe: failed to create app log dir {}: {err}", log_dir.display());
        return;
    }

    let state = STATE.get_or_init(|| std::sync::Mutex::new(DiagState::default()));
    if let Ok(mut guard) = state.lock() {
        guard.log_dir = Some(log_dir.clone());
    }

    static HOOK_INSTALLED: OnceLock<()> = OnceLock::new();
    HOOK_INSTALLED.get_or_init(|| {
        let prev = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            // Always call the original hook so cargo / test output is preserved.
            prev(info);

            let message = info
                .payload()
                .downcast_ref::<&str>()
                .map(|s| (*s).to_string())
                .or_else(|| info.payload().downcast_ref::<String>().cloned())
                .unwrap_or_else(|| "panic with non-string payload".to_string());
            let location = info
                .location()
                .map(|loc| format!("{}:{}:{}", loc.file(), loc.line(), loc.column()));

            let event = CrashEvent {
                timestamp: now_iso8601(),
                source: "rust-panic".to_string(),
                message,
                stack: location,
                route: None,
                version: Some(env!("CARGO_PKG_VERSION").to_string()),
            };
            // Best-effort: silently drop if writing fails.
            let _ = write_event(&event);
        }));
    });
}

/// Update the redactor's notion of the active vault root. Called on
/// `vault.open` and cleared on `vault.close`.
pub fn set_vault_root(root: Option<&Path>) {
    let state = STATE.get_or_init(|| std::sync::Mutex::new(DiagState::default()));
    if let Ok(mut guard) = state.lock() {
        guard.vault_root = root.map(|p| p.to_string_lossy().to_string());
    }
}

fn current_log_dir() -> Option<PathBuf> {
    STATE.get()?.lock().ok()?.log_dir.clone()
}

fn current_vault_root() -> Option<String> {
    STATE.get()?.lock().ok()?.vault_root.clone()
}

fn now_iso8601() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// Apply redaction rules in-place on every string field of an event.
pub fn redact_event(event: &mut CrashEvent) {
    let vault = current_vault_root();
    event.message = redact(&event.message, vault.as_deref());
    if let Some(stack) = event.stack.as_ref() {
        event.stack = Some(redact(stack, vault.as_deref()));
    }
}

/// Public redactor — exposed for tests and future remote-report code paths.
pub fn redact(input: &str, vault_root: Option<&str>) -> String {
    let trimmed = truncate(input, MAX_FIELD_BYTES);

    let mut out = trimmed.into_owned();

    if let Some(root) = vault_root {
        if !root.is_empty() && out.contains(root) {
            out = out.replace(root, "<vault>");
        }
    }

    // Replace any base64/hex-ish run of >=40 chars with <redacted>.
    let token_re = token_regex();
    out = token_re.replace_all(&out, "<redacted>").into_owned();

    out
}

fn truncate(input: &str, max_bytes: usize) -> std::borrow::Cow<'_, str> {
    if input.len() <= max_bytes {
        return std::borrow::Cow::Borrowed(input);
    }
    let mut end = max_bytes;
    while end > 0 && !input.is_char_boundary(end) {
        end -= 1;
    }
    let mut out = String::with_capacity(end + 14);
    out.push_str(&input[..end]);
    out.push_str("…[truncated]");
    std::borrow::Cow::Owned(out)
}

fn token_regex() -> &'static regex::Regex {
    static RE: OnceLock<regex::Regex> = OnceLock::new();
    RE.get_or_init(|| regex::Regex::new(r"[A-Za-z0-9+/=]{40,}").expect("valid token regex"))
}

fn rotate_if_needed(path: &Path) -> std::io::Result<()> {
    match fs::metadata(path) {
        Ok(meta) if meta.len() >= MAX_LOG_BYTES => {
            let rotated = path.with_file_name(ROTATED_FILE);
            // Overwrite any existing .1.
            let _ = fs::remove_file(&rotated);
            fs::rename(path, &rotated)?;
            Ok(())
        }
        Ok(_) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(err),
    }
}

fn write_event(event: &CrashEvent) -> std::io::Result<()> {
    let dir = current_log_dir().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::NotFound, "diagnostics log dir not set")
    })?;
    let path = dir.join(LOG_FILE);
    rotate_if_needed(&path)?;
    let mut file = OpenOptions::new().create(true).append(true).open(&path)?;
    let line = serde_json::to_string(event).unwrap_or_else(|_| "{}".to_string());
    file.write_all(line.as_bytes())?;
    file.write_all(b"\n")?;
    Ok(())
}

#[tauri::command]
pub fn diagnostics_report_error(input: ReportInput) -> Result<(), IpcError> {
    let mut event = CrashEvent {
        timestamp: now_iso8601(),
        source: input.source,
        message: input.message,
        stack: input.stack,
        route: input.route,
        version: input.version,
    };
    redact_event(&mut event);
    // Best-effort — disk errors do not propagate to the user.
    if let Err(err) = write_event(&event) {
        eprintln!("noxe: failed to write crash event: {err}");
    }
    Ok(())
}

#[tauri::command]
pub fn diagnostics_crash_log_path(app: AppHandle) -> Result<String, IpcError> {
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|err| IpcError::Other(err.to_string()))?;
    Ok(dir.join(LOG_FILE).to_string_lossy().to_string())
}

#[tauri::command]
pub fn diagnostics_recent(app: AppHandle, limit: Option<usize>) -> Result<Vec<CrashEvent>, IpcError> {
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|err| IpcError::Other(err.to_string()))?;
    let path = dir.join(LOG_FILE);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let text = fs::read_to_string(&path)?;
    let mut events: Vec<CrashEvent> = text
        .lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|line| serde_json::from_str::<CrashEvent>(line).ok())
        .collect();
    let cap = limit.unwrap_or(50);
    if events.len() > cap {
        let skip = events.len() - cap;
        events.drain(..skip);
    }
    Ok(events)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn redactor_scrubs_vault_path() {
        let out = redact("error at /Users/foo/Vault/note.md line 12", Some("/Users/foo/Vault"));
        assert!(out.contains("<vault>"), "got: {out}");
        assert!(!out.contains("/Users/foo/Vault"));
    }

    #[test]
    fn redactor_scrubs_long_token_runs() {
        let token = "A".repeat(60);
        let out = redact(&format!("token={token}"), None);
        assert!(out.contains("<redacted>"));
        assert!(!out.contains(&token));
    }

    #[test]
    fn redactor_truncates_long_fields() {
        let long = "a".repeat(MAX_FIELD_BYTES + 100);
        let out = redact(&long, None);
        assert!(out.ends_with("…[truncated]"));
        assert!(out.len() < long.len() + 20);
    }

    #[test]
    fn rotation_triggers_at_threshold() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(LOG_FILE);
        std::fs::write(&path, vec![b'x'; MAX_LOG_BYTES as usize + 10]).unwrap();
        rotate_if_needed(&path).unwrap();
        assert!(!path.exists());
        assert!(path.with_file_name(ROTATED_FILE).exists());
    }

    #[test]
    fn rotation_noop_below_threshold() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(LOG_FILE);
        std::fs::write(&path, b"small").unwrap();
        rotate_if_needed(&path).unwrap();
        assert!(path.exists());
        assert!(!path.with_file_name(ROTATED_FILE).exists());
    }
}
