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

/// Like [`run_git`] but completely isolates git from the user's global
/// gitconfig (`~/.gitconfig`, `~/.config/git/config`) and the system
/// gitconfig. Only the per-repo `.git/config` is honored. Use this for
/// PAT-authenticated push so no inherited credential helper, alias, or
/// http directive can interfere.
fn run_git_isolated(vault_root: &Path, args: &[&str]) -> Result<Output, String> {
    use std::time::SystemTime;

    let stamp = SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let isolated_home = std::env::temp_dir().join(format!("noxe-git-iso-{stamp}"));
    let _ = std::fs::create_dir_all(&isolated_home);

    let result = Command::new("git")
        .current_dir(vault_root)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_ASKPASS", "")
        .env("SSH_ASKPASS", "")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("HOME", &isolated_home)
        .env("XDG_CONFIG_HOME", &isolated_home)
        .args(args)
        .output()
        .map_err(|e| e.to_string());

    let _ = std::fs::remove_dir_all(&isolated_home);
    result
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

/// True when the per-repo .git/config has an extraheader override for
/// github.com — i.e. the repo was set up with a PAT and should be run
/// in an isolated $HOME so nothing from the user's global config can
/// override the inline auth.
fn repo_uses_pat_auth(vault_root: &Path) -> bool {
    run_git(
        vault_root,
        &[
            "config",
            "--local",
            "--get",
            "http.https://github.com/.extraheader",
        ],
    )
    .map(|o| o.status.success() && !o.stdout.is_empty())
    .unwrap_or(false)
}

fn run_git_auto(vault_root: &Path, args: &[&str]) -> Result<Output, String> {
    if repo_uses_pat_auth(vault_root) {
        run_git_isolated(vault_root, args)
    } else {
        run_git(vault_root, args)
    }
}

// ── SSH deploy key support ───────────────────────────────────────────────────

/// Per-vault SSH key paths. We keep the keypair under `.noxe/` so each
/// vault has its own isolated identity that never touches `~/.ssh/`.
fn deploy_key_priv_path(vault_root: &Path) -> PathBuf {
    vault_root.join(".noxe").join("sync-key")
}

fn deploy_key_pub_path(vault_root: &Path) -> PathBuf {
    vault_root.join(".noxe").join("sync-key.pub")
}

fn deploy_known_hosts_path(vault_root: &Path) -> PathBuf {
    vault_root.join(".noxe").join("known_hosts")
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
    let needed = [
        ".noxe/sync-key",
        ".noxe/sync-key.pub",
        ".noxe/known_hosts",
    ];
    let mut added = false;
    for line in needed {
        let present = existing
            .lines()
            .any(|l| l.trim() == line);
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

/// Generate a fresh ed25519 keypair under `.noxe/` if none exists.
/// Returns the path to the public key file.
fn ensure_deploy_key(vault_root: &Path) -> Result<(), String> {
    let priv_path = deploy_key_priv_path(vault_root);
    let pub_path = deploy_key_pub_path(vault_root);
    if priv_path.exists() && pub_path.exists() {
        return Ok(());
    }

    // Make sure .noxe exists.
    std::fs::create_dir_all(vault_root.join(".noxe"))
        .map_err(|e| format!("could not create .noxe/: {e}"))?;

    // Stale half-state: clean up so ssh-keygen doesn't refuse to overwrite.
    let _ = std::fs::remove_file(&priv_path);
    let _ = std::fs::remove_file(&pub_path);

    let host = hostname();
    let comment = format!("noxe-vault@{host}");

    let priv_str = priv_path
        .to_str()
        .ok_or_else(|| "deploy key path is not valid UTF-8".to_string())?;

    let out = Command::new("ssh-keygen")
        .args([
            "-t", "ed25519",
            "-f", priv_str,
            "-N", "", // empty passphrase — we cannot prompt
            "-C", &comment,
        ])
        .output()
        .map_err(|e| format!("ssh-keygen not available ({e}). Install OpenSSH and try again."))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(format!(
            "ssh-keygen failed: {}",
            if stderr.is_empty() { "non-zero exit".into() } else { stderr }
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
    // Output looks like: "256 SHA256:abc... noxe@host (ED25519)"
    line.split_whitespace().nth(1).map(|s| s.to_string())
}

/// True if the given URL is an SSH-style git remote (e.g.
/// `git@github.com:user/repo.git` or `ssh://git@github.com/user/repo.git`).
fn is_ssh_url(url: &str) -> bool {
    let u = url.trim();
    u.starts_with("git@") || u.starts_with("ssh://")
}

/// Build the value of `core.sshCommand` so that git uses ONLY our deploy
/// key for this vault. We force-disable the ssh-agent (which on macOS
/// often has the user's enterprise key) and ignore `~/.ssh/config`
/// entirely.
fn build_ssh_command(vault_root: &Path) -> String {
    let priv_path = deploy_key_priv_path(vault_root);
    let known_hosts = deploy_known_hosts_path(vault_root);
    // Quote each path with single quotes so spaces in the vault path
    // don't break the command. macOS git invokes this through /bin/sh.
    format!(
        "ssh -i '{key}' -o IdentitiesOnly=yes -o IdentityAgent=none \
         -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile='{known}' \
         -F /dev/null",
        key = priv_path.display(),
        known = known_hosts.display(),
    )
}

fn git_push(vault_root: &Path) -> Result<(), String> {
    let _ = append_log(vault_root, "[push] start");
    let out = run_git_auto(vault_root, &["push", "origin", "HEAD"]);
    let _ = append_log(
        vault_root,
        &match &out {
            Ok(o) if o.status.success() => format!(
                "[push] ok\n{}",
                String::from_utf8_lossy(&o.stdout)
            ),
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
    let fetch_out = run_git_auto(vault_root, &["fetch", "origin"])?;
    if !fetch_out.status.success() {
        return Err(String::from_utf8_lossy(&fetch_out.stderr).trim().to_string());
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

        // ── SSH deploy-key path ──────────────────────────────────────
        if is_ssh_url(&trimmed_url) {
            if !has_deploy_key(&vault_root) {
                return Err(IpcError::Other(
                    "Deploy key not generated yet. Click \"Generate deploy key\" first, \
                     paste the public key into the repo's Deploy Keys (with write \
                     access), then Connect."
                        .into(),
                ));
            }
            let _ = run_git(&vault_root, &["remote", "remove", "origin"]);
            run_git_check(&vault_root, &["remote", "add", "origin", &trimmed_url])
                .map_err(IpcError::Other)?;

            // Clear any leftover HTTPS auth state from a prior connection.
            let _ = run_git(
                &vault_root,
                &["config", "--local", "--remove-section", "http.https://github.com/"],
            );

            // Pin core.sshCommand so git uses ONLY our deploy key.
            let ssh_cmd = build_ssh_command(&vault_root);
            run_git_check(
                &vault_root,
                &["config", "--local", "core.sshCommand", &ssh_cmd],
            )
            .map_err(IpcError::Other)?;

            // Make sure HEAD exists.
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
                let stderr = String::from_utf8_lossy(&push_out.stderr).trim().to_string();
                let stdout = String::from_utf8_lossy(&push_out.stdout).trim().to_string();
                let mut msg = "git push (ssh) failed".to_string();
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
                } else if lower.contains("repository not found")
                    || lower.contains("does not exist")
                {
                    msg.push_str(
                        "\nHint: the SSH URL is wrong. Use \
                         git@github.com:owner/repo.git (no https://).",
                    );
                }
                return Err(IpcError::Other(msg));
            }
            return Ok(trimmed_url);
        }

        // ── HTTPS + optional PAT path (legacy) ───────────────────────
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
            // Force HTTP/1.1 — HTTP/2 multiplexing on GitHub occasionally
            // produces "RPC failed; HTTP 403 ... send-pack: unexpected
            // disconnect" when the auth header isn't reapplied across the
            // multiplexed streams.
            let _ = run_git(
                &vault_root,
                &["config", "--local", "http.version", "HTTP/1.1"],
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

        let push_out = if input
            .token
            .as_deref()
            .map(str::trim)
            .map(|s| !s.is_empty())
            .unwrap_or(false)
        {
            // With a PAT we run git in an isolated $HOME so the user's
            // global gitconfig (and any inherited credential helper /
            // includeIf / extra http config) cannot influence auth — only
            // the per-vault .git/config we just wrote.
            run_git_isolated(&vault_root, &["push", "-u", "origin", "HEAD"])
                .map_err(IpcError::Other)?
        } else {
            run_git(&vault_root, &["push", "-u", "origin", "HEAD"])
                .map_err(IpcError::Other)?
        };
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
            // Append a sanitized snapshot of the credential / http config
            // that's actually visible to git from this repo. Helps
            // pinpoint when an inherited helper or an extraHeader is
            // missing / overriding what we set.
            if let Ok(out) = run_git(
                &vault_root,
                &["config", "--show-origin", "--list"],
            ) {
                if out.status.success() {
                    let listing = String::from_utf8_lossy(&out.stdout);
                    let mut diag = String::from("\nConfig snapshot (credential/http/remote):");
                    let mut any = false;
                    for line in listing.lines() {
                        let lower_line = line.to_lowercase();
                        if lower_line.contains("credential.")
                            || lower_line.contains("http.")
                            || lower_line.contains("remote.")
                        {
                            any = true;
                            diag.push('\n');
                            // Redact the actual extraheader value but keep
                            // its presence visible so we know it's set.
                            if let Some(idx) = line.to_lowercase().find("extraheader=") {
                                diag.push_str(&line[..idx]);
                                diag.push_str("extraheader=<redacted>");
                            } else {
                                diag.push_str(line);
                            }
                        }
                    }
                    if any {
                        msg.push_str(&diag);
                    }
                }
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
        let _ = run_git(
            &vault_root_for_blocking,
            &["config", "--local", "--unset", "core.sshcommand"],
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
