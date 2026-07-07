use std::collections::HashMap;
use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use rusqlite::Connection;
use serde::Serialize;

use crate::ai::cache;
use crate::ai::prompt;
use crate::ai::skills::{Skill, SkillStore};
use crate::ai::telemetry;
use crate::ai::tiers;
use crate::ai::{binary_available, binary_for_provider, AiError};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSkillResult {
    pub output: String,
    pub cache_hit: bool,
    pub tokens_in: u32,
    pub tokens_out: u32,
    pub latency_ms: u32,
    pub skill_id: String,
}

/// Approximate token count from byte length (chars/4 heuristic).
fn approx_tokens(s: &str) -> u32 {
    (s.len() / 4) as u32
}

/// Trait so tests can inject a fake spawner.
pub trait Spawner: Send + Sync {
    /// Verify that the underlying binary is reachable. Real impl uses `which`.
    fn check(&self, provider: &str) -> Result<(), AiError>;
    fn spawn(&self, binary: &str, args: &[String], stdin_data: &str, timeout_secs: u64) -> Result<String, AiError>;
}

pub struct ProcessSpawner;

impl Spawner for ProcessSpawner {
    fn check(&self, provider: &str) -> Result<(), AiError> {
        let binary = binary_for_provider(provider)
            .ok_or_else(|| AiError::provider_disabled(format!("Unknown AI provider: {provider}")))?;
        if !binary_available(binary) {
            return Err(AiError::binary_not_found(format!(
                "Binary '{binary}' not found on PATH. Please install it and restart Cork."
            )));
        }
        Ok(())
    }

    fn spawn(&self, binary: &str, args: &[String], stdin_data: &str, timeout_secs: u64) -> Result<String, AiError> {
        let mut cmd = Command::new(binary);
        for a in args {
            cmd.arg(a);
        }
        let mut child = cmd
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| AiError::subprocess_failed(format!("spawn '{binary}': {e}")))?;
        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(stdin_data.as_bytes())
                .map_err(|e| AiError::subprocess_failed(format!("stdin write: {e}")))?;
        }
        let (tx, rx) = mpsc::channel();
        thread::spawn(move || {
            let _ = tx.send(child.wait_with_output());
        });
        let output = rx
            .recv_timeout(Duration::from_secs(timeout_secs))
            .map_err(|_| AiError::timeout(format!("AI request timed out after {timeout_secs}s")))?
            .map_err(|e| AiError::subprocess_failed(format!("subprocess: {e}")))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AiError::subprocess_failed(format!(
                "'{binary}' exited with error: {}",
                stderr.trim()
            )));
        }
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    }
}

/// Run a skill end-to-end: build prompt → cache lookup → spawn → cache store → telemetry.
#[allow(clippy::too_many_arguments)]
pub fn run<S: Spawner>(
    skill: &Skill,
    vars: &HashMap<String, String>,
    provider: &str,
    spawner: &S,
    conn: &Connection,
) -> Result<AiSkillResult, AiError> {
    let started = Instant::now();

    if provider == "disabled" {
        let _ = telemetry::record(
            conn,
            &skill.id,
            provider,
            false,
            0,
            0,
            0,
            Some("provider_disabled"),
        );
        return Err(AiError::provider_disabled(
            "AI provider is disabled. Configure a provider in Settings → AI.",
        ));
    }
    let binary = binary_for_provider(provider).ok_or_else(|| {
        let _ = telemetry::record(
            conn,
            &skill.id,
            provider,
            false,
            0,
            0,
            0,
            Some("provider_disabled"),
        );
        AiError::provider_disabled(format!("Unknown AI provider: {provider}"))
    })?;

    let prompt_text = prompt::build(skill, vars);
    let key = cache::key_for(&skill.id, &prompt_text);

    if skill.cache {
        if let Ok(Some(entry)) = cache::get(conn, &key) {
            let latency = started.elapsed().as_millis() as u32;
            let _ = telemetry::record(
                conn, &skill.id, provider, true, 0, 0, latency, None,
            );
            return Ok(AiSkillResult {
                output: entry.output,
                cache_hit: true,
                tokens_in: entry.tokens_in,
                tokens_out: entry.tokens_out,
                latency_ms: latency,
                skill_id: skill.id.clone(),
            });
        }
    }

    if let Err(err) = spawner.check(provider) {
        let latency = started.elapsed().as_millis() as u32;
        let _ = telemetry::record(
            conn,
            &skill.id,
            provider,
            false,
            approx_tokens(&prompt_text),
            0,
            latency,
            Some(err.kind),
        );
        return Err(err);
    }

    let args = tiers::args_for(provider, &skill.model_tier);
    let result = spawner.spawn(binary, &args, &prompt_text, skill.timeout_secs.max(1));

    let latency = started.elapsed().as_millis() as u32;
    let tokens_in = approx_tokens(&prompt_text);

    match result {
        Ok(raw) => {
            let output = raw.trim().to_string();
            let tokens_out = approx_tokens(&output);
            if skill.cache {
                let _ = cache::put(
                    conn,
                    &key,
                    &skill.id,
                    &output,
                    tokens_in,
                    tokens_out,
                    provider,
                );
            }
            let _ = telemetry::record(
                conn, &skill.id, provider, false, tokens_in, tokens_out, latency, None,
            );
            Ok(AiSkillResult {
                output,
                cache_hit: false,
                tokens_in,
                tokens_out,
                latency_ms: latency,
                skill_id: skill.id.clone(),
            })
        }
        Err(err) => {
            let _ = telemetry::record(
                conn,
                &skill.id,
                provider,
                false,
                tokens_in,
                0,
                latency,
                Some(err.kind),
            );
            Err(err)
        }
    }
}

/// Look up a skill by id, returning the structured `skill_not_found` error if missing.
pub fn lookup<'a>(store: &'a SkillStore, skill_id: &str) -> Result<&'a Skill, AiError> {
    store
        .get(skill_id)
        .ok_or_else(|| AiError::skill_not_found(format!("Unknown skill id: {skill_id}")))
}
