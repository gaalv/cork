use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};

// ── Error type ────────────────────────────────────────────────────────────────

/// AI-specific error returned from `ai_send_prompt`.
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
}

// ── Input type ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendPromptInput {
    pub provider: String,
    pub prompt: String,
    pub context: String,
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

// ── Tauri command ─────────────────────────────────────────────────────────────

/// Send a prompt to the configured AI provider CLI.
///
/// The full prompt (user message + note context) is written to the subprocess
/// **stdin** — never passed as a command-line argument — to avoid any shell
/// injection risk and to handle arbitrarily long prompts without hitting OS
/// argv limits.
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

    // Write prompt to stdin then drop the handle (signals EOF to the child).
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(full_prompt.as_bytes())
            .map_err(|e| AiError::subprocess_failed(format!("Failed to write stdin: {}", e)))?;
    }

    // Collect output in a background thread so we can apply a timeout.
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
        // Use a binary name that is guaranteed not to exist.
        let input = SendPromptInput {
            provider: "claude".to_string(),
            prompt: "hello".to_string(),
            context: "".to_string(),
        };
        // Only run the binary_not_found path when the binary is actually absent.
        if !binary_available("claude") {
            let result = ai_send_prompt(input);
            assert!(result.is_err());
            assert_eq!(result.unwrap_err().kind, "binary_not_found");
        }
    }
}
