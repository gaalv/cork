use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use crate::vault::settings::load_vault_settings;
use crate::vault::VaultState;
use crate::IpcError;

pub mod remote;

// ── Public types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VcsStatus {
    pub enabled: bool,
    pub repo_path: Option<PathBuf>,
    pub has_git: bool,
    pub has_gh: bool,
    pub gh_account: Option<remote::GhAccount>,
    pub remote: Option<remote::RemoteInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitEntry {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author_name: String,
    pub iso_date: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryInput {
    pub note_path: PathBuf,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreInput {
    pub note_path: PathBuf,
    pub sha: String,
}

// ── VCS state (debounce) ─────────────────────────────────────────────────────

struct PendingCommit {
    queued_at: Instant,
    is_new: bool,
    vault_root: PathBuf,
}

pub struct VcsState {
    pending: Arc<Mutex<HashMap<PathBuf, PendingCommit>>>,
}

impl Default for VcsState {
    fn default() -> Self {
        Self {
            pending: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl VcsState {
    /// Schedule a debounced commit. Multiple calls within the debounce window
    /// collapse into a single commit. The `is_new` flag is sticky: once set to
    /// `true` for a path it stays `true` until the commit fires.
    pub fn schedule(&self, vault_root: PathBuf, note_path: PathBuf, is_new: bool) {
        let mut map = self.pending.lock().expect("vcs pending mutex poisoned");
        if let Some(entry) = map.get_mut(&note_path) {
            entry.queued_at = Instant::now();
            if is_new {
                entry.is_new = true;
            }
        } else {
            map.insert(
                note_path,
                PendingCommit {
                    queued_at: Instant::now(),
                    is_new,
                    vault_root,
                },
            );
        }
    }

    /// Spawn a background thread that drains commits older than `debounce_secs`.
    fn start_background_worker(
        pending: Arc<Mutex<HashMap<PathBuf, PendingCommit>>>,
        remote_inner: Arc<Mutex<remote::RemoteInner>>,
    ) {
        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_secs(1));
            let now = Instant::now();
            let mut to_commit: Vec<(PathBuf, PathBuf, bool)> = Vec::new();
            {
                let mut map = pending.lock().expect("vcs pending mutex poisoned");
                let expired: Vec<PathBuf> = map
                    .iter()
                    .filter(|(_, c)| now.duration_since(c.queued_at) >= Duration::from_secs(5))
                    .map(|(p, _)| p.clone())
                    .collect();
                for path in expired {
                    if let Some(commit) = map.remove(&path) {
                        to_commit.push((path, commit.vault_root, commit.is_new));
                    }
                }
            }
            let mut any_committed = false;
            for (note_path, vault_root, is_new) in to_commit {
                match do_commit(&vault_root, &note_path, is_new) {
                    Ok(()) => any_committed = true,
                    Err(e) => {
                        eprintln!("cork vcs: commit failed for {}: {e}", note_path.display());
                    }
                }
            }
            if any_committed {
                if let Ok(mut g) = remote_inner.lock() {
                    if g.enabled {
                        g.push_pending = true;
                        g.push_queued_at = Some(Instant::now());
                    }
                }
            }
        });
    }
}

/// Spawn the background debounce worker. Call this once during app setup.
pub fn start_worker(state: &VcsState, remote_state: &remote::RemoteState) {
    let pending = Arc::clone(&state.pending);
    let remote_inner = remote_state.inner_arc();
    VcsState::start_background_worker(pending, remote_inner);
}

// ── Git helpers ───────────────────────────────────────────────────────────────

pub fn git_available() -> bool {
    crate::proc::command("git")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn ensure_local_git_identity(vault_root: &Path) -> Result<(), String> {
    for (key, value) in [("user.name", "Cork"), ("user.email", "cork@local")] {
        let output = crate::proc::command("git")
            .current_dir(vault_root)
            .args(["config", "--local", key, value])
            .output()
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(format!(
                "git config --local {key} failed: {}",
                if stderr.is_empty() {
                    "non-zero exit".to_string()
                } else {
                    stderr
                }
            ));
        }
    }
    Ok(())
}

/// Initialise a git repo in `vault_root` if one does not already exist.
/// Always pins the repository-local identity to Cork. For a new repository,
/// also writes a sensible `.gitignore` and creates an initial commit.
/// Silently returns `Ok(())` when git is not installed.
pub fn git_init_if_needed(vault_root: &Path) -> Result<(), String> {
    if !git_available() {
        return Ok(());
    }
    if vault_root.join(".git").exists() {
        return ensure_local_git_identity(vault_root);
    }

    // Try modern `git init -b main` first; fall back for older git
    let init_ok = crate::proc::command("git")
        .current_dir(vault_root)
        .args(["-c", "init.defaultBranch=main", "init"])
        .status()
        .map(|s| s.success())
        .unwrap_or(false);

    if !init_ok {
        let _ = crate::proc::command("git")
            .current_dir(vault_root)
            .arg("init")
            .status();
    }

    ensure_local_git_identity(vault_root)?;

    // Write .gitignore
    let gitignore = vault_root.join(".gitignore");
    if !gitignore.exists() {
        std::fs::write(
            &gitignore,
            ".DS_Store\nnode_modules/\ndist/\n.cork/cache/\n.cork/sync.log\n",
        )
        .map_err(|e| e.to_string())?;
    }

    // Stage everything and create the initial commit
    let _ = crate::proc::command("git")
        .current_dir(vault_root)
        .args(["add", "-A"])
        .status();

    let init_body = format!(
        "Timestamp: {}\nVault: {}\n\nSource: cork-app",
        chrono::Utc::now().to_rfc3339(),
        vault_root.display()
    );
    let commit = crate::proc::command("git")
        .current_dir(vault_root)
        .args([
            "-c",
            "user.name=Cork",
            "-c",
            "user.email=cork@local",
            "commit",
            "--allow-empty",
            "-m",
            "vault(init): initial commit",
            "-m",
            &init_body,
            "--author=Cork <cork@local>",
        ])
        .output()
        .map_err(|e| e.to_string())?;
    if !commit.status.success() {
        let stderr = String::from_utf8_lossy(&commit.stderr).trim().to_string();
        return Err(format!(
            "git commit failed during init: {}",
            if stderr.is_empty() {
                "non-zero exit".to_string()
            } else {
                stderr
            }
        ));
    }

    Ok(())
}

fn do_commit(vault_root: &Path, note_path: &Path, is_new: bool) -> Result<(), String> {
    if !git_available() {
        return Ok(());
    }
    if !vault_root.join(".git").exists() {
        return Ok(());
    }

    let rel = note_path
        .strip_prefix(vault_root)
        .unwrap_or(note_path)
        .to_string_lossy()
        .to_string();

    let verb = if is_new { "create" } else { "update" };
    let subject = format!("note({verb}): {rel}");
    let body = format!(
        "Timestamp: {}\nFile: {}\n\nSource: cork-app",
        chrono::Utc::now().to_rfc3339(),
        rel
    );

    let _ = crate::proc::command("git")
        .current_dir(vault_root)
        .args(["add", "--", &note_path.to_string_lossy().to_string()])
        .status();

    // `git commit` exits non-zero when there is nothing to commit — that is fine
    let _ = crate::proc::command("git")
        .current_dir(vault_root)
        .args([
            "-c",
            "user.name=Cork",
            "-c",
            "user.email=cork@local",
            "commit",
            "-m",
            &subject,
            "-m",
            &body,
            "--author=Cork <cork@local>",
        ])
        .status();

    Ok(())
}

fn git_auto_commit_enabled(vault_state: &VaultState) -> bool {
    vault_state
        .current_path()
        .and_then(|root| load_vault_settings(&root).ok())
        .and_then(|s| s.git_auto_commit)
        .unwrap_or(true)
}

// ── IPC commands ──────────────────────────────────────────────────────────────

#[tauri::command]
pub fn vcs_status(
    state: tauri::State<'_, VaultState>,
    remote_state: tauri::State<'_, remote::RemoteState>,
) -> Result<VcsStatus, IpcError> {
    let has_git = git_available();
    let has_gh = remote::gh_available();
    let gh_account = if has_gh {
        remote::gh_active_account()
    } else {
        None
    };
    let current = state.current_path();
    let repo_path = current.as_ref().and_then(|p| {
        if p.join(".git").exists() {
            Some(p.clone())
        } else {
            None
        }
    });
    let enabled = current
        .as_ref()
        .and_then(|root| load_vault_settings(root).ok())
        .and_then(|s| s.git_auto_commit)
        .unwrap_or(true);
    let remote_info = if remote_state.is_enabled() {
        Some(remote_state.snapshot())
    } else {
        None
    };

    Ok(VcsStatus {
        enabled,
        repo_path,
        has_git,
        has_gh,
        gh_account,
        remote: remote_info,
    })
}

#[tauri::command]
pub fn vcs_history(
    state: tauri::State<'_, VaultState>,
    input: HistoryInput,
) -> Result<Vec<CommitEntry>, IpcError> {
    let vault_root = state.current_path().ok_or(IpcError::NotFound)?;
    if !git_available() || !vault_root.join(".git").exists() {
        return Ok(vec![]);
    }

    let limit = input.limit.unwrap_or(30);
    let rel = input
        .note_path
        .strip_prefix(&vault_root)
        .unwrap_or(&input.note_path)
        .to_string_lossy()
        .to_string();

    let output = crate::proc::command("git")
        .current_dir(&vault_root)
        .args([
            "log",
            "--follow",
            &format!("--pretty=format:%H\x1f%h\x1f%s\x1f%an\x1f%aI"),
            &format!("-{limit}"),
            "--",
            &rel,
        ])
        .output()
        .map_err(|e| IpcError::Other(e.to_string()))?;

    let text = String::from_utf8_lossy(&output.stdout);
    let entries = text
        .lines()
        .filter(|line| !line.is_empty())
        .filter_map(|line| {
            let mut parts = line.splitn(5, '\x1f');
            Some(CommitEntry {
                sha: parts.next()?.to_string(),
                short_sha: parts.next()?.to_string(),
                message: parts.next()?.to_string(),
                author_name: parts.next()?.to_string(),
                iso_date: parts.next()?.to_string(),
            })
        })
        .collect();

    Ok(entries)
}

#[tauri::command]
pub fn vcs_restore(
    state: tauri::State<'_, VaultState>,
    vcs_state: tauri::State<'_, VcsState>,
    input: RestoreInput,
) -> Result<(), IpcError> {
    let vault_root = state.current_path().ok_or(IpcError::NotFound)?;
    if !git_available() {
        return Err(IpcError::Other("git is not available".to_string()));
    }

    let rel = input
        .note_path
        .strip_prefix(&vault_root)
        .unwrap_or(&input.note_path)
        .to_string_lossy()
        .to_string();

    let output = crate::proc::command("git")
        .current_dir(&vault_root)
        .args(["show", &format!("{}:{}", input.sha, rel)])
        .output()
        .map_err(|e| IpcError::Other(e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(IpcError::Other(format!("git show failed: {stderr}")));
    }

    std::fs::write(&input.note_path, &output.stdout).map_err(|e| IpcError::Io(e.to_string()))?;

    // Create a restore commit immediately (not debounced)
    let short_sha = if input.sha.len() >= 7 {
        &input.sha[..7]
    } else {
        &input.sha
    };
    let subject = format!("note(restore): {rel} from {short_sha}");
    let body = format!(
        "Timestamp: {}\nFile: {}\nRestored from: {}\n\nSource: cork-app",
        chrono::Utc::now().to_rfc3339(),
        rel,
        input.sha
    );

    let _ = crate::proc::command("git")
        .current_dir(&vault_root)
        .args(["add", "--", &rel])
        .status();

    let _ = crate::proc::command("git")
        .current_dir(&vault_root)
        .args([
            "-c",
            "user.name=Cork",
            "-c",
            "user.email=cork@local",
            "commit",
            "-m",
            &subject,
            "-m",
            &body,
            "--author=Cork <cork@local>",
        ])
        .status();

    // Remove any pending debounced commit for this file to avoid a duplicate
    {
        let mut map = vcs_state
            .pending
            .lock()
            .expect("vcs pending mutex poisoned");
        map.remove(&input.note_path);
    }

    Ok(())
}

/// Called from `notes_save` after a successful write.
pub fn on_note_saved(
    vcs_state: &VcsState,
    vault_state: &VaultState,
    note_path: &Path,
    is_new: bool,
) {
    if !git_auto_commit_enabled(vault_state) {
        return;
    }
    let Some(vault_root) = vault_state.current_path() else {
        return;
    };
    vcs_state.schedule(vault_root, note_path.to_path_buf(), is_new);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opening_existing_repo_overwrites_local_identity_with_cork() {
        if !git_available() {
            return;
        }

        let temp = tempfile::tempdir().expect("temp directory");
        let init = crate::proc::command("git")
            .current_dir(temp.path())
            .arg("init")
            .output()
            .expect("git init should run");
        assert!(init.status.success());

        for (key, value) in [
            ("user.name", "Work Account"),
            ("user.email", "work@example.com"),
        ] {
            let status = crate::proc::command("git")
                .current_dir(temp.path())
                .args(["config", "--local", key, value])
                .status()
                .expect("git config should run");
            assert!(status.success());
        }

        git_init_if_needed(temp.path()).expect("existing repository should be normalized");

        for (key, expected) in [("user.name", "Cork"), ("user.email", "cork@local")] {
            let output = crate::proc::command("git")
                .current_dir(temp.path())
                .args(["config", "--local", "--get", key])
                .output()
                .expect("git config should run");
            assert!(output.status.success());
            assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), expected);
        }
    }
}
