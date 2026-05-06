use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tauri::{AppHandle, Emitter};

use crate::vault::io::{metadata_mtime_ms, read_note, save_atomic, trash_note};
use crate::vault::watcher::{FileChangeKind, FileChangeSource, VaultFileChangedEvent};
use crate::vault::{SaveInput, VaultFileRenamedEvent, VaultPath, VaultState};
use crate::IpcError;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkFailure {
    pub path: PathBuf,
    pub error: IpcError,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkPathResult {
    pub ok: Vec<PathBuf>,
    pub failed: Vec<BulkFailure>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontmatterPatch(pub Map<String, Value>);

#[tauri::command]
pub fn notes_move(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
    note_path: PathBuf,
    dest_folder: PathBuf,
) -> Result<VaultPath, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    let note_path = resolve_existing_file(&root, &note_path)?;
    let dest_folder = resolve_existing_folder(&root, &dest_folder)?;
    let path = move_note(&note_path, &dest_folder)?;
    emit_file_renamed(&app, note_path, path.clone())?;
    Ok(VaultPath { path })
}

#[tauri::command]
pub fn notes_bulk_move(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
    paths: Vec<PathBuf>,
    dest_folder: PathBuf,
) -> Result<BulkPathResult, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    let dest_folder = resolve_existing_folder(&root, &dest_folder)?;
    let mut result = BulkPathResult { ok: Vec::new(), failed: Vec::new() };
    for path in paths {
        let resolved = match resolve_existing_file(&root, &path) {
            Ok(path) => path,
            Err(error) => {
                result.failed.push(BulkFailure { path, error });
                continue;
            }
        };
        match move_note(&resolved, &dest_folder) {
            Ok(new_path) => {
                emit_file_renamed(&app, resolved, new_path.clone())?;
                result.ok.push(new_path);
            }
            Err(error) => result.failed.push(BulkFailure { path: resolved, error }),
        }
    }
    Ok(result)
}

#[tauri::command]
pub fn notes_bulk_trash(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
    paths: Vec<PathBuf>,
) -> Result<BulkPathResult, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    let mut result = BulkPathResult { ok: Vec::new(), failed: Vec::new() };
    for path in paths {
        let resolved = match resolve_existing_file(&root, &path) {
            Ok(path) => path,
            Err(error) => {
                result.failed.push(BulkFailure { path, error });
                continue;
            }
        };
        match trash_note(&resolved) {
            Ok(()) => {
                emit_file_changed(&app, resolved.clone(), FileChangeKind::Removed, 0, 0)?;
                result.ok.push(resolved);
            }
            Err(error) => result.failed.push(BulkFailure { path: resolved, error }),
        }
    }
    Ok(result)
}

#[tauri::command]
pub fn notes_bulk_set_frontmatter(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
    paths: Vec<PathBuf>,
    patch: FrontmatterPatch,
) -> Result<BulkPathResult, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    let mut result = BulkPathResult { ok: Vec::new(), failed: Vec::new() };
    for path in paths {
        let resolved = match resolve_existing_file(&root, &path) {
            Ok(path) => path,
            Err(error) => {
                result.failed.push(BulkFailure { path, error });
                continue;
            }
        };
        match apply_frontmatter_patch(&resolved, &patch.0, &state) {
            Ok(()) => {
                let metadata = fs::metadata(&resolved)?;
                emit_file_changed(
                    &app,
                    resolved.clone(),
                    FileChangeKind::Modified,
                    metadata_mtime_ms(&metadata)?,
                    metadata.len(),
                )?;
                result.ok.push(resolved);
            }
            Err(error) => result.failed.push(BulkFailure { path: resolved, error }),
        }
    }
    Ok(result)
}

pub fn move_note(note_path: &Path, dest_folder: &Path) -> Result<PathBuf, IpcError> {
    ensure_markdown_file(note_path)?;
    ensure_directory(dest_folder)?;
    let file_name = note_path
        .file_name()
        .ok_or_else(|| IpcError::Io("note path has no final segment".to_string()))?;
    let dest = dest_folder.join(file_name);
    if same_path(note_path, &dest) {
        return Ok(note_path.to_path_buf());
    }
    if dest.exists() {
        return Err(IpcError::Conflict { current_mtime: 0 });
    }
    move_file_with_fallback(note_path, &dest)?;
    Ok(dest)
}

pub fn apply_frontmatter_patch(path: &Path, patch: &Map<String, Value>, state: &VaultState) -> Result<(), IpcError> {
    let mut note = read_note(path)?;
    let mut frontmatter = note.frontmatter.as_object().cloned().unwrap_or_default();
    for (key, value) in patch {
        if value.is_null() {
            frontmatter.remove(key);
        } else {
            frontmatter.insert(key.clone(), value.clone());
        }
    }
    note.frontmatter = Value::Object(frontmatter);
    save_atomic(
        &SaveInput {
            path: note.path,
            frontmatter: note.frontmatter,
            body: note.body,
            expected_mtime: None,
        },
        &state.fingerprint_cache,
    )?;
    Ok(())
}

fn resolve_existing_file(root: &Path, input: &Path) -> Result<PathBuf, IpcError> {
    let path = resolve_under_root(root, input)?;
    ensure_markdown_file(&path)?;
    Ok(path)
}

fn resolve_existing_folder(root: &Path, input: &Path) -> Result<PathBuf, IpcError> {
    let path = resolve_under_root(root, input)?;
    ensure_directory(&path)?;
    Ok(path)
}

fn resolve_under_root(root: &Path, input: &Path) -> Result<PathBuf, IpcError> {
    let path = if input.is_absolute() { input.to_path_buf() } else { root.join(input) };
    let canonical = path.canonicalize().map_err(map_not_found)?;
    let root = root.canonicalize()?;
    if canonical.starts_with(root) {
        Ok(canonical)
    } else {
        Err(IpcError::NotFound)
    }
}

fn ensure_markdown_file(path: &Path) -> Result<(), IpcError> {
    if !path.exists() {
        return Err(IpcError::NotFound);
    }
    if !path.is_file()
        || !path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
    {
        return Err(IpcError::Io("path is not a Markdown note".to_string()));
    }
    Ok(())
}

fn ensure_directory(path: &Path) -> Result<(), IpcError> {
    if !path.exists() {
        return Err(IpcError::NotFound);
    }
    if !path.is_dir() {
        return Err(IpcError::Io("path is not a directory".to_string()));
    }
    Ok(())
}

fn move_file_with_fallback(src: &Path, dest: &Path) -> Result<(), IpcError> {
    match fs::rename(src, dest) {
        Ok(()) => Ok(()),
        Err(_) => {
            fs::copy(src, dest)?;
            if let Err(remove_err) = fs::remove_file(src) {
                let _ = fs::remove_file(dest);
                return Err(IpcError::Io(remove_err.to_string()));
            }
            Ok(())
        }
    }
}

fn emit_file_renamed(app: &AppHandle, old_path: PathBuf, new_path: PathBuf) -> Result<(), IpcError> {
    app.emit("vault.fileRenamed", VaultFileRenamedEvent { old_path, new_path })
        .map_err(|err| IpcError::Other(err.to_string()))
}

fn emit_file_changed(
    app: &AppHandle,
    path: PathBuf,
    kind: FileChangeKind,
    mtime: i64,
    size: u64,
) -> Result<(), IpcError> {
    app.emit(
        "vault.fileChanged",
        VaultFileChangedEvent { path, kind, source: FileChangeSource::Internal, mtime, size },
    )
    .map_err(|err| IpcError::Other(err.to_string()))
}

fn same_path(left: &Path, right: &Path) -> bool {
    left.canonicalize().ok() == right.canonicalize().ok()
}

fn map_not_found(err: std::io::Error) -> IpcError {
    if err.kind() == std::io::ErrorKind::NotFound {
        IpcError::NotFound
    } else {
        IpcError::Io(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::*;

    #[test]
    fn moves_note_to_destination_folder() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("note.md");
        let dest_folder = dir.path().join("dest");
        fs::create_dir(&dest_folder).unwrap();
        fs::write(&src, "body").unwrap();

        let moved = move_note(&src, &dest_folder).unwrap();

        assert_eq!(moved, dest_folder.join("note.md"));
        assert_eq!(fs::read_to_string(moved).unwrap(), "body");
        assert!(!src.exists());
    }

    #[test]
    fn move_note_rejects_name_conflict() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("note.md");
        let dest_folder = dir.path().join("dest");
        fs::create_dir(&dest_folder).unwrap();
        fs::write(&src, "body").unwrap();
        fs::write(dest_folder.join("note.md"), "existing").unwrap();

        assert!(matches!(move_note(&src, &dest_folder), Err(IpcError::Conflict { .. })));
    }

    #[test]
    fn move_note_rejects_non_markdown() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("note.txt");
        fs::write(&src, "body").unwrap();
        assert!(matches!(move_note(&src, dir.path()), Err(IpcError::Io(_))));
    }

    #[test]
    fn copy_fallback_preserves_file_contents() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("note.md");
        let dest = dir.path().join("dest.md");
        fs::write(&src, "body").unwrap();
        move_file_with_fallback(&src, &dest).unwrap();
        assert_eq!(fs::read_to_string(dest).unwrap(), "body");
        assert!(!src.exists());
    }

    #[test]
    fn frontmatter_patch_sets_and_removes_keys() {
        let dir = tempdir().unwrap();
        let state = VaultState::default();
        let note = dir.path().join("note.md");
        fs::write(&note, "---\npinned: true\ntags:\n  - old\n---\n# Body\n").unwrap();
        let mut patch = Map::new();
        patch.insert("pinned".to_string(), Value::Null);
        patch.insert("starred".to_string(), Value::Bool(true));

        apply_frontmatter_patch(&note, &patch, &state).unwrap();
        let written = fs::read_to_string(note).unwrap();

        assert!(!written.contains("pinned"));
        assert!(written.contains("starred: true"));
    }
}
