use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::IpcError;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultSettings {
    pub daily_path_pattern: Option<String>,
    pub attachments_folder: Option<String>,
    pub offline_mode: Option<bool>,
    pub auto_rewrite_links_on_rename: Option<bool>,
}

pub fn load_vault_settings(vault_root: &Path) -> Result<VaultSettings, IpcError> {
    let config_path = vault_root.join(".noxe").join("config.json");
    if !config_path.exists() {
        return Ok(VaultSettings::default());
    }
    let text = fs::read_to_string(config_path)?;
    serde_json::from_str(&text).map_err(|err| IpcError::Parse(err.to_string()))
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
        assert_eq!(settings.attachments_folder.as_deref(), Some("media"));
        assert_eq!(settings.offline_mode, Some(true));
        assert_eq!(settings.auto_rewrite_links_on_rename, Some(false));
    }
}
