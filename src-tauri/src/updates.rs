//! How this copy of Cork was installed, and therefore how it should be updated.
//!
//! Cork does not update itself. It is distributed through package managers, and
//! an app that swaps its own bundle underneath Homebrew leaves `brew` holding a
//! stale record — the next `brew upgrade` then does nothing, or reinstalls an
//! older build over the new one. So the app only detects its channel and tells
//! the user the command to run.

#[cfg(any(target_os = "macos", target_os = "linux"))]
use std::path::PathBuf;

use serde::Serialize;

/// The universal updater for installs that did not come from a package manager.
/// Re-running it overwrites the app in place with the latest release, so it is
/// the right command for anyone outside Homebrew or a distro package.
#[cfg(any(target_os = "macos", target_os = "linux"))]
const SCRIPT_COMMAND: &str = "curl -fsSL https://gaalv.cloud/cork | sh";

/// Where the running binary came from.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallChannel {
    /// Stable slug the frontend switches on.
    pub channel: String,
    /// Upgrade command to show, when one applies.
    pub command: Option<String>,
    /// Human-readable name of the channel.
    pub label: String,
}

impl InstallChannel {
    fn new(channel: &str, label: &str, command: Option<&str>) -> Self {
        Self {
            channel: channel.to_string(),
            label: label.to_string(),
            command: command.map(str::to_string),
        }
    }
}

#[cfg(target_os = "linux")]
fn exe_path() -> Option<PathBuf> {
    std::env::current_exe().ok()
}

#[cfg(target_os = "macos")]
fn detect() -> InstallChannel {
    // Homebrew records every cask under its Caskroom, whichever prefix is used.
    let caskroom = ["/opt/homebrew/Caskroom/cork", "/usr/local/Caskroom/cork"];
    if caskroom.iter().any(|p| PathBuf::from(p).is_dir()) {
        return InstallChannel::new("homebrewCask", "Homebrew", Some("brew upgrade --cask cork"));
    }
    // The install script (or a hand-dragged .dmg): re-running the script
    // replaces Cork.app in place. Homebrew is handled above so its record
    // never goes stale under us.
    InstallChannel::new("script", "Install script", Some(SCRIPT_COMMAND))
}

#[cfg(target_os = "linux")]
fn detect() -> InstallChannel {
    // The install script drops an AppImage and runs it, which exports $APPIMAGE.
    // Re-running the script overwrites that AppImage, so it is the update path.
    if std::env::var("APPIMAGE").is_ok() {
        return InstallChannel::new("script", "Install script", Some(SCRIPT_COMMAND));
    }

    let exe = exe_path().unwrap_or_default();
    let exe_str = exe.to_string_lossy();
    let brew_prefixes = ["/home/linuxbrew/.linuxbrew", "/opt/homebrew"];
    if brew_prefixes.iter().any(|p| exe_str.starts_with(p)) {
        return InstallChannel::new("homebrewFormula", "Homebrew", Some("brew upgrade cork"));
    }
    // .deb / .rpm land in system prefixes and update through the distro's
    // package manager — never tell those users to curl a script over the top.
    if exe_str.starts_with("/usr/") || exe_str.starts_with("/opt/") {
        return InstallChannel::new("systemPackage", "System package", None);
    }
    InstallChannel::new("script", "Install script", Some(SCRIPT_COMMAND))
}

#[cfg(target_os = "windows")]
fn detect() -> InstallChannel {
    // winget is the only Windows channel Cork publishes to, so an installed
    // build is assumed to have come from it. A user who ran the .exe by hand
    // still gets a working command — winget adopts already-installed packages.
    InstallChannel::new("winget", "winget", Some("winget upgrade gaalv.Cork"))
}

#[tauri::command]
pub fn updates_install_channel() -> InstallChannel {
    // A dev build must never nag about updates.
    if cfg!(debug_assertions) {
        return InstallChannel::new("dev", "Development build", None);
    }
    detect()
}
