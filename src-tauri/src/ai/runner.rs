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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::db::open_ai_db;
    use crate::ai::skills::{ModelTier, SkillSource};
    use std::sync::Mutex;
    use tempfile::tempdir;

    struct FakeSpawner {
        responses: Mutex<Vec<Result<String, AiError>>>,
        calls: Mutex<u32>,
    }
    impl FakeSpawner {
        fn ok(out: &str) -> Self {
            Self {
                responses: Mutex::new(vec![Ok(out.to_string())]),
                calls: Mutex::new(0),
            }
        }
        fn err(e: AiError) -> Self {
            Self {
                responses: Mutex::new(vec![Err(e)]),
                calls: Mutex::new(0),
            }
        }
        fn call_count(&self) -> u32 {
            *self.calls.lock().unwrap()
        }
    }
    impl Spawner for FakeSpawner {
        fn check(&self, _provider: &str) -> Result<(), AiError> {
            Ok(())
        }
        fn spawn(
            &self,
            _binary: &str,
            _args: &[String],
            _stdin: &str,
            _timeout_secs: u64,
        ) -> Result<String, AiError> {
            *self.calls.lock().unwrap() += 1;
            self.responses
                .lock()
                .unwrap()
                .pop()
                .unwrap_or_else(|| Err(AiError::subprocess_failed("no more responses")))
        }
    }

    fn skill(cache_on: bool) -> Skill {
        Skill {
            id: "summarize".into(),
            name: "Summarize".into(),
            model_tier: ModelTier::Small,
            max_tokens_in: 1000,
            max_tokens_out: 200,
            cache: cache_on,
            output_schema: "text".into(),
            triggers: vec![],
            timeout_secs: 60,
            system_prompt: "Summarise: {{body}}".into(),
            source: SkillSource::Bundled,
        }
    }

    fn vars(body: &str) -> HashMap<String, String> {
        let mut h = HashMap::new();
        h.insert("body".into(), body.into());
        h
    }

    #[test]
    fn miss_then_hit_reuses_cache_and_skips_spawner() {
        let dir = tempdir().unwrap();
        let conn = open_ai_db(dir.path()).unwrap();
        let s = skill(true);
        let v = vars("hello");

        // First call: spawner returns "world"
        let spawner = FakeSpawner::ok("world");
        let r1 = run(&s, &v, "claude", &spawner, &conn).unwrap();
        assert!(!r1.cache_hit);
        assert_eq!(r1.output, "world");
        assert_eq!(spawner.call_count(), 1);

        // Second call: cache should hit, spawner unused.
        let spawner2 = FakeSpawner::ok("SHOULD NOT BE CALLED");
        let r2 = run(&s, &v, "claude", &spawner2, &conn).unwrap();
        assert!(r2.cache_hit);
        assert_eq!(r2.output, "world");
        assert_eq!(spawner2.call_count(), 0);

        // Telemetry has 2 rows.
        let stats = telemetry::stats(&conn, None, 0, 0).unwrap();
        assert_eq!(stats.calls_total, 2);
        assert!((stats.cache_hit_rate - 0.5).abs() < 1e-6);
    }

    #[test]
    fn cache_disabled_skill_always_spawns() {
        let dir = tempdir().unwrap();
        let conn = open_ai_db(dir.path()).unwrap();
        let s = skill(false);
        let v = vars("hi");
        let spawner = FakeSpawner {
            responses: Mutex::new(vec![Ok("a".into()), Ok("b".into())]),
            calls: Mutex::new(0),
        };
        let r1 = run(&s, &v, "claude", &spawner, &conn).unwrap();
        let r2 = run(&s, &v, "claude", &spawner, &conn).unwrap();
        assert!(!r1.cache_hit);
        assert!(!r2.cache_hit);
        assert_eq!(spawner.call_count(), 2);
    }

    #[test]
    fn provider_disabled_records_error_and_skips_spawner() {
        let dir = tempdir().unwrap();
        let conn = open_ai_db(dir.path()).unwrap();
        let spawner = FakeSpawner::ok("never");
        let err = run(&skill(true), &vars("x"), "disabled", &spawner, &conn).unwrap_err();
        assert_eq!(err.kind, "provider_disabled");
        assert_eq!(spawner.call_count(), 0);
        let stats = telemetry::stats(&conn, None, 0, 0).unwrap();
        assert_eq!(stats.calls_total, 1);
    }

    #[test]
    fn spawner_error_does_not_cache_but_records_telemetry() {
        let dir = tempdir().unwrap();
        let conn = open_ai_db(dir.path()).unwrap();
        let spawner = FakeSpawner::err(AiError::timeout("slow"));
        let result = run(&skill(true), &vars("x"), "claude", &spawner, &conn);
        let err = result.unwrap_err();
        assert_eq!(err.kind, "timeout");
        let stats = telemetry::stats(&conn, None, 0, 0).unwrap();
        assert_eq!(stats.calls_total, 1);
        // No cache row should be created on failure.
        assert_eq!(crate::ai::cache::rows_count(&conn).unwrap(), 0);
    }
}
