//! Locating and launching external CLIs.
//!
//! A GUI app on macOS is not started from a shell: it inherits a bare
//! `/usr/bin:/bin:/usr/sbin:/sbin` and never sources the user's shell config.
//! Anything installed by Homebrew (`/opt/homebrew/bin`), a version manager, or
//! into `~/.local/bin` is therefore invisible to the app even though it works
//! perfectly in the user's terminal — which is why `git`, `gh` and the AI CLIs
//! reported "not found on PATH" only in the packaged app.
//!
//! `command()` is the entry point: it resolves the binary to an absolute path
//! and hands the child a usable PATH so its own helpers resolve too.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

#[cfg(target_os = "windows")]
pub const SEPARATOR: char = ';';
#[cfg(not(target_os = "windows"))]
pub const SEPARATOR: char = ':';

#[cfg(target_os = "windows")]
const SEPARATOR_STR: &str = ";";
#[cfg(not(target_os = "windows"))]
const SEPARATOR_STR: &str = ":";

/// Directories CLI installers commonly use but which a GUI PATH never contains.
/// Relative entries are resolved against `$HOME`.
#[cfg(not(target_os = "windows"))]
const EXTRA_BIN_DIRS: &[&str] = &[
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/opt/local/bin",
    ".local/bin",
    ".bun/bin",
    ".cargo/bin",
    ".deno/bin",
    ".volta/bin",
    ".npm-global/bin",
    ".yarn/bin",
    ".claude/local",
    "bin",
];

/// Ask the user's login shell what its PATH is.
///
/// `printenv` is run rather than `echo $PATH` because fish stores PATH as a
/// list and would print it space-separated; executing a real binary sidesteps
/// every shell's quoting rules and works for bash, zsh, fish and nushell alike.
#[cfg(not(target_os = "windows"))]
fn login_shell_path() -> Option<String> {
    let shell = std::env::var("SHELL").ok()?;
    let output = Command::new(&shell)
        .arg("-l")
        .arg("-c")
        .arg("/usr/bin/printenv PATH")
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        None
    } else {
        Some(path)
    }
}

/// The PATH used to find and launch external CLIs. Computed once per process.
pub fn search_path() -> &'static str {
    static PATH: OnceLock<String> = OnceLock::new();
    PATH.get_or_init(|| {
        let mut dirs: Vec<String> = Vec::new();
        let mut push = |dir: String| {
            if !dir.is_empty() && !dirs.contains(&dir) {
                dirs.push(dir);
            }
        };

        #[cfg(not(target_os = "windows"))]
        if let Some(shell_path) = login_shell_path() {
            for dir in shell_path.split(SEPARATOR) {
                push(dir.to_string());
            }
        }

        if let Ok(current) = std::env::var("PATH") {
            for dir in current.split(SEPARATOR) {
                push(dir.to_string());
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            let home = std::env::var("HOME").unwrap_or_default();
            for dir in EXTRA_BIN_DIRS {
                if dir.starts_with('/') {
                    push((*dir).to_string());
                } else if !home.is_empty() {
                    push(format!("{home}/{dir}"));
                }
            }
        }

        dirs.join(SEPARATOR_STR)
    })
}

#[cfg(unix)]
fn is_executable(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    path.metadata()
        .map(|m| m.is_file() && m.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

#[cfg(not(unix))]
fn is_executable(path: &Path) -> bool {
    path.is_file()
}

/// Absolute path to `binary`, searching [`search_path`]. `None` when absent.
pub fn resolve_binary(binary: &str) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let candidates = [
        format!("{binary}.exe"),
        format!("{binary}.cmd"),
        binary.to_string(),
    ];
    #[cfg(not(target_os = "windows"))]
    let candidates = [binary.to_string()];

    for dir in search_path().split(SEPARATOR) {
        if dir.is_empty() {
            continue;
        }
        for name in &candidates {
            let candidate = Path::new(dir).join(name);
            if is_executable(&candidate) {
                return Some(candidate);
            }
        }
    }
    None
}

/// True when `binary` can be launched.
pub fn binary_available(binary: &str) -> bool {
    resolve_binary(binary).is_some()
}

/// Build a [`Command`] for `binary`, resolved to an absolute path where
/// possible and carrying a PATH its children can use.
///
/// Falls back to the bare name when the binary cannot be located, so the
/// caller still gets the OS's own "not found" error rather than a panic.
pub fn command(binary: &str) -> Command {
    let mut cmd = match resolve_binary(binary) {
        Some(path) => Command::new(path),
        None => Command::new(binary),
    };
    cmd.env("PATH", search_path());
    cmd
}
