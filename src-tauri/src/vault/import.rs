//! Import an external folder (e.g. an Obsidian vault) into the current vault.
//!
//! Obsidian vaults are already plain `.md` + attachments, so importing is a
//! structure-preserving copy of Markdown notes and known asset files. Hidden
//! folders (`.obsidian`, `.git`, `.trash`, …) are skipped, and existing files
//! are never overwritten. The file watcher reindexes the copied notes.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use walkdir::WalkDir;

use crate::vault::list::{asset_kind, is_markdown};
use crate::vault::VaultState;
use crate::IpcError;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: usize,
    pub skipped: usize,
}

#[tauri::command]
pub async fn vault_import_folder(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
    source: Option<PathBuf>,
) -> Result<ImportResult, IpcError> {
    let source = match source {
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

    let root = state
        .current_path()
        .ok_or(IpcError::NotFound)?
        .canonicalize()?;
    let source = source.canonicalize()?;
    if source == root {
        return Err(IpcError::Io("cannot import a vault into itself".to_string()));
    }

    let mut imported = 0usize;
    let mut skipped = 0usize;

    for entry in WalkDir::new(&source)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| entry.depth() == 0 || !is_hidden(entry.path()))
    {
        let entry = entry.map_err(|err| IpcError::Io(err.to_string()))?;
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        // Skip anything already inside the destination vault (overlapping trees).
        if path.starts_with(&root) {
            skipped += 1;
            continue;
        }
        if !(is_markdown(path) || asset_kind(path).is_some()) {
            skipped += 1;
            continue;
        }
        let Ok(rel) = path.strip_prefix(&source) else {
            skipped += 1;
            continue;
        };
        let dest = root.join(rel);
        if dest.exists() {
            skipped += 1;
            continue;
        }
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(path, &dest)?;
        imported += 1;
    }

    Ok(ImportResult { imported, skipped })
}

fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.starts_with('.'))
        .unwrap_or(false)
}
