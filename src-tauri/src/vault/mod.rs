pub mod fingerprint;
pub mod frontmatter;
pub mod io;
pub mod list;
pub mod watcher;

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

use crate::vault::fingerprint::FingerprintCache;
use crate::vault::io::CreateNoteInput;
use crate::vault::watcher::{FileChangeKind, FileChangeSource, VaultEventSink, VaultFileChangedEvent, WatcherController};
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedVault {
    path: PathBuf,
}

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
        self.persist_current_path(&canonical)?;
        Ok(())
    }

    pub fn clear_current_path(&self) -> Result<(), IpcError> {
        *self.current_path.lock().expect("vault path mutex poisoned") = None;
        self.watcher.stop();
        if let Some(config_path) = self.config_path.lock().expect("config path mutex poisoned").clone() {
            if config_path.exists() {
                fs::remove_file(config_path)?;
            }
        }
        Ok(())
    }

    pub fn load_persisted_path(&self) -> Result<Option<PathBuf>, IpcError> {
        let Some(config_path) = self.config_path.lock().expect("config path mutex poisoned").clone() else {
            return Ok(None);
        };
        if !config_path.exists() {
            return Ok(None);
        }
        let text = fs::read_to_string(config_path)?;
        let persisted: PersistedVault = serde_json::from_str(&text)
            .map_err(|err| IpcError::Parse(err.to_string()))?;
        Ok(Some(persisted.path))
    }

    pub fn start_watcher(&self, app: &AppHandle) -> Result<(), IpcError> {
        let root = self.current_path().ok_or(IpcError::NotFound)?;
        let app = app.clone();
        let sink: VaultEventSink = Arc::new(move |event| {
            let _ = app.emit("vault.fileChanged", event);
        });
        self.watcher
            .start(root, Arc::clone(&self.fingerprint_cache), sink)
    }

    pub fn stop_watcher(&self) {
        self.watcher.stop();
    }

    fn persist_current_path(&self, path: &Path) -> Result<(), IpcError> {
        let Some(config_path) = self.config_path.lock().expect("config path mutex poisoned").clone() else {
            return Ok(());
        };
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let payload = serde_json::to_string_pretty(&PersistedVault {
            path: path.to_path_buf(),
        })
        .map_err(|err| IpcError::Other(err.to_string()))?;
        fs::write(config_path, payload)?;
        Ok(())
    }
}

pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let state = app.state::<VaultState>();
    let config_path = app.path().app_data_dir()?.join("vault.json");
    state.set_config_path(config_path);
    if let Some(path) = state.load_persisted_path()? {
        if path.is_dir() {
            state.set_current_path(path)?;
            let app_handle = app.handle().clone();
            state.start_watcher(&app_handle)?;
            if let Some(path) = state.current_path() {
                app_handle.emit("vault.opened", VaultPath { path })?;
            }
        } else {
            state.clear_current_path()?;
        }
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultPath {
    pub path: PathBuf,
}

#[tauri::command]
pub fn vault_open(app: AppHandle, state: tauri::State<'_, VaultState>) -> Result<VaultPath, IpcError> {
    let folder = app
        .dialog()
        .file()
        .blocking_pick_folder()
        .ok_or_else(|| IpcError::Other("folder selection cancelled".to_string()))?;
    let path = folder
        .into_path()
        .map_err(|err| IpcError::Io(err.to_string()))?;
    state.set_current_path(path)?;
    state.start_watcher(&app)?;
    let path = state.current_path().ok_or(IpcError::NotFound)?;
    let payload = VaultPath { path };
    app.emit("vault.opened", &payload)
        .map_err(|err| IpcError::Other(err.to_string()))?;
    Ok(payload)
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
    app.emit("vault.fileChanged", event)
        .map_err(|err| IpcError::Other(err.to_string()))?;
    Ok(result)
}

#[tauri::command]
pub fn notes_create(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
    folder: String,
    title: Option<String>,
) -> Result<VaultPath, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    let folder_path = resolve_folder(&root, &folder);
    let path = io::create_note(&CreateNoteInput { folder: folder_path, title })?;
    let metadata = fs::metadata(&path)?;
    let mtime = io::metadata_mtime_ms(&metadata)?;
    app.emit(
        "vault.fileChanged",
        VaultFileChangedEvent {
            path: path.clone(),
            kind: FileChangeKind::Created,
            source: FileChangeSource::Internal,
            mtime,
            size: metadata.len(),
        },
    )
    .map_err(|err| IpcError::Other(err.to_string()))?;
    Ok(VaultPath { path })
}

#[tauri::command]
pub fn notes_rename(
    app: AppHandle,
    old_path: PathBuf,
    new_name: String,
) -> Result<VaultPath, IpcError> {
    let new_path = io::rename_note(&old_path, &new_name)?;
    app.emit(
        "vault.fileRenamed",
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
        "vault.fileChanged",
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
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
        assert_eq!(state.load_persisted_path().unwrap().unwrap(), vault.canonicalize().unwrap());
    }

    #[test]
    fn missing_vault_clears_config_and_returns_not_found() {
        let dir = tempdir().unwrap();
        let state = VaultState::default();
        let config = dir.path().join("vault.json");
        state.set_config_path(config.clone());

        let err = state.set_current_path(dir.path().join("missing")).unwrap_err();

        assert!(matches!(err, IpcError::NotFound));
        assert!(!config.exists());
    }

    #[test]
    fn relative_folder_resolves_under_root() {
        let root = PathBuf::from("/vault");
        assert_eq!(resolve_folder(&root, "daily"), PathBuf::from("/vault/daily"));
    }
}
