use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use command_group::CommandGroup;
use rusqlite::Connection;
use serde::Serialize;

use crate::ai::cache;
use crate::ai::prompt;
use crate::ai::skills::{Skill, SkillStore};
use crate::ai::telemetry;
use crate::ai::tiers;
use crate::ai::{binary_for_provider, resolve_binary, spawn_path, AiError};

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
    fn spawn(
        &self,
        binary: &str,
        args: &[String],
        stdin_data: &str,
        timeout_secs: u64,
    ) -> Result<String, AiError>;
}

pub struct ProcessSpawner;

fn copilot_config_dir() -> Option<PathBuf> {
    std::env::var_os("COPILOT_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".copilot")))
        .or_else(|| {
            std::env::var_os("USERPROFILE").map(|home| PathBuf::from(home).join(".copilot"))
        })
}

fn isolated_copilot_home() -> Result<tempfile::TempDir, AiError> {
    let temp = tempfile::tempdir().map_err(|e| {
        AiError::subprocess_failed(format!("create Copilot session directory: {e}"))
    })?;
    if let Some(source) = copilot_config_dir().map(|path| path.join("config.json")) {
        if source.is_file() {
            fs::copy(&source, temp.path().join("config.json")).map_err(|e| {
                AiError::subprocess_failed(format!("copy Copilot authentication config: {e}"))
            })?;
        }
    }
    Ok(temp)
}

impl Spawner for ProcessSpawner {
    fn check(&self, provider: &str) -> Result<(), AiError> {
        let binary = binary_for_provider(provider).ok_or_else(|| {
            AiError::provider_disabled(format!("Unknown AI provider: {provider}"))
        })?;
        if resolve_binary(binary).is_none() {
            return Err(AiError::binary_not_found(format!(
                "'{binary}' was not found. Cork looked in: {}. \
                 If it works in your terminal, it is installed somewhere the app cannot see — \
                 symlink it into /usr/local/bin and try again.",
                spawn_path()
            )));
        }
        Ok(())
    }

    fn spawn(
        &self,
        binary: &str,
        args: &[String],
        stdin_data: &str,
        timeout_secs: u64,
    ) -> Result<String, AiError> {
        // Launch the absolute path: a GUI process inherits a minimal PATH, so
        // the bare name would not resolve even when the CLI is installed.
        let program = resolve_binary(binary).ok_or_else(|| {
            AiError::binary_not_found(format!("'{binary}' was not found on PATH"))
        })?;
        let mut cmd = Command::new(program);
        let copilot_home = if binary == "copilot" {
            Some(isolated_copilot_home()?)
        } else {
            None
        };
        // The CLI spawns its own helpers (node, git, …) — give it a usable PATH.
        cmd.env("PATH", spawn_path());
        if let Some(home) = &copilot_home {
            cmd.env("COPILOT_HOME", home.path());
            cmd.env("COPILOT_CACHE_HOME", home.path().join("cache"));
        }
        for a in args {
            cmd.arg(a);
        }

        // A secure temporary file avoids command-line disclosure and a blocking
        // pipe write before the timeout starts. It is removed after the process.
        let mut prompt_file = tempfile::NamedTempFile::new()
            .map_err(|e| AiError::subprocess_failed(format!("create prompt input: {e}")))?;
        prompt_file
            .write_all(stdin_data.as_bytes())
            .map_err(|e| AiError::subprocess_failed(format!("write prompt input: {e}")))?;
        let prompt_input = prompt_file
            .reopen()
            .map_err(|e| AiError::subprocess_failed(format!("open prompt input: {e}")))?;
        let stdout_file = tempfile::NamedTempFile::new()
            .map_err(|e| AiError::subprocess_failed(format!("create stdout capture: {e}")))?;
        let stderr_file = tempfile::NamedTempFile::new()
            .map_err(|e| AiError::subprocess_failed(format!("create stderr capture: {e}")))?;
        cmd.stdin(Stdio::from(prompt_input))
            .stdout(Stdio::from(stdout_file.reopen().map_err(|e| {
                AiError::subprocess_failed(format!("open stdout capture: {e}"))
            })?))
            .stderr(Stdio::from(stderr_file.reopen().map_err(|e| {
                AiError::subprocess_failed(format!("open stderr capture: {e}"))
            })?));

        #[cfg(windows)]
        let mut child = cmd
            .group()
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| AiError::subprocess_failed(format!("spawn '{binary}': {e}")))?;
        #[cfg(not(windows))]
        let mut child = cmd
            .group_spawn()
            .map_err(|e| AiError::subprocess_failed(format!("spawn '{binary}': {e}")))?;

        let deadline = Instant::now() + Duration::from_secs(timeout_secs);
        let status = loop {
            if let Some(status) = child
                .try_wait()
                .map_err(|e| AiError::subprocess_failed(format!("wait for subprocess: {e}")))?
            {
                // Remove background descendants that outlived the CLI leader.
                let _ = child.kill();
                break status;
            }
            if Instant::now() >= deadline {
                child.kill().map_err(|e| {
                    AiError::subprocess_failed(format!("terminate timed-out subprocess: {e}"))
                })?;
                child.wait().map_err(|e| {
                    AiError::subprocess_failed(format!("reap timed-out subprocess: {e}"))
                })?;
                drop(child);
                drop(copilot_home);
                drop(prompt_file);
                return Err(AiError::timeout(format!(
                    "AI request timed out after {timeout_secs}s"
                )));
            }
            thread::sleep(Duration::from_millis(25));
        };
        drop(child);
        let stdout = fs::read(stdout_file.path())
            .map_err(|e| AiError::subprocess_failed(format!("read subprocess stdout: {e}")))?;
        let stderr = fs::read(stderr_file.path())
            .map_err(|e| AiError::subprocess_failed(format!("read subprocess stderr: {e}")))?;
        drop(copilot_home);
        drop(prompt_file);
        if !status.success() {
            // Some CLIs fail silently on a bad flag — an empty stderr would
            // otherwise surface as "exited with error:" and nothing else.
            let stderr = String::from_utf8_lossy(&stderr);
            let stdout = String::from_utf8_lossy(&stdout);
            let detail = if !stderr.trim().is_empty() {
                stderr.trim().to_string()
            } else if !stdout.trim().is_empty() {
                stdout.trim().to_string()
            } else {
                match status.code() {
                    Some(code) => format!(
                        "exited with status {code} and no message — often an unknown model name or an unsupported flag"
                    ),
                    None => "was terminated before it produced output".to_string(),
                }
            };
            return Err(AiError::subprocess_failed(format!("{binary}: {detail}")));
        }
        Ok(String::from_utf8_lossy(&stdout).into_owned())
    }
}

/// Run a skill end-to-end: build prompt → cache lookup → spawn → cache store → telemetry.
///
/// `model_override` is the user's model choice for this provider and tier;
/// empty means the provider's own automatic/default choice.
#[allow(clippy::too_many_arguments)]
pub fn run<S: Spawner>(
    skill: &Skill,
    vars: &HashMap<String, String>,
    provider: &str,
    model_override: &str,
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

    let invocation = tiers::invocation(provider, model_override, &prompt_text)?;
    let key = cache::key_for(
        &skill.id,
        &prompt_text,
        provider,
        &invocation.model_identity,
    );

    if skill.cache {
        if let Ok(Some(entry)) = cache::get(conn, &key) {
            let latency = started.elapsed().as_millis() as u32;
            let _ = telemetry::record(conn, &skill.id, provider, true, 0, 0, latency, None);
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

    let result = spawner.spawn(
        binary,
        &invocation.args,
        &invocation.stdin,
        skill.timeout_secs.max(1),
    );

    let latency = started.elapsed().as_millis() as u32;
    let tokens_in = approx_tokens(&prompt_text);

    match result {
        Ok(raw) => {
            let output = raw.trim().to_string();
            let tokens_out = approx_tokens(&output);
            if skill.cache {
                let _ = cache::put(
                    conn, &key, &skill.id, &output, tokens_in, tokens_out, provider,
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
