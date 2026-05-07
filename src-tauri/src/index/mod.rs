pub mod migrate;
pub mod parser;
pub mod paths;
pub mod query;
pub mod resolver;
pub mod search;
pub mod worker;

use std::path::{Path, PathBuf};
use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex};

use rusqlite::Connection;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Listener, Manager};

use crate::index::migrate::open_index_at;
use crate::index::paths::index_db_path;
use crate::index::query::{GraphData, LinkRow, TagCount};
use crate::index::search::SearchResult;
use crate::index::worker::IndexJob;
use crate::vault::watcher::{FileChangeKind, VaultFileChangedEvent};
use crate::vault::{NoteEntry, VaultFileRenamedEvent, VaultPath, VaultState};
use crate::IpcError;

#[derive(Default)]
pub struct IndexState {
    app_data_dir: Mutex<Option<PathBuf>>,
    runtime: Mutex<Option<IndexRuntime>>,
}

struct IndexRuntime {
    vault_path: PathBuf,
    conn: Mutex<Connection>,
    sender: Sender<IndexJob>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexStatus {
    pub ready: bool,
    pub vault_path: Option<PathBuf>,
    pub indexed_notes: i64,
    pub pending_jobs: usize,
}

impl IndexState {
    pub fn set_app_data_dir(&self, path: PathBuf) {
        *self
            .app_data_dir
            .lock()
            .expect("index app-data mutex poisoned") = Some(path);
    }

    pub fn configure_for_vault(&self, app: &AppHandle, vault_path: &Path) -> Result<(), IpcError> {
        let vault_path = vault_path.canonicalize()?;
        let mut runtime = self.runtime.lock().expect("index runtime mutex poisoned");
        if runtime
            .as_ref()
            .is_some_and(|current| current.vault_path == vault_path)
        {
            return Ok(());
        }

        if let Some(current) = runtime.take() {
            let _ = current.sender.send(IndexJob::Shutdown);
        }

        let app_data_dir = self
            .app_data_dir
            .lock()
            .expect("index app-data mutex poisoned")
            .clone()
            .ok_or_else(|| IpcError::Other("index app data dir not configured".to_string()))?;
        let db_path = index_db_path(&app_data_dir, &vault_path);
        let conn = open_index_at(&db_path)?;
        let progress_app = app.clone();
        let progress_sink: worker::ProgressSink = Arc::new(move |progress| {
            let _ = progress_app.emit("index:progress", progress);
        });
        let error_app = app.clone();
        let error_sink: worker::ErrorSink = Arc::new(move |message| {
            let _ = error_app.emit("index:error", IndexErrorEvent { message });
        });
        let update_app = app.clone();
        let update_sink: worker::UpdateSink = Arc::new(move || {
            let _ = update_app.emit("index:updated", ());
        });
        let sender = worker::spawn_worker(
            db_path,
            vault_path.clone(),
            Some(progress_sink),
            Some(error_sink),
            Some(update_sink),
        );
        sender
            .send(IndexJob::BuildAll)
            .map_err(|err| IpcError::Other(err.to_string()))?;
        *runtime = Some(IndexRuntime {
            vault_path: vault_path.clone(),
            conn: Mutex::new(conn),
            sender,
        });
        app.emit("index:ready", self.status_for_runtime(runtime.as_ref()))
            .map_err(|err| IpcError::Other(err.to_string()))?;
        Ok(())
    }

    fn with_conn<T>(
        &self,
        app: &AppHandle,
        vault: &VaultState,
        f: impl FnOnce(&Connection) -> Result<T, IpcError>,
    ) -> Result<T, IpcError> {
        let vault_path = vault.current_path().ok_or(IpcError::NotFound)?;
        self.configure_for_vault(app, &vault_path)?;
        let runtime = self.runtime.lock().expect("index runtime mutex poisoned");
        let runtime = runtime.as_ref().ok_or(IpcError::NotFound)?;
        let conn = runtime
            .conn
            .lock()
            .expect("index connection mutex poisoned");
        f(&conn)
    }

    fn send_job(&self, app: &AppHandle, vault: &VaultState, job: IndexJob) -> Result<(), IpcError> {
        let vault_path = vault.current_path().ok_or(IpcError::NotFound)?;
        self.configure_for_vault(app, &vault_path)?;
        let runtime = self.runtime.lock().expect("index runtime mutex poisoned");
        let runtime = runtime.as_ref().ok_or(IpcError::NotFound)?;
        runtime
            .sender
            .send(job)
            .map_err(|err| IpcError::Other(err.to_string()))
    }

    pub fn close(&self) {
        let mut runtime = self.runtime.lock().expect("index runtime mutex poisoned");
        if let Some(current) = runtime.take() {
            let _ = current.sender.send(IndexJob::Shutdown);
        }
    }

    fn status(&self) -> IndexStatus {
        let runtime = self.runtime.lock().expect("index runtime mutex poisoned");
        self.status_for_runtime(runtime.as_ref())
    }

    fn status_for_runtime(&self, runtime: Option<&IndexRuntime>) -> IndexStatus {
        let Some(runtime) = runtime else {
            return IndexStatus {
                ready: false,
                vault_path: None,
                indexed_notes: 0,
                pending_jobs: 0,
            };
        };
        let indexed_notes = runtime
            .conn
            .lock()
            .expect("index connection mutex poisoned")
            .query_row("SELECT count(*) FROM notes", [], |row| row.get(0))
            .unwrap_or(0);
        IndexStatus {
            ready: true,
            vault_path: Some(runtime.vault_path.clone()),
            indexed_notes,
            pending_jobs: 0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct IndexErrorEvent {
    message: String,
}

pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    let state = app.state::<IndexState>();
    state.set_app_data_dir(app_data_dir);

    let app_handle = app.handle().clone();
    app.listen("vault:opened", move |event| {
        if let Ok(payload) = serde_json::from_str::<VaultPath>(event.payload()) {
            let state = app_handle.state::<IndexState>();
            let _ = state.configure_for_vault(&app_handle, &payload.path);
        }
    });

    let app_handle = app.handle().clone();
    app.listen("vault:fileChanged", move |event| {
        if let Ok(payload) = serde_json::from_str::<VaultFileChangedEvent>(event.payload()) {
            let state = app_handle.state::<IndexState>();
            let vault = app_handle.state::<VaultState>();
            let job = match payload.kind {
                FileChangeKind::Created | FileChangeKind::Modified => {
                    IndexJob::Upsert(payload.path)
                }
                FileChangeKind::Removed => IndexJob::Remove(payload.path),
            };
            let _ = state.send_job(&app_handle, &vault, job);
        }
    });

    let app_handle = app.handle().clone();
    app.listen("vault:fileRenamed", move |event| {
        if let Ok(payload) = serde_json::from_str::<VaultFileRenamedEvent>(event.payload()) {
            let state = app_handle.state::<IndexState>();
            let vault = app_handle.state::<VaultState>();
            let _ = state.send_job(
                &app_handle,
                &vault,
                IndexJob::Rename {
                    old_path: payload.old_path,
                    new_path: payload.new_path,
                },
            );
        }
    });

    let vault = app.state::<VaultState>();
    if let Some(path) = vault.current_path() {
        let app_handle = app.handle().clone();
        app.state::<IndexState>()
            .configure_for_vault(&app_handle, &path)?;
    }
    Ok(())
}

#[tauri::command]
pub fn notes_recent(
    app: AppHandle,
    vault: tauri::State<'_, VaultState>,
    state: tauri::State<'_, IndexState>,
    limit: Option<usize>,
) -> Result<Vec<NoteEntry>, IpcError> {
    state.with_conn(&app, &vault, |conn| query::recent(conn, limit))
}

#[tauri::command]
pub fn notes_all_paged(
    app: AppHandle,
    vault: tauri::State<'_, VaultState>,
    state: tauri::State<'_, IndexState>,
    offset: usize,
    limit: usize,
) -> Result<Vec<NoteEntry>, IpcError> {
    state.with_conn(&app, &vault, |conn| query::all_paged(conn, offset, limit))
}

#[tauri::command]
pub fn notes_by_tag(
    app: AppHandle,
    vault: tauri::State<'_, VaultState>,
    state: tauri::State<'_, IndexState>,
    tag: String,
) -> Result<Vec<NoteEntry>, IpcError> {
    state.with_conn(&app, &vault, |conn| query::by_tag(conn, &tag))
}

#[tauri::command]
pub fn notes_by_folder(
    app: AppHandle,
    vault: tauri::State<'_, VaultState>,
    state: tauri::State<'_, IndexState>,
    folder: String,
) -> Result<Vec<NoteEntry>, IpcError> {
    state.with_conn(&app, &vault, |conn| query::by_folder(conn, &folder))
}

#[tauri::command]
pub fn notes_by_id(
    app: AppHandle,
    vault: tauri::State<'_, VaultState>,
    state: tauri::State<'_, IndexState>,
    id: String,
) -> Result<Option<NoteEntry>, IpcError> {
    state.with_conn(&app, &vault, |conn| query::by_id(conn, &id))
}

#[tauri::command]
pub fn notes_starred(
    app: AppHandle,
    vault: tauri::State<'_, VaultState>,
    state: tauri::State<'_, IndexState>,
) -> Result<Vec<NoteEntry>, IpcError> {
    state.with_conn(&app, &vault, query::starred)
}

#[tauri::command]
pub fn tags_list(
    app: AppHandle,
    vault: tauri::State<'_, VaultState>,
    state: tauri::State<'_, IndexState>,
) -> Result<Vec<TagCount>, IpcError> {
    state.with_conn(&app, &vault, query::tags_list)
}

#[tauri::command]
pub fn links_outgoing(
    app: AppHandle,
    vault: tauri::State<'_, VaultState>,
    state: tauri::State<'_, IndexState>,
    note_id: String,
) -> Result<Vec<LinkRow>, IpcError> {
    state.with_conn(&app, &vault, |conn| query::links_outgoing(conn, &note_id))
}

#[tauri::command]
pub fn links_incoming(
    app: AppHandle,
    vault: tauri::State<'_, VaultState>,
    state: tauri::State<'_, IndexState>,
    note_id: String,
) -> Result<Vec<LinkRow>, IpcError> {
    state.with_conn(&app, &vault, |conn| query::links_incoming(conn, &note_id))
}

#[tauri::command]
pub fn links_graph(
    app: AppHandle,
    vault: tauri::State<'_, VaultState>,
    state: tauri::State<'_, IndexState>,
) -> Result<GraphData, IpcError> {
    state.with_conn(&app, &vault, query::graph)
}

#[tauri::command]
pub fn notes_search(
    app: AppHandle,
    vault: tauri::State<'_, VaultState>,
    state: tauri::State<'_, IndexState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, IpcError> {
    state.with_conn(&app, &vault, |conn| search::search(conn, &query, limit))
}

#[tauri::command]
pub fn index_search(
    app: AppHandle,
    vault: tauri::State<'_, VaultState>,
    state: tauri::State<'_, IndexState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, IpcError> {
    notes_search(app, vault, state, query, limit)
}

#[tauri::command]
pub fn index_status(state: tauri::State<'_, IndexState>) -> Result<IndexStatus, IpcError> {
    Ok(state.status())
}

#[tauri::command]
pub fn index_rebuild(
    app: AppHandle,
    vault: tauri::State<'_, VaultState>,
    state: tauri::State<'_, IndexState>,
) -> Result<(), IpcError> {
    state.send_job(&app, &vault, IndexJob::BuildAll)
}
