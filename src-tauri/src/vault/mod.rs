pub mod bulk;
pub mod fingerprint;
pub mod folders;
pub mod frontmatter;
pub mod io;
pub mod list;
pub mod rename_propagation;
pub mod scaffold;
pub mod settings;
pub mod watcher;

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

pub use folders::{
    folders_create, folders_move, folders_rename, folders_trash, VaultFolderChangedEvent,
};

use crate::vault::fingerprint::FingerprintCache;
use crate::vault::io::CreateNoteInput;
use crate::vault::settings::{load_vault_settings, VaultSettings};
use crate::vault::watcher::{
    FileChangeKind, FileChangeSource, VaultEventSink, VaultFileChangedEvent, WatcherController,
};
use crate::IpcError;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteEntry {
    pub id: String,
    pub path: PathBuf,
    pub title: String,
    pub folder: String,
    pub size: u64,
    pub mtime: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteFile {
    pub path: PathBuf,
    pub frontmatter: Value,
    pub body: String,
    pub mtime: i64,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveInput {
    pub path: PathBuf,
    pub frontmatter: Value,
    pub body: String,
    pub expected_mtime: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub path: PathBuf,
    pub mtime: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PersistedVault {
    path: Option<PathBuf>,
    #[serde(default)]
    recent: Vec<PathBuf>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentVault {
    pub path: PathBuf,
    pub name: String,
    pub missing: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultClosedEvent {
    pub previous_path: Option<PathBuf>,
}

const MAX_RECENT_VAULTS: usize = 10;

pub struct VaultState {
    current_path: Mutex<Option<PathBuf>>,
    config_path: Mutex<Option<PathBuf>>,
    pub fingerprint_cache: Arc<FingerprintCache>,
    watcher: WatcherController,
}

impl Default for VaultState {
    fn default() -> Self {
        Self {
            current_path: Mutex::new(None),
            config_path: Mutex::new(None),
            fingerprint_cache: Arc::new(FingerprintCache::new()),
            watcher: WatcherController::new(),
        }
    }
}

impl VaultState {
    pub fn current_path(&self) -> Option<PathBuf> {
        self.current_path
            .lock()
            .expect("vault path mutex poisoned")
            .clone()
    }

    pub fn set_config_path(&self, path: PathBuf) {
        *self.config_path.lock().expect("config path mutex poisoned") = Some(path);
    }

    pub fn set_current_path(&self, path: PathBuf) -> Result<(), IpcError> {
        if !path.is_dir() {
            self.clear_current_path()?;
            return Err(IpcError::NotFound);
        }
        let canonical = path.canonicalize()?;
        *self.current_path.lock().expect("vault path mutex poisoned") = Some(canonical.clone());
        self.persist_current_path(Some(&canonical))?;
        Ok(())
    }

    pub fn close_current_path(&self) -> Result<Option<PathBuf>, IpcError> {
        let previous = self.current_path();
        *self.current_path.lock().expect("vault path mutex poisoned") = None;
        self.watcher.stop();
        self.persist_current_path(None)?;
        Ok(previous)
    }

    pub fn clear_current_path(&self) -> Result<(), IpcError> {
        *self.current_path.lock().expect("vault path mutex poisoned") = None;
        self.watcher.stop();
        self.write_config(&PersistedVault::default())
    }

    pub fn load_persisted_path(&self) -> Result<Option<PathBuf>, IpcError> {
        let Some(config_path) = self
            .config_path
            .lock()
            .expect("config path mutex poisoned")
            .clone()
        else {
            return Ok(None);
        };
        if !config_path.exists() {
            return Ok(None);
        }
        Ok(self.load_config()?.path)
    }

    pub fn recent_vaults(&self) -> Result<Vec<RecentVault>, IpcError> {
        Ok(self
            .load_config()?
            .recent
            .into_iter()
            .map(|path| RecentVault {
                name: vault_display_name(&path),
                missing: !path.is_dir(),
                path,
            })
            .collect())
    }

    pub fn remove_recent(&self, path: &Path) -> Result<(), IpcError> {
        let mut config = self.load_config()?;
        config.recent.retain(|candidate| candidate != path);
        if config.path.as_deref() == Some(path) {
            config.path = None;
        }
        self.write_config(&config)
    }

    pub fn start_watcher(&self, app: &AppHandle) -> Result<(), IpcError> {
        let root = self.current_path().ok_or(IpcError::NotFound)?;
        let app = app.clone();
        let sink: VaultEventSink = Arc::new(move |event| {
            let _ = app.emit("vault:fileChanged", event);
        });
        self.watcher
            .start(root, Arc::clone(&self.fingerprint_cache), sink)
    }

    pub fn stop_watcher(&self) {
        self.watcher.stop();
    }

    fn persist_current_path(&self, path: Option<&Path>) -> Result<(), IpcError> {
        let mut config = self.load_config()?;
        config.path = path.map(Path::to_path_buf);
        if let Some(path) = path {
            config.recent.retain(|candidate| candidate != path);
            config.recent.insert(0, path.to_path_buf());
            config.recent.truncate(MAX_RECENT_VAULTS);
        }
        self.write_config(&config)
    }

    fn load_config(&self) -> Result<PersistedVault, IpcError> {
        let Some(config_path) = self
            .config_path
            .lock()
            .expect("config path mutex poisoned")
            .clone()
        else {
            return Ok(PersistedVault::default());
        };
        if !config_path.exists() {
            return Ok(PersistedVault::default());
        }
        let text = fs::read_to_string(config_path)?;
        if let Ok(config) = serde_json::from_str::<PersistedVault>(&text) {
            return Ok(config);
        }
        #[derive(Deserialize)]
        struct LegacyPersistedVault {
            path: PathBuf,
        }
        let legacy: LegacyPersistedVault =
            serde_json::from_str(&text).map_err(|err| IpcError::Parse(err.to_string()))?;
        Ok(PersistedVault {
            path: Some(legacy.path.clone()),
            recent: vec![legacy.path],
        })
    }

    fn write_config(&self, config: &PersistedVault) -> Result<(), IpcError> {
        let Some(config_path) = self
            .config_path
            .lock()
            .expect("config path mutex poisoned")
            .clone()
        else {
            return Ok(());
        };
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let payload =
            serde_json::to_string_pretty(config).map_err(|err| IpcError::Other(err.to_string()))?;
        fs::write(config_path, payload)?;
        Ok(())
    }
}

fn vault_display_name(path: &Path) -> String {
    path.components()
        .filter_map(|component| component.as_os_str().to_str())
        .rev()
        .take(2)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join("/")
}

pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let state = app.state::<VaultState>();
    let config_path = app.path().app_data_dir()?.join("vault.json");
    state.set_config_path(config_path);
    if let Some(path) = state.load_persisted_path()? {
        if path.is_dir() {
            state.set_current_path(path)?;
            let app_handle = app.handle().clone();
            if let Some(path) = state.current_path() {
                let assets = app_handle.state::<crate::assets::AssetScopeState>();
                crate::assets::set_scope_for_path(&app_handle, &assets, &path)?;
                if let Err(e) = crate::vcs::git_init_if_needed(&path) {
                    eprintln!("noxe vcs: git init skipped: {e}");
                }
                let remote = app_handle.state::<crate::vcs::remote::RemoteState>();
                let settings = crate::vault::settings::load_vault_settings(&path).ok();
                remote.configure(Some(path.clone()), settings.and_then(|s| s.git_remote));
            }
            state.start_watcher(&app_handle)?;
            if let Some(path) = state.current_path() {
                app_handle.emit("vault:opened", VaultPath { path })?;
            }
        } else {
            state.clear_current_path()?;
        }
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultPath {
    pub path: PathBuf,
}

#[tauri::command]
pub async fn vault_open(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
    path: Option<PathBuf>,
) -> Result<VaultPath, IpcError> {
    let path = match path {
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
    state.set_current_path(path)?;
    if let Some(path) = state.current_path() {
        let assets = app.state::<crate::assets::AssetScopeState>();
        crate::assets::set_scope_for_path(&app, &assets, &path)?;
        if let Err(e) = crate::vcs::git_init_if_needed(&path) {
            eprintln!("noxe vcs: git init skipped: {e}");
        }
        let remote = app.state::<crate::vcs::remote::RemoteState>();
        let settings = crate::vault::settings::load_vault_settings(&path).ok();
        remote.configure(Some(path.clone()), settings.and_then(|s| s.git_remote));
        crate::diagnostics::set_vault_root(Some(&path));
    }
    state.start_watcher(&app)?;
    let path = state.current_path().ok_or(IpcError::NotFound)?;
    let payload = VaultPath { path };
    app.emit("vault:opened", &payload)
        .map_err(|err| IpcError::Other(err.to_string()))?;
    Ok(payload)
}

#[tauri::command]
pub fn vault_close(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
    index: tauri::State<'_, crate::index::IndexState>,
) -> Result<(), IpcError> {
    let previous_path = state.close_current_path()?;
    index.close();
    crate::diagnostics::set_vault_root(None);
    app.emit("vault:closed", VaultClosedEvent { previous_path })
        .map_err(|err| IpcError::Other(err.to_string()))?;
    Ok(())
}

#[tauri::command]
pub fn vault_recent(state: tauri::State<'_, VaultState>) -> Result<Vec<RecentVault>, IpcError> {
    state.recent_vaults()
}

#[tauri::command]
pub fn vault_remove_recent(
    state: tauri::State<'_, VaultState>,
    path: PathBuf,
) -> Result<(), IpcError> {
    state.remove_recent(&path)
}

#[tauri::command]
pub fn vault_settings(state: tauri::State<'_, VaultState>) -> Result<VaultSettings, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    load_vault_settings(&root)
}

#[tauri::command]
pub fn vault_current(state: tauri::State<'_, VaultState>) -> Result<Option<VaultPath>, IpcError> {
    Ok(state.current_path().map(|path| VaultPath { path }))
}

#[tauri::command]
pub fn vault_list(state: tauri::State<'_, VaultState>) -> Result<Vec<NoteEntry>, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    list::list(&root)
}

#[tauri::command]
pub fn vault_watcher_start(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
) -> Result<(), IpcError> {
    state.start_watcher(&app)
}

#[tauri::command]
pub fn vault_watcher_stop(state: tauri::State<'_, VaultState>) -> Result<(), IpcError> {
    state.stop_watcher();
    Ok(())
}

#[tauri::command]
pub fn notes_read(path: PathBuf) -> Result<NoteFile, IpcError> {
    io::read_note(&path)
}

#[tauri::command]
pub fn notes_save(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
    vcs_state: tauri::State<'_, crate::vcs::VcsState>,
    input: SaveInput,
) -> Result<SaveResult, IpcError> {
    let result = io::save_atomic(&input, &state.fingerprint_cache)?;
    let metadata = fs::metadata(&result.path)?;
    let event = VaultFileChangedEvent {
        path: result.path.clone(),
        kind: FileChangeKind::Modified,
        source: FileChangeSource::Internal,
        mtime: result.mtime,
        size: metadata.len(),
    };
    app.emit("vault:fileChanged", event)
        .map_err(|err| IpcError::Other(err.to_string()))?;
    crate::vcs::on_note_saved(&vcs_state, &state, &result.path, false);
    Ok(result)
}

#[tauri::command]
pub fn notes_create(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
    vcs_state: tauri::State<'_, crate::vcs::VcsState>,
    folder: String,
    title: Option<String>,
) -> Result<VaultPath, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    let folder_path = resolve_folder(&root, &folder);
    let path = io::create_note(&CreateNoteInput {
        folder: folder_path,
        title,
    })?;
    let metadata = fs::metadata(&path)?;
    let mtime = io::metadata_mtime_ms(&metadata)?;
    app.emit(
        "vault:fileChanged",
        VaultFileChangedEvent {
            path: path.clone(),
            kind: FileChangeKind::Created,
            source: FileChangeSource::Internal,
            mtime,
            size: metadata.len(),
        },
    )
    .map_err(|err| IpcError::Other(err.to_string()))?;
    crate::vcs::on_note_saved(&vcs_state, &state, &path, true);
    Ok(VaultPath { path })
}

#[tauri::command]
pub fn notes_rename(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
    old_path: PathBuf,
    new_name: String,
    rewrite: Option<bool>,
) -> Result<VaultPath, IpcError> {
    let vault_root = state.current_path().ok_or(IpcError::NotFound)?;
    let new_path = io::rename_note(&old_path, &new_name)?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| IpcError::Other(err.to_string()))?;
    let rewritten = rename_propagation::rewrite_after_rename(
        &app_data_dir,
        &vault_root,
        &old_path,
        &new_path,
        rewrite.unwrap_or(true),
        &state.fingerprint_cache,
    )?;
    for result in rewritten {
        let metadata = fs::metadata(&result.path)?;
        app.emit(
            "vault:fileChanged",
            VaultFileChangedEvent {
                path: result.path,
                kind: FileChangeKind::Modified,
                source: FileChangeSource::Internal,
                mtime: result.mtime,
                size: metadata.len(),
            },
        )
        .map_err(|err| IpcError::Other(err.to_string()))?;
    }
    app.emit(
        "vault:fileRenamed",
        VaultFileRenamedEvent {
            old_path,
            new_path: new_path.clone(),
        },
    )
    .map_err(|err| IpcError::Other(err.to_string()))?;
    Ok(VaultPath { path: new_path })
}

#[tauri::command]
pub fn notes_trash(app: AppHandle, path: PathBuf) -> Result<(), IpcError> {
    io::trash_note(&path)?;
    app.emit(
        "vault:fileChanged",
        VaultFileChangedEvent {
            path,
            kind: FileChangeKind::Removed,
            source: FileChangeSource::Internal,
            mtime: 0,
            size: 0,
        },
    )
    .map_err(|err| IpcError::Other(err.to_string()))
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultFileRenamedEvent {
    pub old_path: PathBuf,
    pub new_path: PathBuf,
}

fn resolve_folder(root: &Path, folder: &str) -> PathBuf {
    let folder_path = PathBuf::from(folder);
    if folder_path.is_absolute() {
        folder_path
    } else {
        root.join(folder_path)
    }
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::*;

    #[test]
    fn current_path_round_trips_through_json_config() {
        let dir = tempdir().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir(&vault).unwrap();
        let state = VaultState::default();
        state.set_config_path(dir.path().join("vault.json"));

        state.set_current_path(vault.clone()).unwrap();
        assert_eq!(state.current_path().unwrap(), vault.canonicalize().unwrap());
        assert_eq!(
            state.load_persisted_path().unwrap().unwrap(),
            vault.canonicalize().unwrap()
        );
        let recent = state.recent_vaults().unwrap();
        assert_eq!(recent.len(), 1);
        assert_eq!(recent[0].path, vault.canonicalize().unwrap());

        let previous = state.close_current_path().unwrap();
        assert_eq!(previous.unwrap(), vault.canonicalize().unwrap());
        assert!(state.load_persisted_path().unwrap().is_none());
        assert_eq!(state.recent_vaults().unwrap().len(), 1);
    }

    #[test]
    fn missing_vault_clears_current_path_and_returns_not_found() {
        let dir = tempdir().unwrap();
        let state = VaultState::default();
        let config = dir.path().join("vault.json");
        state.set_config_path(config.clone());

        let err = state
            .set_current_path(dir.path().join("missing"))
            .unwrap_err();

        assert!(matches!(err, IpcError::NotFound));
        assert!(state.load_persisted_path().unwrap().is_none());
    }

    #[test]
    fn relative_folder_resolves_under_root() {
        let root = PathBuf::from("/vault");
        assert_eq!(
            resolve_folder(&root, "daily"),
            PathBuf::from("/vault/daily")
        );
    }
}
