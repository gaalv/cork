//! F26 — GitHub sync layer on top of F18's local git.
//!
//! Two background workers:
//! - **Push worker** — wakes on `mark_push_pending`, debounces 5 s, runs
//!   `git push origin <branch>` and coalesces concurrent requests.
//! - **Heartbeat worker** — every 12 s runs `pull_with_conflict_copy` and,
//!   when local commits are ahead, triggers a push.
//!
//! Conflict policy: 3-way merge first (default `git merge`), conflict-as-copy
//! fallback. The remote version of any conflicted file is preserved as
//! `<base> (conflict from <host> <iso>).<ext>` and the local version stays
//! canonical — we never expose `<<<<<<<` markers.

use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use crate::vault::settings::{load_vault_settings, save_vault_settings, GitRemoteSettings};
use crate::vault::VaultState;
use crate::IpcError;

// ── Public types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SyncStatus {
    Idle,
    Syncing,
    Error,
}

impl Default for SyncStatus {
    fn default() -> Self {
        SyncStatus::Idle
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteInfo {
    pub enabled: bool,
    pub url: Option<String>,
    pub sync_status: SyncStatus,
    pub last_push: Option<String>,
    pub last_pull: Option<String>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnableRemoteInput {
    pub url: Option<String>,
    /// Optional personal access token. When provided alongside an https URL,
    /// it is embedded in the remote URL stored in `.git/config` so that push
    /// authenticates as the token's owner — bypassing the active `gh` account.
    pub token: Option<String>,
}

// ── State ────────────────────────────────────────────────────────────────────

#[derive(Debug, Default)]
pub(crate) struct RemoteInner {
    pub(crate) status: SyncStatus,
    pub(crate) last_push: Option<String>,
    pub(crate) last_pull: Option<String>,
    pub(crate) last_error: Option<String>,
    pub(crate) push_pending: bool,
    pub(crate) in_flight: bool,
    pub(crate) push_queued_at: Option<Instant>,
    pub(crate) enabled: bool,
    pub(crate) url: Option<String>,
    pub(crate) vault_root: Option<PathBuf>,
}

#[derive(Default)]
pub struct RemoteState {
    pub(crate) inner: Arc<Mutex<RemoteInner>>,
    workers_started: AtomicBool,
}

impl RemoteState {
    pub(crate) fn inner_arc(&self) -> Arc<Mutex<RemoteInner>> {
        Arc::clone(&self.inner)
    }

    pub fn snapshot(&self) -> RemoteInfo {
        let inner = self.inner.lock().expect("remote state mutex poisoned");
        RemoteInfo {
            enabled: inner.enabled,
            url: inner.url.clone(),
            sync_status: inner.status,
            last_push: inner.last_push.clone(),
            last_pull: inner.last_pull.clone(),
            last_error: inner.last_error.clone(),
        }
    }

    pub fn configure(&self, vault_root: Option<PathBuf>, settings: Option<GitRemoteSettings>) {
        let mut inner = self.inner.lock().expect("remote state mutex poisoned");
        inner.vault_root = vault_root;
        match settings {
            Some(s) => {
                inner.enabled = s.enabled;
                inner.url = s.url;
            }
            None => {
                inner.enabled = false;
                inner.url = None;
            }
        }
        inner.status = if inner.enabled {
            SyncStatus::Idle
        } else {
            SyncStatus::Idle
        };
        inner.last_error = None;
    }

    /// Mark that a push is needed. Idempotent. Sets `push_queued_at` to now to
    /// drive the 5 s debounce.
    pub fn mark_push_pending(&self) {
        let mut inner = self.inner.lock().expect("remote state mutex poisoned");
        if !inner.enabled {
            return;
        }
        inner.push_pending = true;
        inner.push_queued_at = Some(Instant::now());
    }

    pub fn is_enabled(&self) -> bool {
        self.inner
            .lock()
            .expect("remote state mutex poisoned")
            .enabled
    }
}

// ── Worker bootstrap ─────────────────────────────────────────────────────────

const PUSH_DEBOUNCE: Duration = Duration::from_secs(5);
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(12);

pub fn start_workers(state: &RemoteState) {
    if state
        .workers_started
        .swap(true, Ordering::SeqCst)
    {
        return;
    }
    let push_inner = Arc::clone(&state.inner);
    std::thread::spawn(move || push_worker_loop(push_inner));

    let heartbeat_inner = Arc::clone(&state.inner);
    std::thread::spawn(move || heartbeat_worker_loop(heartbeat_inner));
}

fn push_worker_loop(inner: Arc<Mutex<RemoteInner>>) {
    loop {
        std::thread::sleep(Duration::from_secs(1));
        let task: Option<PathBuf> = {
            let mut g = inner.lock().expect("remote state mutex poisoned");
            if !g.enabled || !g.push_pending || g.in_flight {
                None
            } else if let Some(qa) = g.push_queued_at {
                if qa.elapsed() < PUSH_DEBOUNCE {
                    None
                } else {
                    let root = g.vault_root.clone();
                    if root.is_some() {
                        g.in_flight = true;
                        g.push_pending = false;
                        g.push_queued_at = None;
                        g.status = SyncStatus::Syncing;
                    }
                    root
                }
            } else {
                None
            }
        };
        if let Some(root) = task {
            let outcome = git_push(&root);
            finish_op(&inner, outcome, OpKind::Push);
        }
    }
}

fn heartbeat_worker_loop(inner: Arc<Mutex<RemoteInner>>) {
    loop {
        std::thread::sleep(HEARTBEAT_INTERVAL);
        let root: Option<PathBuf> = {
            let mut g = inner.lock().expect("remote state mutex poisoned");
            if !g.enabled || g.in_flight {
                None
            } else if let Some(root) = g.vault_root.clone() {
                g.in_flight = true;
                g.status = SyncStatus::Syncing;
                Some(root)
            } else {
                None
            }
        };
        if let Some(root) = root {
            let outcome = pull_with_conflict_copy(&root);
            let push_after = matches!(&outcome, Ok(PullOutcome::Merged | PullOutcome::ConflictCopied(_)))
                && local_is_ahead(&root);
            finish_op(&inner, outcome.map(|_| ()).map_err(|e| e), OpKind::Pull);
            if push_after {
                if let Ok(mut g) = inner.lock() {
                    g.push_pending = true;
                    g.push_queued_at = Some(Instant::now() - PUSH_DEBOUNCE);
                }
            }
        }
    }
}

#[derive(Clone, Copy)]
enum OpKind {
    Push,
    Pull,
}

fn finish_op(inner: &Arc<Mutex<RemoteInner>>, outcome: Result<(), String>, kind: OpKind) {
    let now_iso = chrono::Utc::now().to_rfc3339();
    let mut g = inner.lock().expect("remote state mutex poisoned");
    g.in_flight = false;
    match outcome {
        Ok(()) => {
            g.last_error = None;
            g.status = SyncStatus::Idle;
            match kind {
                OpKind::Push => g.last_push = Some(now_iso),
                OpKind::Pull => g.last_pull = Some(now_iso),
            }
        }
        Err(err) => {
            g.last_error = Some(err);
            g.status = SyncStatus::Error;
        }
    }
}

// ── Git operations ───────────────────────────────────────────────────────────

pub fn gh_available() -> bool {
    Command::new("gh")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GhAccount {
    pub user: String,
    pub host: String,
}

/// Best-effort active gh account discovery. Parses `gh auth status` output.
///
/// Cached for 5 minutes — `gh auth status` makes a network round-trip to
/// GitHub to validate the token, which can easily take a few seconds. Without
/// caching, every `vcs_status` poll (~every 5 s from the UI) would block a
/// worker thread, making the Sync settings feel frozen.
pub fn gh_active_account() -> Option<GhAccount> {
    static CACHE: OnceLock<Mutex<Option<(Instant, Option<GhAccount>)>>> = OnceLock::new();
    let cell = CACHE.get_or_init(|| Mutex::new(None));
    if let Ok(guard) = cell.lock() {
        if let Some((ts, ref value)) = *guard {
            if ts.elapsed() < Duration::from_secs(300) {
                return value.clone();
            }
        }
    }
    let fresh = gh_active_account_uncached();
    if let Ok(mut guard) = cell.lock() {
        *guard = Some((Instant::now(), fresh.clone()));
    }
    fresh
}

fn gh_active_account_uncached() -> Option<GhAccount> {
    let out = Command::new("gh").args(["auth", "status"]).output().ok()?;
    let combined = format!(
        "{}\n{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
    let mut current_host: Option<String> = None;
    for line in combined.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        // Lines like "github.com" (host header) — no leading bullet
        if !trimmed.starts_with('-')
            && !trimmed.starts_with('✓')
            && !trimmed.starts_with('x')
            && !trimmed.contains(':')
            && trimmed.contains('.')
        {
            current_host = Some(trimmed.to_string());
            continue;
        }
        // Lines like "✓ Logged in to github.com account <user> (...)"
        if let Some(idx) = trimmed.find("account ") {
            let rest = &trimmed[idx + "account ".len()..];
            let user = rest.split_whitespace().next().unwrap_or("").trim().to_string();
            // Try to recover host from the same line if present.
            let host = trimmed
                .split_whitespace()
                .find(|w| w.contains('.') && !w.contains('('))
                .map(|s| s.trim_end_matches(':').to_string())
                .or_else(|| current_host.clone())
                .unwrap_or_else(|| "github.com".to_string());
            if !user.is_empty() {
                return Some(GhAccount { user, host });
            }
        }
        // Lines like "- Active account: true" / "- Logged in to github.com as <user>"
        if let Some(rest) = trimmed.strip_prefix("- Logged in to ") {
            let mut parts = rest.split_whitespace();
            let host = parts
                .next()
                .unwrap_or("github.com")
                .trim_end_matches(':')
                .to_string();
            if let Some(as_idx) = rest.find(" as ") {
                let after = &rest[as_idx + 4..];
                let user = after.split_whitespace().next().unwrap_or("").to_string();
                if !user.is_empty() {
                    return Some(GhAccount { user, host });
                }
            }
        }
    }
    None
}

fn run_git(vault_root: &Path, args: &[&str]) -> Result<Output, String> {
    Command::new("git")
        .current_dir(vault_root)
        // Never let git prompt for credentials — without a TTY it would
        // hang forever. We supply auth via http.extraHeader / SSH instead.
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_ASKPASS", "")
        .env("SSH_ASKPASS", "")
        .args(args)
        .output()
        .map_err(|e| e.to_string())
}

fn run_git_check(vault_root: &Path, args: &[&str]) -> Result<String, String> {
    let out = run_git(vault_root, args)?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(format!(
            "git {} failed: {}",
            args.first().copied().unwrap_or(""),
            if stderr.is_empty() {
                "non-zero exit".to_string()
            } else {
                stderr
            }
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

fn git_push(vault_root: &Path) -> Result<(), String> {
    let _ = append_log(vault_root, "[push] start");
    let out = run_git_check(vault_root, &["push", "origin", "HEAD"]);
    let _ = append_log(
        vault_root,
        &match &out {
            Ok(stdout) => format!("[push] ok\n{stdout}"),
            Err(err) => format!("[push] error: {err}"),
        },
    );
    out.map(|_| ())
}

#[derive(Debug)]
pub enum PullOutcome {
    NotConfigured,
    Merged,
    ConflictCopied(Vec<PathBuf>),
}

pub fn pull_with_conflict_copy(vault_root: &Path) -> Result<PullOutcome, String> {
    if !vault_root.join(".git").exists() {
        return Ok(PullOutcome::NotConfigured);
    }
    let _ = append_log(vault_root, "[pull] fetch");
    run_git_check(vault_root, &["fetch", "origin"]).map_err(|e| e)?;

    // Determine upstream branch ref. If none, abort gracefully.
    let upstream = run_git_check(
        vault_root,
        &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
    )
    .map(|s| s.trim().to_string())
    .unwrap_or_else(|_| "origin/main".to_string());

    let merge = run_git(vault_root, &["merge", "--no-edit", "--no-ff", &upstream])?;
    if merge.status.success() {
        let _ = append_log(vault_root, "[pull] merged cleanly");
        return Ok(PullOutcome::Merged);
    }

    // Collect conflicts
    let conflicted_raw = run_git_check(
        vault_root,
        &["diff", "--name-only", "--diff-filter=U"],
    )?;
    let conflicted: Vec<PathBuf> = conflicted_raw
        .lines()
        .filter(|l| !l.is_empty())
        .map(PathBuf::from)
        .collect();

    if conflicted.is_empty() {
        // Some other failure — abort and bubble up
        let _ = run_git(vault_root, &["merge", "--abort"]);
        let stderr = String::from_utf8_lossy(&merge.stderr).to_string();
        return Err(format!("merge failed without conflict list: {stderr}"));
    }

    let host = hostname();
    let stamp = chrono::Utc::now().format("%Y-%m-%dT%H-%M-%SZ").to_string();
    for path in &conflicted {
        let theirs = run_git_check(
            vault_root,
            &["show", &format!(":3:{}", path.to_string_lossy())],
        )?;
        let copy_name = build_conflict_filename(path, &host, &stamp);
        let copy_path = vault_root.join(&copy_name);
        if let Some(parent) = copy_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        std::fs::write(&copy_path, theirs).map_err(|e| e.to_string())?;
        run_git_check(
            vault_root,
            &["checkout", "--ours", "--", &path.to_string_lossy()],
        )?;
        run_git_check(
            vault_root,
            &["add", "--", &path.to_string_lossy(), &copy_name],
        )?;
    }
    run_git_check(
        vault_root,
        &[
            "commit",
            "-m",
            "Merge remote: kept local, saved remote conflicts as copies",
            "--author=Noxe <noxe@local>",
        ],
    )?;
    let _ = append_log(
        vault_root,
        &format!("[pull] resolved {} conflicts via copy", conflicted.len()),
    );
    Ok(PullOutcome::ConflictCopied(conflicted))
}

fn local_is_ahead(vault_root: &Path) -> bool {
    run_git_check(
        vault_root,
        &["rev-list", "--count", "@{u}..HEAD"],
    )
    .map(|s| s.trim().parse::<u32>().unwrap_or(0) > 0)
    .unwrap_or(false)
}

pub fn build_conflict_filename(path: &Path, host: &str, stamp: &str) -> String {
    let parent = path.parent().map(|p| p.to_string_lossy().to_string());
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "note".to_string());
    let ext = path
        .extension()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "md".to_string());
    let base = format!("{stem} (conflict from {host} {stamp}).{ext}");
    match parent.as_deref() {
        Some("") | None => base,
        Some(p) => format!("{p}/{base}"),
    }
}

/// Sanitizes a URL by dropping any `user:pass@` segment so that the value
/// stored in vault settings never carries credentials.
fn strip_userinfo(url: &str) -> String {
    if let Some(rest) = url.strip_prefix("https://") {
        if let Some(at) = rest.find('@') {
            // Drop "user:pass@" segment, keep host+path.
            return format!("https://{}", &rest[at + 1..]);
        }
    }
    url.to_string()
}

fn hostname() -> String {
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .ok()
        .or_else(|| {
            Command::new("hostname")
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        })
        .unwrap_or_else(|| "device".to_string())
}

const MAX_LOG_BYTES: u64 = 1_048_576;

fn append_log(vault_root: &Path, line: &str) -> std::io::Result<()> {
    use std::io::Write;
    let dir = vault_root.join(".noxe");
    std::fs::create_dir_all(&dir)?;
    let path = dir.join("sync.log");
    if let Ok(meta) = std::fs::metadata(&path) {
        if meta.len() > MAX_LOG_BYTES {
            let _ = std::fs::remove_file(&path);
        }
    }
    let mut f = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)?;
    let now = chrono::Utc::now().to_rfc3339();
    writeln!(f, "{now} {line}")
}

// ── IPC commands ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn vcs_remote_enable(
    vault_state: tauri::State<'_, VaultState>,
    remote_state: tauri::State<'_, RemoteState>,
    input: EnableRemoteInput,
) -> Result<RemoteInfo, IpcError> {
    let vault_root = vault_state.current_path().ok_or(IpcError::NotFound)?;
    if !super::git_available() {
        return Err(IpcError::Other("git is not available".into()));
    }

    // The bulk of this command is blocking IO (git push/network). Run on
    // the blocking pool so the Tauri runtime — and the UI — stay
    // responsive.
    let vault_root_for_blocking = vault_root.clone();
    let url_set = tauri::async_runtime::spawn_blocking(move || -> Result<String, IpcError> {
        let vault_root = vault_root_for_blocking;
        super::git_init_if_needed(&vault_root).map_err(IpcError::Other)?;
        enable_remote_blocking(&vault_root, input)
    })
    .await
    .map_err(|e| IpcError::Other(format!("background task failed: {e}")))??;

    let mut settings = load_vault_settings(&vault_root).unwrap_or_default();
    settings.git_remote = Some(GitRemoteSettings {
        enabled: true,
        url: Some(url_set.clone()),
        provider: Some("github".to_string()),
    });
    save_vault_settings(&vault_root, &settings)?;

    remote_state.configure(Some(vault_root), settings.git_remote.clone());
    Ok(remote_state.snapshot())
}

fn enable_remote_blocking(
    vault_root: &Path,
    input: EnableRemoteInput,
) -> Result<String, IpcError> {

    let url_set: String;
    if let Some(url) = input.url.clone() {
        let trimmed_url = url.trim().to_string();
        let stored = strip_userinfo(&trimmed_url);
        let token = input
            .token
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty());

        let _ = run_git(&vault_root, &["remote", "remove", "origin"]);
        // Always store the sanitized URL (no token) as the remote URL.
        // Authentication is configured separately so it never lands in
        // .git/config in plaintext when not needed, and so we can use
        // http.extraHeader which bypasses any credential helper.
        run_git_check(&vault_root, &["remote", "add", "origin", &stored])
            .map_err(IpcError::Other)?;

        // Reset any previous per-remote auth overrides.
        let _ = run_git(
            &vault_root,
            &["config", "--local", "--unset-all", "credential.helper"],
        );
        let _ = run_git(
            &vault_root,
            &["config", "--local", "--unset-all", "credential.https://github.com.helper"],
        );
        let _ = run_git(
            &vault_root,
            &["config", "--local", "--remove-section", "http.https://github.com/"],
        );

        if let Some(t) = token {
            // Disable inherited credential helpers — both the URL-less form
            // and the URL-specific one that `gh auth setup-git` writes
            // (otherwise gh's helper still answers for github.com URLs and
            // overrides our token with the active gh account, which on this
            // machine is the enterprise one and produces 403s).
            let _ = run_git(
                &vault_root,
                &["config", "--local", "credential.helper", ""],
            );
            let _ = run_git(
                &vault_root,
                &["config", "--local", "credential.https://github.com.helper", ""],
            );
            // GitHub's git HTTPS endpoint expects HTTP Basic auth with
            // `x-access-token:<PAT>` base64-encoded. This is the exact
            // format actions/checkout uses.
            use base64::Engine as _;
            let basic = base64::engine::general_purpose::STANDARD
                .encode(format!("x-access-token:{t}"));
            let header = format!("AUTHORIZATION: basic {basic}");
            run_git_check(
                &vault_root,
                &[
                    "config",
                    "--local",
                    "http.https://github.com/.extraheader",
                    &header,
                ],
            )
            .map_err(IpcError::Other)?;
        }

        // Make absolutely sure there's at least one commit before we push;
        // a brand-new repo with no HEAD would fail with the cryptic
        // "src refspec HEAD does not match any" error.
        let has_head = run_git(&vault_root, &["rev-parse", "HEAD"])
            .map(|o| o.status.success())
            .unwrap_or(false);
        if !has_head {
            let _ = run_git(&vault_root, &["add", "-A"]);
            let _ = run_git(
                &vault_root,
                &[
                    "commit",
                    "--allow-empty",
                    "-m",
                    "Initial commit",
                    "--author=Noxe <noxe@local>",
                ],
            );
        }

        let push_out = run_git(&vault_root, &["push", "-u", "origin", "HEAD"])
            .map_err(IpcError::Other)?;
        if !push_out.status.success() {
            let stderr = String::from_utf8_lossy(&push_out.stderr)
                .trim()
                .to_string();
            let stdout = String::from_utf8_lossy(&push_out.stdout)
                .trim()
                .to_string();
            let mut msg = "git push failed".to_string();
            if !stderr.is_empty() {
                msg.push_str(": ");
                msg.push_str(&stderr);
            }
            if !stdout.is_empty() {
                msg.push_str(" | ");
                msg.push_str(&stdout);
            }
            // Inline hints for the most common failure modes when
            // pushing with a PAT.
            let lower = format!("{stderr} {stdout}").to_lowercase();
            if lower.contains("403") || lower.contains("permission") {
                msg.push_str(
                    "\nHint: the PAT must have `Contents: Read and write` on this repo. \
                     Fine-grained PATs targeting an org repo also need org owner approval.",
                );
            } else if lower.contains("401") || lower.contains("authentication") {
                msg.push_str(
                    "\nHint: the PAT was rejected. Make sure you copied the full token \
                     and that it hasn't expired.",
                );
            } else if lower.contains("not found") || lower.contains("repository not found") {
                msg.push_str(
                    "\nHint: the repository URL is wrong, the repo doesn't exist, \
                     or the PAT cannot see it (Repository access selection in the PAT).",
                );
            }
            return Err(IpcError::Other(msg));
        }
        url_set = stored;
    } else {
        if !gh_available() {
            return Err(IpcError::Other(
                "gh CLI not found. Install GitHub CLI and run `gh auth login`.".into(),
            ));
        }
        // Clear any leftover credential.helper or extraHeader override
        // from a previous token-based connection so gh's helper takes
        // effect again.
        let _ = run_git(
            &vault_root,
            &["config", "--local", "--unset-all", "credential.helper"],
        );
        let _ = run_git(
            &vault_root,
            &["config", "--local", "--unset-all", "credential.https://github.com.helper"],
        );
        let _ = run_git(
            &vault_root,
            &["config", "--local", "--remove-section", "http.https://github.com/"],
        );
        let auth = Command::new("gh")
            .args(["auth", "status"])
            .output()
            .map_err(|e| IpcError::Other(e.to_string()))?;
        if !auth.status.success() {
            return Err(IpcError::Other(
                "gh is not authenticated. Run `gh auth login`.".into(),
            ));
        }
        let name = format!(
            "noxe-vault-{}",
            chrono::Utc::now().format("%Y%m%d%H%M%S")
        );
        let create = Command::new("gh")
            .current_dir(&vault_root)
            .args([
                "repo",
                "create",
                &name,
                "--private",
                "--source",
                ".",
                "--remote",
                "origin",
                "--push",
            ])
            .output()
            .map_err(|e| IpcError::Other(e.to_string()))?;
        if !create.status.success() {
            let stderr = String::from_utf8_lossy(&create.stderr).to_string();
            return Err(IpcError::Other(format!("gh repo create failed: {stderr}")));
        }
        let url_out = run_git_check(&vault_root, &["remote", "get-url", "origin"])
            .map_err(IpcError::Other)?;
        url_set = url_out.trim().to_string();
    }

    Ok(url_set)
}

#[tauri::command]
pub async fn vcs_remote_disable(
    vault_state: tauri::State<'_, VaultState>,
    remote_state: tauri::State<'_, RemoteState>,
) -> Result<RemoteInfo, IpcError> {
    let vault_root = vault_state.current_path().ok_or(IpcError::NotFound)?;
    let vault_root_for_blocking = vault_root.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _ = run_git(&vault_root_for_blocking, &["remote", "remove", "origin"]);
        let _ = run_git(
            &vault_root_for_blocking,
            &["config", "--local", "--unset-all", "credential.helper"],
        );
        let _ = run_git(
            &vault_root_for_blocking,
            &["config", "--local", "--unset-all", "credential.https://github.com.helper"],
        );
        let _ = run_git(
            &vault_root_for_blocking,
            &["config", "--local", "--remove-section", "http.https://github.com/"],
        );
    })
    .await
    .map_err(|e| IpcError::Other(format!("background task failed: {e}")))?;

    let mut settings = load_vault_settings(&vault_root).unwrap_or_default();
    settings.git_remote = Some(GitRemoteSettings {
        enabled: false,
        url: None,
        provider: Some("github".to_string()),
    });
    save_vault_settings(&vault_root, &settings)?;
    remote_state.configure(Some(vault_root), settings.git_remote);
    Ok(remote_state.snapshot())
}

#[tauri::command]
pub async fn vcs_remote_sync_now(
    vault_state: tauri::State<'_, VaultState>,
    remote_state: tauri::State<'_, RemoteState>,
) -> Result<RemoteInfo, IpcError> {
    let vault_root = vault_state.current_path().ok_or(IpcError::NotFound)?;
    if !remote_state.is_enabled() {
        return Err(IpcError::Other("sync is disabled".into()));
    }
    {
        let mut g = remote_state
            .inner
            .lock()
            .expect("remote state mutex poisoned");
        if g.in_flight {
            return Ok(remote_state.snapshot());
        }
        g.in_flight = true;
        g.status = SyncStatus::Syncing;
    }
    let inner = remote_state.inner_arc();
    let vault_root_for_blocking = vault_root.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let pull_res = pull_with_conflict_copy(&vault_root_for_blocking);
        if pull_res.is_ok() && local_is_ahead(&vault_root_for_blocking) {
            let push_res = git_push(&vault_root_for_blocking);
            finish_op(&inner, push_res, OpKind::Push);
        } else {
            finish_op(&inner, pull_res.map(|_| ()), OpKind::Pull);
        }
    })
    .await
    .map_err(|e| IpcError::Other(format!("background task failed: {e}")))?;
    Ok(remote_state.snapshot())
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn build_conflict_filename_keeps_subfolder() {
        let p = PathBuf::from("projects/Plan.md");
        let s = build_conflict_filename(&p, "macbook", "2026-05-07T17-00-00Z");
        assert_eq!(
            s,
            "projects/Plan (conflict from macbook 2026-05-07T17-00-00Z).md"
        );
    }

    #[test]
    fn build_conflict_filename_root_file() {
        let p = PathBuf::from("Note.md");
        let s = build_conflict_filename(&p, "host", "2026-01-01T00-00-00Z");
        assert_eq!(s, "Note (conflict from host 2026-01-01T00-00-00Z).md");
    }

    #[test]
    fn build_conflict_filename_no_ext_defaults_md() {
        let p = PathBuf::from("README");
        let s = build_conflict_filename(&p, "h", "t");
        assert_eq!(s, "README (conflict from h t).md");
    }

    #[test]
    fn strip_userinfo_drops_existing_userinfo_in_https() {
        assert_eq!(
            strip_userinfo("https://oldtoken@github.com/me/vault.git"),
            "https://github.com/me/vault.git"
        );
    }

    #[test]
    fn strip_userinfo_passes_clean_url_through() {
        assert_eq!(
            strip_userinfo("https://github.com/me/vault.git"),
            "https://github.com/me/vault.git"
        );
    }

    #[test]
    fn strip_userinfo_leaves_ssh_urls_untouched() {
        assert_eq!(
            strip_userinfo("git@github.com:me/vault.git"),
            "git@github.com:me/vault.git"
        );
    }

    #[test]
    fn snapshot_reflects_configure() {
        let st = RemoteState::default();
        st.configure(
            Some(PathBuf::from("/v")),
            Some(GitRemoteSettings {
                enabled: true,
                url: Some("git@github.com:u/r.git".to_string()),
                provider: Some("github".to_string()),
            }),
        );
        let snap = st.snapshot();
        assert!(snap.enabled);
        assert_eq!(snap.url.as_deref(), Some("git@github.com:u/r.git"));
        assert_eq!(snap.sync_status, SyncStatus::Idle);
    }

    #[test]
    fn mark_push_pending_no_op_when_disabled() {
        let st = RemoteState::default();
        st.configure(Some(PathBuf::from("/v")), None);
        st.mark_push_pending();
        let g = st.inner.lock().unwrap();
        assert!(!g.push_pending);
    }

    #[test]
    fn mark_push_pending_sets_flag_when_enabled() {
        let st = RemoteState::default();
        st.configure(
            Some(PathBuf::from("/v")),
            Some(GitRemoteSettings {
                enabled: true,
                url: Some("u".into()),
                provider: None,
            }),
        );
        st.mark_push_pending();
        let g = st.inner.lock().unwrap();
        assert!(g.push_pending);
        assert!(g.push_queued_at.is_some());
    }

    #[test]
    fn finish_op_records_timestamps_and_clears_inflight() {
        let st = RemoteState::default();
        {
            let mut g = st.inner.lock().unwrap();
            g.in_flight = true;
            g.status = SyncStatus::Syncing;
        }
        finish_op(&st.inner, Ok(()), OpKind::Push);
        let g = st.inner.lock().unwrap();
        assert!(!g.in_flight);
        assert_eq!(g.status, SyncStatus::Idle);
        assert!(g.last_push.is_some());
        assert!(g.last_error.is_none());
    }

    #[test]
    fn finish_op_records_error() {
        let st = RemoteState::default();
        {
            let mut g = st.inner.lock().unwrap();
            g.in_flight = true;
        }
        finish_op(&st.inner, Err("nope".into()), OpKind::Pull);
        let g = st.inner.lock().unwrap();
        assert!(!g.in_flight);
        assert_eq!(g.status, SyncStatus::Error);
        assert_eq!(g.last_error.as_deref(), Some("nope"));
    }

    fn run(dir: &Path, args: &[&str]) -> std::process::Output {
        Command::new("git")
            .current_dir(dir)
            .args(args)
            .output()
            .expect("git ran")
    }

    fn init_repo(dir: &Path) {
        let _ = std::fs::create_dir_all(dir);
        run(
            dir,
            &["-c", "init.defaultBranch=main", "init"],
        );
        run(dir, &["config", "user.email", "test@noxe.dev"]);
        run(dir, &["config", "user.name", "Noxe Test"]);
    }

    #[test]
    fn conflict_copy_preserves_both_versions() {
        if !super::super::git_available() {
            eprintln!("skipping: git not available");
            return;
        }
        let tmp = tempfile::tempdir().unwrap();
        let bare = tmp.path().join("origin.git");
        let alice = tmp.path().join("alice");
        let bob = tmp.path().join("bob");

        // Bare origin
        Command::new("git")
            .args(["init", "--bare", &bare.to_string_lossy()])
            .output()
            .unwrap();

        // Alice creates the file and pushes
        init_repo(&alice);
        std::fs::write(alice.join("Note.md"), "alice line\n").unwrap();
        run(&alice, &["add", "."]);
        run(&alice, &["commit", "-m", "alice initial"]);
        run(&alice, &["branch", "-M", "main"]);
        run(
            &alice,
            &["remote", "add", "origin", &bare.to_string_lossy()],
        );
        run(&alice, &["push", "-u", "origin", "main"]);

        // Bob clones, edits same line, pushes
        Command::new("git")
            .args([
                "clone",
                &bare.to_string_lossy(),
                &bob.to_string_lossy(),
            ])
            .output()
            .unwrap();
        run(&bob, &["config", "user.email", "bob@noxe.dev"]);
        run(&bob, &["config", "user.name", "Bob"]);
        std::fs::write(bob.join("Note.md"), "bob line\n").unwrap();
        run(&bob, &["add", "."]);
        run(&bob, &["commit", "-m", "bob change"]);
        run(&bob, &["push", "origin", "main"]);

        // Alice diverges (conflicting edit) and runs pull_with_conflict_copy
        std::fs::write(alice.join("Note.md"), "alice change\n").unwrap();
        run(&alice, &["add", "."]);
        run(&alice, &["commit", "-m", "alice change"]);

        let outcome = pull_with_conflict_copy(&alice).expect("pull ok");
        match outcome {
            PullOutcome::ConflictCopied(paths) => {
                assert_eq!(paths.len(), 1);
                assert_eq!(paths[0], PathBuf::from("Note.md"));
            }
            other => panic!("expected ConflictCopied, got {:?}", other),
        }

        // Local file should still be alice's version
        let local = std::fs::read_to_string(alice.join("Note.md")).unwrap();
        assert_eq!(local.trim(), "alice change");

        // A conflict-copy file should exist with bob's content
        let entries: Vec<_> = std::fs::read_dir(&alice)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().to_string())
            .filter(|n| n.starts_with("Note (conflict from "))
            .collect();
        assert_eq!(entries.len(), 1, "expected one conflict copy");
        let copy_content =
            std::fs::read_to_string(alice.join(&entries[0])).unwrap();
        assert_eq!(copy_content.trim(), "bob line");
    }

    #[test]
    fn clean_pull_returns_merged() {
        if !super::super::git_available() {
            return;
        }
        let tmp = tempfile::tempdir().unwrap();
        let bare = tmp.path().join("origin.git");
        let alice = tmp.path().join("alice");
        let bob = tmp.path().join("bob");
        Command::new("git")
            .args(["init", "--bare", &bare.to_string_lossy()])
            .output()
            .unwrap();
        init_repo(&alice);
        std::fs::write(alice.join("a.md"), "a\n").unwrap();
        run(&alice, &["add", "."]);
        run(&alice, &["commit", "-m", "a"]);
        run(&alice, &["branch", "-M", "main"]);
        run(
            &alice,
            &["remote", "add", "origin", &bare.to_string_lossy()],
        );
        run(&alice, &["push", "-u", "origin", "main"]);

        Command::new("git")
            .args([
                "clone",
                &bare.to_string_lossy(),
                &bob.to_string_lossy(),
            ])
            .output()
            .unwrap();
        run(&bob, &["config", "user.email", "b@b"]);
        run(&bob, &["config", "user.name", "Bob"]);
        std::fs::write(bob.join("b.md"), "b\n").unwrap();
        run(&bob, &["add", "."]);
        run(&bob, &["commit", "-m", "b"]);
        run(&bob, &["push", "origin", "main"]);

        // Alice pulls — should fast-forward (no diverging local commits)
        let outcome = pull_with_conflict_copy(&alice).expect("pull ok");
        assert!(matches!(outcome, PullOutcome::Merged));
        assert!(alice.join("b.md").exists());
    }
}
