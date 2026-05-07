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
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRemoteSettings {
    pub enabled: bool,
    pub url: Option<String>,
    pub provider: Option<String>,
}

pub fn load_vault_settings(vault_root: &Path) -> Result<VaultSettings, IpcError> {
    let config_path = vault_root.join(".noxe").join("config.json");
    if !config_path.exists() {
        return Ok(VaultSettings::default());
    }
    let text = fs::read_to_string(config_path)?;
    serde_json::from_str(&text).map_err(|err| IpcError::Parse(err.to_string()))
}

pub fn save_vault_settings(vault_root: &Path, settings: &VaultSettings) -> Result<(), IpcError> {
    let config_dir = vault_root.join(".noxe");
    fs::create_dir_all(&config_dir)?;
    let text = serde_json::to_string_pretty(settings).map_err(|err| IpcError::Parse(err.to_string()))?;
    fs::write(config_dir.join("config.json"), text)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;

    #[test]
    fn missing_config_returns_defaults() {
        let dir = tempdir().unwrap();

        let settings = load_vault_settings(dir.path()).unwrap();

        assert_eq!(settings, VaultSettings::default());
    }

    #[test]
    fn loads_camel_case_vault_config() {
        let dir = tempdir().unwrap();
        let config_dir = dir.path().join(".noxe");
        fs::create_dir(&config_dir).unwrap();
        fs::write(
            config_dir.join("config.json"),
            r#"{
              "dailyPathPattern": "Journal/YYYY-MM-DD.md",
              "dailyTemplatePath": "Templates/Daily.md",
              "attachmentsFolder": "media",
              "offlineMode": true,
              "autoRewriteLinksOnRename": false
            }"#,
        )
        .unwrap();

        let settings = load_vault_settings(dir.path()).unwrap();

        assert_eq!(
            settings.daily_path_pattern.as_deref(),
            Some("Journal/YYYY-MM-DD.md")
        );
        assert_eq!(settings.daily_template_path.as_deref(), Some("Templates/Daily.md"));
        assert_eq!(settings.attachments_folder.as_deref(), Some("media"));
        assert_eq!(settings.offline_mode, Some(true));
        assert_eq!(settings.auto_rewrite_links_on_rename, Some(false));
    }

    #[test]
    fn saves_vault_settings_file() {
        let dir = tempdir().unwrap();
        let settings = VaultSettings {
            daily_path_pattern: Some("Journal/YYYY-MM-DD.md".to_string()),
            daily_template_path: Some("Templates/Daily.md".to_string()),
            attachments_folder: Some("_attachments".to_string()),
            offline_mode: None,
            auto_rewrite_links_on_rename: Some(true),
            git_auto_commit: None,
            git_remote: None,
            tag_library: Some(vec!["draft".to_string(), "review".to_string()]),
        };

        save_vault_settings(dir.path(), &settings).unwrap();
        let loaded = load_vault_settings(dir.path()).unwrap();

        assert_eq!(loaded, settings);
    }
}
