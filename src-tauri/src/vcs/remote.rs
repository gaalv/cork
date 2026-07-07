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
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::vault::settings::{load_vault_settings, save_vault_settings, GitRemoteSettings};
use crate::vault::{VaultPath, VaultState};
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
    /// GitHub remote URL. Supports SSH (`git@github.com:owner/repo.git`) and
    /// HTTPS (`https://github.com/owner/repo.git`).
    pub url: Option<String>,
    /// Fine-grained GitHub PAT for HTTPS remotes. Stored only in the local
    /// git credential store under `.git/`, never in vault settings.
    pub token: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneRemoteInput {
    /// GitHub HTTPS remote URL, e.g. `https://github.com/owner/repo.git`.
    pub url: String,
    /// Fine-grained GitHub PAT scoped to this repository.
    pub token: String,
    /// Parent folder where Cork should create the cloned vault folder.
    /// If omitted, the native folder picker asks the user.
    pub parent_path: Option<PathBuf>,
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
        inner.status = SyncStatus::Idle;
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
    if state.workers_started.swap(true, Ordering::SeqCst) {
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
            let pull_ok = outcome.is_ok();
            finish_op(&inner, outcome.map(|_| ()).map_err(|e| e), OpKind::Pull);
            // Always queue a push attempt after a successful pull. `git_push`
            // is idempotent — it sweeps `git add -A`, commits if anything
            // changed, and no-ops if there's nothing to send. This catches
            // changes that don't go through `on_note_saved` (folder ops,
            // deletions, todos.json, settings, …).
            if pull_ok {
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
            let user = rest
                .split_whitespace()
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
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
        // hang forever. We supply auth via a repo-local credential store or SSH.
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_ASKPASS", "")
        .env("SSH_ASKPASS", "")
        .args(args)
        .output()
        .map_err(|e| e.to_string())
}

/// Like `run_git` but for remote operations (push, fetch, clone).
/// When the vault uses HTTPS auth, injects `-c credential.*` overrides so the
/// macOS Keychain and any global credential helpers are fully bypassed.
fn run_git_remote(vault_root: &Path, args: &[&str]) -> Result<Output, String> {
    let cred_path = https_credential_store_path(vault_root);
    let mut cmd = Command::new("git");
    cmd.current_dir(vault_root)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_ASKPASS", "")
        .env("SSH_ASKPASS", "");

    if cred_path.exists() {
        let helper = format!(
            "store --file {}",
            shell_single_quote(&cred_path.to_string_lossy())
        );
        // Empty string resets the credential helper chain, then we add ours
        cmd.arg("-c").arg("credential.helper=")
            .arg("-c").arg(format!("credential.helper={helper}"))
            .arg("-c").arg("credential.useHttpPath=true");
    }

    cmd.args(args).output().map_err(|e| e.to_string())
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

// ── SSH deploy key support ───────────────────────────────────────────────────

/// Per-vault SSH key paths. We keep the keypair under `.cork/` so each
/// vault has its own isolated identity that never touches `~/.ssh/`.
fn deploy_key_priv_path(vault_root: &Path) -> PathBuf {
    vault_root.join(".cork").join("sync-key")
}

fn deploy_key_pub_path(vault_root: &Path) -> PathBuf {
    vault_root.join(".cork").join("sync-key.pub")
}

fn deploy_known_hosts_path(vault_root: &Path) -> PathBuf {
    vault_root.join(".cork").join("known_hosts")
}

/// True if a deploy keypair has already been generated for this vault.
fn has_deploy_key(vault_root: &Path) -> bool {
    deploy_key_priv_path(vault_root).exists() && deploy_key_pub_path(vault_root).exists()
}

/// Make sure `.gitignore` excludes the deploy key files. We never want
/// to push the private key to the remote.
fn ensure_gitignore_excludes_deploy_key(vault_root: &Path) -> std::io::Result<()> {
    use std::io::{Read, Write};
    let path = vault_root.join(".gitignore");
    let mut existing = String::new();
    if path.exists() {
        std::fs::OpenOptions::new()
            .read(true)
            .open(&path)?
            .read_to_string(&mut existing)?;
    }
    let needed = [".cork/sync-key", ".cork/sync-key.pub", ".cork/known_hosts"];
    let mut added = false;
    for line in needed {
        let present = existing.lines().any(|l| l.trim() == line);
        if !present {
            if !existing.is_empty() && !existing.ends_with('\n') {
                existing.push('\n');
            }
            existing.push_str(line);
            existing.push('\n');
            added = true;
        }
    }
    if added {
        let mut f = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&path)?;
        f.write_all(existing.as_bytes())?;
    }
    Ok(())
}

/// Generate a fresh ed25519 keypair under `.cork/` if none exists.
/// Returns the path to the public key file.
fn ensure_deploy_key(vault_root: &Path) -> Result<(), String> {
    let priv_path = deploy_key_priv_path(vault_root);
    let pub_path = deploy_key_pub_path(vault_root);
    if priv_path.exists() && pub_path.exists() {
        return Ok(());
    }

    // Make sure .cork exists.
    std::fs::create_dir_all(vault_root.join(".cork"))
        .map_err(|e| format!("could not create .cork/: {e}"))?;

    // Stale half-state: clean up so ssh-keygen doesn't refuse to overwrite.
    let _ = std::fs::remove_file(&priv_path);
    let _ = std::fs::remove_file(&pub_path);

    let host = hostname();
    let comment = format!("cork-vault@{host}");

    let priv_str = priv_path
        .to_str()
        .ok_or_else(|| "deploy key path is not valid UTF-8".to_string())?;

    let out = Command::new("ssh-keygen")
        .args([
            "-t", "ed25519", "-f", priv_str, "-N",
            "", // empty passphrase — we cannot prompt
            "-C", &comment,
        ])
        .output()
        .map_err(|e| format!("ssh-keygen not available ({e}). Install OpenSSH and try again."))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(format!(
            "ssh-keygen failed: {}",
            if stderr.is_empty() {
                "non-zero exit".into()
            } else {
                stderr
            }
        ));
    }

    // Tighten permissions — ssh-keygen usually does this but be explicit.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = std::fs::metadata(&priv_path) {
            let mut perms = meta.permissions();
            perms.set_mode(0o600);
            let _ = std::fs::set_permissions(&priv_path, perms);
        }
    }

    let _ = ensure_gitignore_excludes_deploy_key(vault_root);
    Ok(())
}

/// Read the public key as a single-line string suitable for pasting
/// into a GitHub Deploy Key field.
fn read_deploy_pub_key(vault_root: &Path) -> Result<String, String> {
    let pub_path = deploy_key_pub_path(vault_root);
    let content = std::fs::read_to_string(&pub_path)
        .map_err(|e| format!("could not read deploy public key: {e}"))?;
    Ok(content.trim().to_string())
}

/// Compute a short fingerprint for display in the UI.
fn deploy_key_fingerprint(vault_root: &Path) -> Option<String> {
    let priv_path = deploy_key_priv_path(vault_root);
    let priv_str = priv_path.to_str()?;
    let out = Command::new("ssh-keygen")
        .args(["-lf", priv_str, "-E", "sha256"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let line = String::from_utf8_lossy(&out.stdout).trim().to_string();
    // Output looks like: "256 SHA256:abc... cork@host (ED25519)"
    line.split_whitespace().nth(1).map(|s| s.to_string())
}

/// True if the given URL is an SSH-style git remote (e.g.
/// `git@github.com:user/repo.git` or `ssh://git@github.com/user/repo.git`).
fn is_ssh_url(url: &str) -> bool {
    let u = url.trim();
    u.starts_with("git@") || u.starts_with("ssh://")
}

fn normalize_github_https_url(url: &str) -> Result<String, String> {
    let trimmed = url.trim().trim_end_matches('/');
    let rest = if let Some(rest) = trimmed.strip_prefix("https://github.com/") {
        rest
    } else if let Some(rest) = trimmed.strip_prefix("http://github.com/") {
        rest
    } else {
        return Err(
            "Use a GitHub HTTPS URL in the form https://github.com/owner/repo.git".to_string(),
        );
    };
    let parts: Vec<&str> = rest.split('/').collect();
    if parts.len() != 2 {
        return Err(
            "Use a GitHub HTTPS URL in the form https://github.com/owner/repo.git".to_string(),
        );
    }
    let owner = parts[0];
    let repo = parts[1].strip_suffix(".git").unwrap_or(parts[1]);
    if !is_safe_github_path_part(owner) || !is_safe_github_path_part(repo) {
        return Err("GitHub owner/repo contains unsupported characters".to_string());
    }
    Ok(format!("https://github.com/{owner}/{repo}.git"))
}

fn repo_name_from_github_https_url(url: &str) -> Result<String, String> {
    let normalized = normalize_github_https_url(url)?;
    let rest = normalized
        .strip_prefix("https://github.com/")
        .ok_or_else(|| "expected normalized GitHub HTTPS URL".to_string())?;
    let repo = rest
        .split('/')
        .nth(1)
        .and_then(|part| part.strip_suffix(".git"))
        .ok_or_else(|| "could not derive repository name from GitHub URL".to_string())?;
    Ok(repo.to_string())
}

fn is_safe_github_path_part(part: &str) -> bool {
    !part.is_empty()
        && !part
            .chars()
            .any(|c| c.is_whitespace() || matches!(c, '?' | '#' | ':' | '@' | '\\'))
}

fn https_credential_store_path(vault_root: &Path) -> PathBuf {
    vault_root.join(".git").join("cork-credentials")
}

fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn percent_encode_userinfo(value: &str) -> String {
    let mut encoded = String::new();
    for b in value.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                encoded.push(b as char);
            }
            _ => encoded.push_str(&format!("%{b:02X}")),
        }
    }
    encoded
}

fn github_https_credential_line(url: &str, token: &str) -> Result<String, String> {
    let rest = url
        .strip_prefix("https://github.com/")
        .ok_or_else(|| "expected normalized GitHub HTTPS URL".to_string())?;
    let encoded_token = percent_encode_userinfo(token);
    Ok(format!(
        "https://x-access-token:{encoded_token}@github.com/{rest}\n"
    ))
}

fn clear_https_auth(vault_root: &Path) {
    let _ = run_git(
        vault_root,
        &["config", "--local", "--unset-all", "credential.helper"],
    );
    let _ = run_git(
        vault_root,
        &[
            "config",
            "--local",
            "--unset-all",
            "credential.https://github.com.helper",
        ],
    );
    let _ = run_git(
        vault_root,
        &["config", "--local", "--unset", "credential.useHttpPath"],
    );
    let _ = run_git(
        vault_root,
        &[
            "config",
            "--local",
            "--remove-section",
            "http.https://github.com/",
        ],
    );
    let _ = std::fs::remove_file(https_credential_store_path(vault_root));
}

fn clear_ssh_auth(vault_root: &Path) {
    let _ = run_git(
        vault_root,
        &["config", "--local", "--unset", "core.sshCommand"],
    );
}

fn configure_https_auth(vault_root: &Path, url: &str, token: &str) -> Result<(), String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("HTTPS sync requires a fine-grained GitHub personal access token".to_string());
    }
    if token.chars().any(char::is_control) {
        return Err("GitHub token contains unsupported control characters".to_string());
    }

    clear_https_auth(vault_root);
    clear_ssh_auth(vault_root);

    run_git_check(
        vault_root,
        &["config", "--local", "--add", "credential.helper", ""],
    )?;
    let credential_path = https_credential_store_path(vault_root);
    let helper = format!(
        "store --file {}",
        shell_single_quote(&credential_path.to_string_lossy())
    );
    run_git_check(
        vault_root,
        &["config", "--local", "--add", "credential.helper", &helper],
    )?;
    run_git_check(
        vault_root,
        &["config", "--local", "credential.useHttpPath", "true"],
    )?;

    let line = github_https_credential_line(url, token)?;
    std::fs::write(&credential_path, line)
        .map_err(|e| format!("could not write local GitHub credentials: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = std::fs::metadata(&credential_path) {
            let mut perms = meta.permissions();
            perms.set_mode(0o600);
            let _ = std::fs::set_permissions(&credential_path, perms);
        }
    }
    Ok(())
}

fn write_https_credential_file(path: &Path, url: &str, token: &str) -> Result<(), String> {
    let line = github_https_credential_line(url, token)?;
    std::fs::write(path, line).map_err(|e| format!("could not write GitHub credentials: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = std::fs::metadata(path) {
            let mut perms = meta.permissions();
            perms.set_mode(0o600);
            let _ = std::fs::set_permissions(path, perms);
        }
    }
    Ok(())
}

fn ensure_local_git_identity(vault_root: &Path) -> Result<(), String> {
    let has_name = run_git(vault_root, &["config", "--local", "user.name"])
        .map(|o| o.status.success() && !o.stdout.is_empty())
        .unwrap_or(false);
    if !has_name {
        run_git_check(vault_root, &["config", "--local", "user.name", "Cork"])?;
    }

    let has_email = run_git(vault_root, &["config", "--local", "user.email"])
        .map(|o| o.status.success() && !o.stdout.is_empty())
        .unwrap_or(false);
    if !has_email {
        run_git_check(
            vault_root,
            &["config", "--local", "user.email", "cork@local"],
        )?;
    }

    Ok(())
}

fn redact_secret(message: &str, secret: &str) -> String {
    if secret.is_empty() {
        return message.to_string();
    }
    message
        .replace(secret, "<redacted>")
        .replace(&percent_encode_userinfo(secret), "<redacted>")
}

/// Build the value of `core.sshCommand` so that git uses ONLY our deploy
/// key for this vault. We force-disable the ssh-agent (which on macOS
/// often has the user's enterprise key) and ignore `~/.ssh/config`
/// entirely.
///
/// When `port_443` is true, the command also rewrites the hostname to
/// `ssh.github.com:443` — GitHub's officially supported SSH-over-HTTPS
/// endpoint, used when corporate firewalls block port 22.
fn build_ssh_command(vault_root: &Path, port_443: bool) -> String {
    let priv_path = deploy_key_priv_path(vault_root);
    let known_hosts = deploy_known_hosts_path(vault_root);
    // Quote each path with single quotes so spaces in the vault path
    // don't break the command. macOS git invokes this through /bin/sh.
    let base = format!(
        "ssh -i '{key}' -o IdentitiesOnly=yes -o IdentityAgent=none \
         -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile='{known}' \
         -F /dev/null",
        key = priv_path.display(),
        known = known_hosts.display(),
    );
    if port_443 {
        // -o Hostname rewrites the target host of every connection made
        // by this ssh invocation, and -p forces the port. Together they
        // route github.com traffic through ssh.github.com:443.
        format!("{base} -o Hostname=ssh.github.com -p 443")
    } else {
        base
    }
}

/// True if the stderr from a failed `git push` over SSH looks like a
/// port-22 / outbound-network problem (firewall, proxy, sandbox) and
/// therefore retrying via `ssh.github.com:443` might help.
fn looks_like_port_22_block(stderr: &str) -> bool {
    let s = stderr.to_lowercase();
    s.contains("port 22")
        || s.contains("bad file descriptor")
        || s.contains("connection timed out")
        || s.contains("connection refused")
        || s.contains("network is unreachable")
        || s.contains("operation timed out")
        || s.contains("no route to host")
}

fn git_push(vault_root: &Path) -> Result<(), String> {
    let _ = append_log(vault_root, "[push] start");
    // Sweep up any changes not yet captured by the per-note debounced commit
    // (folder create/rename/delete, note delete/rename/move, todos.json,
    // settings, etc.). `git commit` returns non-zero when there is nothing
    // to commit — that's fine.
    let _ = run_git(vault_root, &["add", "-A"]);
    let (subject, body) = build_sweep_commit_message(vault_root);
    let _ = run_git(
        vault_root,
        &[
            "commit",
            "-m",
            &subject,
            "-m",
            &body,
            "--author=Cork <cork@local>",
        ],
    );
    let out = run_git_remote(vault_root, &["push", "origin", "HEAD"]);
    let _ = append_log(
        vault_root,
        &match &out {
            Ok(o) if o.status.success() => {
                format!("[push] ok\n{}", String::from_utf8_lossy(&o.stdout))
            }
            Ok(o) => format!(
                "[push] error: {}",
                String::from_utf8_lossy(&o.stderr).trim()
            ),
            Err(err) => format!("[push] error: {err}"),
        },
    );
    match out {
        Ok(o) if o.status.success() => Ok(()),
        Ok(o) => Err(format!(
            "git push failed: {}",
            String::from_utf8_lossy(&o.stderr).trim()
        )),
        Err(e) => Err(e),
    }
}

/// Inspect the staged index and produce a Conventional-Commits style message
/// that summarises what's about to be committed.
///
/// Subject pattern: `sync(<scope>): <summary>` where `<scope>` is one of
/// `single`, `notes`, `mixed`, `empty`. The body lists up to `MAX_LISTED`
/// changed files (with status code) plus a totals line and a timestamp,
/// so commits remain useful in `git log` and the in-app history view.
fn build_sweep_commit_message(vault_root: &Path) -> (String, String) {
    const MAX_LISTED: usize = 25;

    let staged = run_git(vault_root, &["diff", "--cached", "--name-status", "-z"])
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
        .unwrap_or_default();

    let mut entries: Vec<(char, String)> = Vec::new();
    let mut iter = staged.split('\0').filter(|s| !s.is_empty());
    while let Some(token) = iter.next() {
        // With `--name-status -z`, each record is laid out as:
        //   normal:  "<status>\0<path>\0"            (status is "A" | "M" | "D" | "T" | "U")
        //   rename:  "R<score>\0<oldpath>\0<newpath>\0"
        //   copy:    "C<score>\0<oldpath>\0<newpath>\0"
        let first = match token.chars().next() {
            Some(c) => c,
            None => continue,
        };
        if first == 'R' || first == 'C' {
            let _old = iter.next().unwrap_or("");
            let new = iter.next().unwrap_or("");
            if !new.is_empty() {
                entries.push((first, new.to_string()));
            }
        } else {
            let path = iter.next().unwrap_or("");
            if !path.is_empty() {
                entries.push((first, path.to_string()));
            }
        }
    }

    let total = entries.len();
    let timestamp = chrono::Utc::now().to_rfc3339();

    if total == 0 {
        return (
            "sync(empty): no changes".to_string(),
            format!("Timestamp: {timestamp}\n\nSource: cork-app"),
        );
    }

    let added = entries.iter().filter(|(s, _)| *s == 'A').count();
    let modified = entries.iter().filter(|(s, _)| *s == 'M').count();
    let deleted = entries.iter().filter(|(s, _)| *s == 'D').count();
    let renamed = entries.iter().filter(|(s, _)| *s == 'R').count();
    let other = total - added - modified - deleted - renamed;

    let only_notes = entries
        .iter()
        .all(|(_, p)| p.ends_with(".md") || p.ends_with(".markdown"));

    let scope = if total == 1 {
        "single"
    } else if only_notes {
        "notes"
    } else {
        "mixed"
    };

    let subject = if total == 1 {
        let (status, path) = &entries[0];
        let verb = match status {
            'A' => "add",
            'D' => "delete",
            'M' => "update",
            'R' => "rename",
            'C' => "copy",
            _ => "change",
        };
        format!("sync({scope}): {verb} {path}")
    } else {
        let mut parts: Vec<String> = Vec::new();
        if added > 0 {
            parts.push(format!("+{added}"));
        }
        if modified > 0 {
            parts.push(format!("~{modified}"));
        }
        if deleted > 0 {
            parts.push(format!("-{deleted}"));
        }
        if renamed > 0 {
            parts.push(format!("→{renamed}"));
        }
        if other > 0 {
            parts.push(format!("?{other}"));
        }
        let stats = parts.join(" ");
        format!("sync({scope}): {total} change(s) [{stats}]")
    };

    let mut body = format!("Timestamp: {timestamp}\nFiles ({total}):\n");
    for (status, path) in entries.iter().take(MAX_LISTED) {
        body.push_str(&format!("  {status}  {path}\n"));
    }
    if total > MAX_LISTED {
        body.push_str(&format!("  … and {} more\n", total - MAX_LISTED));
    }
    body.push_str("\nSource: cork-app");

    (subject, body)
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
    let fetch_out = run_git_remote(vault_root, &["fetch", "origin"])?;
    if !fetch_out.status.success() {
        return Err(String::from_utf8_lossy(&fetch_out.stderr)
            .trim()
            .to_string());
    }

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
    let conflicted_raw = run_git_check(vault_root, &["diff", "--name-only", "--diff-filter=U"])?;
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
            "--author=Cork <cork@local>",
        ],
    )?;
    let _ = append_log(
        vault_root,
        &format!("[pull] resolved {} conflicts via copy", conflicted.len()),
    );
    Ok(PullOutcome::ConflictCopied(conflicted))
}

fn local_is_ahead(vault_root: &Path) -> bool {
    run_git_check(vault_root, &["rev-list", "--count", "@{u}..HEAD"])
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
    let dir = vault_root.join(".cork");
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
pub async fn vcs_remote_clone(
    app: AppHandle,
    input: CloneRemoteInput,
) -> Result<VaultPath, IpcError> {
    if !super::git_available() {
        return Err(IpcError::Other("git is not available".into()));
    }

    let parent_path = match input.parent_path.clone() {
        Some(path) => path,
        None => {
            let (tx, rx) = std::sync::mpsc::channel();
            app.dialog().file().pick_folder(move |folder| {
                let _ = tx.send(folder);
            });
            let folder = tauri::async_runtime::spawn_blocking(move || rx.recv())
                .await
                .map_err(|err| IpcError::Other(err.to_string()))?
                .map_err(|err| IpcError::Other(err.to_string()))?
                .ok_or_else(|| IpcError::Other("folder selection cancelled".to_string()))?;
            folder
                .into_path()
                .map_err(|err| IpcError::Io(err.to_string()))?
        }
    };

    let cloned_path =
        tauri::async_runtime::spawn_blocking(move || clone_remote_blocking(&parent_path, input))
            .await
            .map_err(|e| IpcError::Other(format!("background task failed: {e}")))??;

    Ok(VaultPath { path: cloned_path })
}

fn clone_remote_blocking(parent_path: &Path, input: CloneRemoteInput) -> Result<PathBuf, IpcError> {
    let parent = parent_path
        .canonicalize()
        .map_err(|e| IpcError::Io(format!("clone parent folder is not available: {e}")))?;
    if !parent.is_dir() {
        return Err(IpcError::NotFound);
    }

    let url = normalize_github_https_url(&input.url).map_err(IpcError::Other)?;
    let token = input.token.trim();
    if token.is_empty() {
        return Err(IpcError::Other(
            "HTTPS clone requires a fine-grained GitHub personal access token".into(),
        ));
    }
    if token.chars().any(char::is_control) {
        return Err(IpcError::Other(
            "GitHub token contains unsupported control characters".into(),
        ));
    }

    let repo_name = repo_name_from_github_https_url(&url).map_err(IpcError::Other)?;
    let destination = parent.join(repo_name);
    if destination.exists() {
        return Err(IpcError::Other(format!(
            "destination already exists: {}",
            destination.display()
        )));
    }

    let credential_file = tempfile::NamedTempFile::new()
        .map_err(|e| IpcError::Io(format!("could not create temporary credential file: {e}")))?;
    write_https_credential_file(credential_file.path(), &url, token).map_err(IpcError::Other)?;
    let helper = format!(
        "store --file {}",
        shell_single_quote(&credential_file.path().to_string_lossy())
    );
    let helper_config = format!("credential.helper={helper}");

    let clone_out = Command::new("git")
        .current_dir(&parent)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_ASKPASS", "")
        .env("SSH_ASKPASS", "")
        .arg("-c")
        .arg("credential.helper=")
        .arg("-c")
        .arg(&helper_config)
        .arg("-c")
        .arg("credential.useHttpPath=true")
        .arg("clone")
        .arg("--origin")
        .arg("origin")
        .arg(&url)
        .arg(&destination)
        .output()
        .map_err(|e| IpcError::Other(e.to_string()))?;

    if !clone_out.status.success() {
        let _ = std::fs::remove_dir_all(&destination);
        let stderr = redact_secret(String::from_utf8_lossy(&clone_out.stderr).trim(), token);
        let stdout = redact_secret(String::from_utf8_lossy(&clone_out.stdout).trim(), token);
        let mut msg = "git clone (https) failed".to_string();
        if !stderr.is_empty() {
            msg.push_str(": ");
            msg.push_str(&stderr);
        }
        if !stdout.is_empty() {
            msg.push_str(" | ");
            msg.push_str(&stdout);
        }
        let lower = format!("{stderr} {stdout}").to_lowercase();
        if lower.contains("authentication failed")
            || lower.contains("403")
            || lower.contains("401")
            || lower.contains("permission")
        {
            msg.push_str(
                "\nHint: verify that the fine-grained PAT has Contents: Read and write \
                 for this repository and that any organization approval is complete.",
            );
        } else if lower.contains("repository not found") || lower.contains("not found") {
            msg.push_str(
                "\nHint: check the repository URL and token access. Private repos return \
                 \"not found\" when the token cannot see them.",
            );
        }
        return Err(IpcError::Other(msg));
    }

    run_git_check(&destination, &["remote", "set-url", "origin", &url]).map_err(IpcError::Other)?;
    configure_https_auth(&destination, &url, token).map_err(IpcError::Other)?;
    ensure_local_git_identity(&destination).map_err(IpcError::Other)?;

    let mut settings = load_vault_settings(&destination)?;
    settings.git_remote = Some(GitRemoteSettings {
        enabled: true,
        url: Some(url),
        provider: Some("github".to_string()),
    });
    save_vault_settings(&destination, &settings)?;

    destination
        .canonicalize()
        .map_err(|e| IpcError::Io(format!("could not resolve cloned vault path: {e}")))
}

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

fn enable_remote_blocking(vault_root: &Path, input: EnableRemoteInput) -> Result<String, IpcError> {
    let url = input
        .url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            IpcError::Other(
                "Missing repository URL. Use https://github.com/owner/repo.git \
                 or git@github.com:owner/repo.git"
                    .into(),
            )
        })?
        .to_string();

    if is_ssh_url(&url) {
        enable_ssh_remote_blocking(vault_root, &url)?;
        return Ok(url);
    }

    let normalized_url = normalize_github_https_url(&url).map_err(IpcError::Other)?;
    let token = input
        .token
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            IpcError::Other(
                "HTTPS sync requires a fine-grained GitHub personal access token".into(),
            )
        })?;
    enable_https_remote_blocking(vault_root, &normalized_url, token)?;
    Ok(normalized_url)
}

fn ensure_head_exists(vault_root: &Path) {
    let has_head = run_git(vault_root, &["rev-parse", "HEAD"])
        .map(|o| o.status.success())
        .unwrap_or(false);
    if has_head {
        return;
    }
    let _ = run_git(vault_root, &["add", "-A"]);
    let _ = run_git(
        vault_root,
        &[
            "commit",
            "--allow-empty",
            "-m",
            "Initial commit",
            "--author=Cork <cork@local>",
        ],
    );
}

fn enable_https_remote_blocking(vault_root: &Path, url: &str, token: &str) -> Result<(), IpcError> {
    let _ = run_git(vault_root, &["remote", "remove", "origin"]);
    run_git_check(vault_root, &["remote", "add", "origin", url]).map_err(IpcError::Other)?;
    configure_https_auth(vault_root, url, token).map_err(|err| {
        let _ = run_git(vault_root, &["remote", "remove", "origin"]);
        IpcError::Other(err)
    })?;
    ensure_head_exists(vault_root);

    let push_out =
        run_git_remote(vault_root, &["push", "-u", "origin", "HEAD"]).map_err(IpcError::Other)?;
    if !push_out.status.success() {
        let stderr = redact_secret(String::from_utf8_lossy(&push_out.stderr).trim(), token);
        let stdout = redact_secret(String::from_utf8_lossy(&push_out.stdout).trim(), token);
        let mut msg = "git push (https) failed".to_string();
        if !stderr.is_empty() {
            msg.push_str(": ");
            msg.push_str(&stderr);
        }
        if !stdout.is_empty() {
            msg.push_str(" | ");
            msg.push_str(&stdout);
        }
        let lower = format!("{stderr} {stdout}").to_lowercase();
        if lower.contains("authentication failed")
            || lower.contains("403")
            || lower.contains("401")
            || lower.contains("permission")
        {
            msg.push_str(
                "\nHint: verify that the fine-grained PAT has Contents: Read and write \
                 for this repository and that any organization approval is complete.",
            );
        } else if lower.contains("repository not found") || lower.contains("not found") {
            msg.push_str(
                "\nHint: check the repository URL and token access. Private repos return \
                 \"not found\" when the token cannot see them.",
            );
        }
        clear_https_auth(vault_root);
        let _ = run_git(vault_root, &["remote", "remove", "origin"]);
        return Err(IpcError::Other(msg));
    }
    Ok(())
}

fn enable_ssh_remote_blocking(vault_root: &Path, url: &str) -> Result<(), IpcError> {
    if !has_deploy_key(vault_root) {
        return Err(IpcError::Other(
            "Deploy key not generated yet. Click \"Generate deploy key\" first, \
             paste the public key into the repo's Deploy Keys (with write \
             access), then Connect."
                .into(),
        ));
    }

    let _ = run_git(vault_root, &["remote", "remove", "origin"]);
    run_git_check(vault_root, &["remote", "add", "origin", url]).map_err(IpcError::Other)?;

    // Wipe any HTTPS auth state from a previous attempt so nothing competes
    // with our SSH command.
    clear_https_auth(vault_root);

    // Pin core.sshCommand so git uses ONLY our deploy key. Start with
    // port 22; if push fails with a network-block signature we retry
    // with ssh.github.com:443 and persist that command for future ops.
    let ssh_cmd_22 = build_ssh_command(vault_root, false);
    run_git_check(
        vault_root,
        &["config", "--local", "core.sshCommand", &ssh_cmd_22],
    )
    .map_err(IpcError::Other)?;

    ensure_head_exists(vault_root);

    let mut push_out =
        run_git(vault_root, &["push", "-u", "origin", "HEAD"]).map_err(IpcError::Other)?;
    let mut tried_443 = false;
    if !push_out.status.success() {
        let stderr = String::from_utf8_lossy(&push_out.stderr).to_string();
        if looks_like_port_22_block(&stderr) {
            tried_443 = true;
            let ssh_cmd_443 = build_ssh_command(vault_root, true);
            run_git_check(
                vault_root,
                &["config", "--local", "core.sshCommand", &ssh_cmd_443],
            )
            .map_err(IpcError::Other)?;
            push_out =
                run_git(vault_root, &["push", "-u", "origin", "HEAD"]).map_err(IpcError::Other)?;
            if !push_out.status.success() {
                let _ = run_git(
                    vault_root,
                    &["config", "--local", "core.sshCommand", &ssh_cmd_22],
                );
            }
        }
    }
    if !push_out.status.success() {
        let stderr = String::from_utf8_lossy(&push_out.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&push_out.stdout).trim().to_string();
        let mut msg = if tried_443 {
            "git push (ssh) failed on both port 22 and port 443"
        } else {
            "git push (ssh) failed"
        }
        .to_string();
        if !stderr.is_empty() {
            msg.push_str(": ");
            msg.push_str(&stderr);
        }
        if !stdout.is_empty() {
            msg.push_str(" | ");
            msg.push_str(&stdout);
        }
        let lower = format!("{stderr} {stdout}").to_lowercase();
        if lower.contains("permission denied") || lower.contains("publickey") {
            msg.push_str(
                "\nHint: the deploy key wasn't accepted. On the repo page → \
                 Settings → Deploy keys → Add deploy key, paste the PUBLIC \
                 key shown above and check \"Allow write access\".",
            );
        } else if lower.contains("repository not found") || lower.contains("does not exist") {
            msg.push_str(
                "\nHint: the SSH URL is wrong. Use \
                 git@github.com:owner/repo.git (no https://).",
            );
        } else if looks_like_port_22_block(&lower) {
            msg.push_str(
                "\nHint: outbound SSH appears to be blocked from this machine \
                 (corporate firewall or VPN). We tried both port 22 and \
                 ssh.github.com:443 and neither connected. Try disconnecting \
                 the VPN or switch to HTTPS + PAT.",
            );
        }
        return Err(IpcError::Other(msg));
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeployKeyInfo {
    pub public_key: String,
    pub fingerprint: Option<String>,
    pub already_existed: bool,
}

/// Generate (or read) the per-vault SSH deploy key. Returns the public
/// key string the user must paste into the repo's Deploy Keys settings.
#[tauri::command]
pub async fn vcs_generate_deploy_key(
    vault_state: tauri::State<'_, VaultState>,
) -> Result<DeployKeyInfo, IpcError> {
    let vault_root = vault_state.current_path().ok_or(IpcError::NotFound)?;
    tauri::async_runtime::spawn_blocking(move || -> Result<DeployKeyInfo, IpcError> {
        super::git_init_if_needed(&vault_root).map_err(IpcError::Other)?;
        let already_existed = has_deploy_key(&vault_root);
        if !already_existed {
            ensure_deploy_key(&vault_root).map_err(IpcError::Other)?;
        }
        let public_key = read_deploy_pub_key(&vault_root).map_err(IpcError::Other)?;
        let fingerprint = deploy_key_fingerprint(&vault_root);
        Ok(DeployKeyInfo {
            public_key,
            fingerprint,
            already_existed,
        })
    })
    .await
    .map_err(|e| IpcError::Other(format!("background task failed: {e}")))?
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
        clear_https_auth(&vault_root_for_blocking);
        clear_ssh_auth(&vault_root_for_blocking);
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
