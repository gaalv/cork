use std::collections::HashMap;
use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::IpcError;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultSettings {
    pub daily_path_pattern: Option<String>,
    pub daily_template_path: Option<String>,
    pub attachments_folder: Option<String>,
    pub offline_mode: Option<bool>,
    pub auto_rewrite_links_on_rename: Option<bool>,
    /// When `true` (default), save events trigger a local git auto-commit.
    pub git_auto_commit: Option<bool>,
    /// GitHub remote sync (F26).
    pub git_remote: Option<GitRemoteSettings>,
    /// User-curated tag library for standalone tag creation. Tags listed here
    /// appear in the Tags drawer even if no note currently uses them.
    pub tag_library: Option<Vec<String>>,
    pub folder_icons: Option<HashMap<String, String>>,
    pub folder_colors: Option<HashMap<String, String>>,
    /// Days to keep archived notes before auto-deleting (0 = keep forever).
    pub archive_retention_days: Option<u32>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRemoteSettings {
    pub enabled: bool,
    pub url: Option<String>,
    pub provider: Option<String>,
}

pub fn load_vault_settings(vault_root: &Path) -> Result<VaultSettings, IpcError> {
    let config_path = vault_root.join(".cork").join("config.json");
    if !config_path.exists() {
        return Ok(VaultSettings::default());
    }
    let text = fs::read_to_string(config_path)?;
    serde_json::from_str(&text).map_err(|err| IpcError::Parse(err.to_string()))
}

pub fn save_vault_settings(vault_root: &Path, settings: &VaultSettings) -> Result<(), IpcError> {
    let config_dir = vault_root.join(".cork");
    fs::create_dir_all(&config_dir)?;
    let text = serde_json::to_string_pretty(settings).map_err(|err| IpcError::Parse(err.to_string()))?;
    fs::write(config_dir.join("config.json"), text)?;
    Ok(())
}
