use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::vault::settings::{load_vault_settings, save_vault_settings, VaultSettings};
use crate::vault::VaultState;
use crate::IpcError;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub appearance: AppearanceSettings,
    #[serde(default)]
    pub editor: EditorSettings,
    #[serde(default)]
    pub vault: GlobalVaultSettings,
    #[serde(default)]
    pub markdown: MarkdownSettings,
    #[serde(default)]
    pub assets: AssetSettings,
    #[serde(default)]
    pub ai: AiSettings,
    #[serde(default)]
    pub updates: UpdatesSettings,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatesSettings {
    #[serde(default = "default_true")]
    pub auto_check: bool,
}

impl Default for UpdatesSettings {
    fn default() -> Self {
        Self { auto_check: true }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppearanceSettings {
    #[serde(default = "default_density")]
    pub density: String,
    #[serde(default = "default_theme")]
    pub theme: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorSettings {
    #[serde(default = "default_auto_save_debounce_ms")]
    pub auto_save_debounce_ms: u32,
    #[serde(default = "default_preview_default")]
    pub preview_default: bool,
    #[serde(default = "default_true")]
    pub line_wrap: bool,
    #[serde(default = "default_true")]
    pub show_line_numbers: bool,
    #[serde(default = "default_font_size")]
    pub font_size: u32,
    #[serde(default = "default_tab_size")]
    pub tab_size: u32,
    #[serde(default)]
    pub vim_mode: bool,
    #[serde(default = "default_true")]
    pub live_preview: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalVaultSettings {
    #[serde(default = "default_recent_limit")]
    pub recent_limit: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownSettings {
    #[serde(default = "default_true")]
    pub callouts: bool,
    #[serde(default = "default_true")]
    pub footnotes: bool,
    #[serde(default = "default_true")]
    pub highlight: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetSettings {
    #[serde(default)]
    pub offline_mode: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettings {
    #[serde(default = "default_ai_provider")]
    pub provider: String,
}

fn default_ai_provider() -> String {
    "disabled".to_string()
}

impl Default for AiSettings {
    fn default() -> Self {
        Self { provider: default_ai_provider() }
    }
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            density: default_density(),
            theme: default_theme(),
        }
    }
}

impl Default for EditorSettings {
    fn default() -> Self {
        Self {
            auto_save_debounce_ms: default_auto_save_debounce_ms(),
            preview_default: default_preview_default(),
            line_wrap: true,
            show_line_numbers: true,
            font_size: default_font_size(),
            tab_size: default_tab_size(),
            vim_mode: false,
            live_preview: true,
        }
    }
}

impl Default for GlobalVaultSettings {
    fn default() -> Self {
        Self {
            recent_limit: default_recent_limit(),
        }
    }
}

impl Default for MarkdownSettings {
    fn default() -> Self {
        Self {
            callouts: true,
            footnotes: true,
            highlight: true,
        }
    }
}

#[tauri::command]
pub fn settings_app_load(app: AppHandle) -> Result<AppSettings, IpcError> {
    load_app_settings(&app_settings_path(&app)?)
}

#[tauri::command]
pub fn settings_app_save(app: AppHandle, settings: AppSettings) -> Result<AppSettings, IpcError> {
    let path = app_settings_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&path, serde_json::to_string_pretty(&settings).map_err(|err| IpcError::Parse(err.to_string()))?)?;
    Ok(settings)
}

#[tauri::command]
pub fn settings_vault_load(state: tauri::State<'_, VaultState>) -> Result<VaultSettings, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    load_vault_settings(&root)
}

#[tauri::command]
pub fn settings_vault_save(
    state: tauri::State<'_, VaultState>,
    settings: VaultSettings,
) -> Result<VaultSettings, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    save_vault_settings(&root, &settings)?;
    Ok(settings)
}

fn load_app_settings(path: &Path) -> Result<AppSettings, IpcError> {
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let text = fs::read_to_string(path)?;
    serde_json::from_str(&text).map_err(|err| IpcError::Parse(err.to_string()))
}

fn app_settings_path(app: &AppHandle) -> Result<PathBuf, IpcError> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("settings.json"))
        .map_err(|err| IpcError::Other(err.to_string()))
}

fn default_density() -> String {
    "comfortable".to_string()
}

fn default_theme() -> String {
    "light".to_string()
}

fn default_auto_save_debounce_ms() -> u32 {
    500
}

fn default_preview_default() -> bool {
    false
}

fn default_recent_limit() -> u32 {
    8
}

fn default_font_size() -> u32 {
    14
}

fn default_tab_size() -> u32 {
    2
}

fn default_true() -> bool {
    true
}
