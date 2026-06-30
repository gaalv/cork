use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::vault::io::{map_not_found, same_path, to_slash_string};
use crate::vault::settings::load_vault_settings;
use crate::vault::watcher::FileChangeSource;
use crate::vault::{VaultPath, VaultState};
use crate::IpcError;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultFolderChangedEvent {
    pub path: PathBuf,
    pub old_path: Option<PathBuf>,
    pub kind: FolderChangeKind,
    pub source: FileChangeSource,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FolderChangeKind {
    Created,
    Renamed,
    Moved,
    Removed,
}

#[tauri::command]
pub fn folders_list(state: tauri::State<'_, VaultState>) -> Result<Vec<String>, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    let root = root.canonicalize()?;
    let attachments_folder = load_vault_settings(&root)
        .ok()
        .and_then(|s| s.attachments_folder)
        .unwrap_or_else(|| "_attachments".to_string());
    let mut folders: Vec<String> = Vec::new();
    for entry in walkdir::WalkDir::new(&root)
        .follow_links(false)
        .min_depth(1)
        .into_iter()
        .filter_entry(|entry| {
            let name = entry.file_name().to_str().unwrap_or("");
            !name.starts_with('.') && name != attachments_folder && name != "_archived"
        })
    {
        let entry = match entry {
            Ok(entry) => entry,
            Err(err) => return Err(IpcError::Io(err.to_string())),
        };
        if !entry.file_type().is_dir() {
            continue;
        }
        let rel = match entry.path().strip_prefix(&root) {
            Ok(rel) => rel,
            Err(_) => continue,
        };
        let slash = to_slash_string(rel);
        if !slash.is_empty() {
            folders.push(slash);
        }
    }
    folders.sort();
    folders.dedup();
    Ok(folders)
}

#[tauri::command]
pub fn folders_create(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
    parent: PathBuf,
    name: String,
) -> Result<VaultPath, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    let parent = resolve_folder_path(&root, &parent)?;
    let path = create_folder(&parent, &name)?;
    emit_folder_changed(&app, path.clone(), None, FolderChangeKind::Created)?;
    Ok(VaultPath { path })
}

#[tauri::command]
pub fn folders_rename(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
    old_path: PathBuf,
    new_name: String,
) -> Result<VaultPath, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    let old_path = resolve_folder_path(&root, &old_path)?;
    let path = rename_folder(&old_path, &new_name)?;
    emit_folder_changed(
        &app,
        path.clone(),
        Some(old_path),
        FolderChangeKind::Renamed,
    )?;
    Ok(VaultPath { path })
}

#[tauri::command]
pub fn folders_move(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
    src_path: PathBuf,
    dest_parent: PathBuf,
) -> Result<VaultPath, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    let src_path = resolve_folder_path(&root, &src_path)?;
    let dest_parent = resolve_folder_path(&root, &dest_parent)?;
    let path = move_folder(&src_path, &dest_parent)?;
    emit_folder_changed(&app, path.clone(), Some(src_path), FolderChangeKind::Moved)?;
    Ok(VaultPath { path })
}

#[tauri::command]
pub fn folders_trash(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
    path: PathBuf,
) -> Result<(), IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    let path = resolve_folder_path(&root, &path)?;
    trash_folder(&path)?;
    emit_folder_changed(&app, path, None, FolderChangeKind::Removed)
}

pub fn create_folder(parent: &Path, name: &str) -> Result<PathBuf, IpcError> {
    validate_folder_name(name)?;
    ensure_directory(parent)?;
    let path = parent.join(name.trim());
    if path.exists() {
        return Err(IpcError::Conflict { current_mtime: 0 });
    }
    fs::create_dir(&path)?;
    Ok(path)
}

pub fn rename_folder(old_path: &Path, new_name: &str) -> Result<PathBuf, IpcError> {
    validate_folder_name(new_name)?;
    ensure_directory(old_path)?;
    let parent = old_path
        .parent()
        .ok_or_else(|| IpcError::Io("folder path has no parent directory".to_string()))?;
    let new_path = parent.join(new_name.trim());
    let old_name = old_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");
    let is_case_only = old_name.eq_ignore_ascii_case(new_name.trim()) && old_name != new_name.trim();
    if !is_case_only && same_path(old_path, &new_path) {
        return Ok(old_path.to_path_buf());
    }
    if !is_case_only && new_path.exists() {
        return Err(IpcError::Conflict { current_mtime: 0 });
    }
    if is_case_only {
        // Case-insensitive FS (macOS APFS): rename via temp to change casing
        let tmp_path = parent.join(format!("{}__tmp_rename", new_name.trim()));
        fs::rename(old_path, &tmp_path).map_err(map_not_found)?;
        fs::rename(&tmp_path, &new_path).map_err(map_not_found)?;
    } else {
        fs::rename(old_path, &new_path).map_err(map_not_found)?;
    }
    Ok(new_path)
}

pub fn move_folder(src_path: &Path, dest_parent: &Path) -> Result<PathBuf, IpcError> {
    ensure_directory(src_path)?;
    ensure_directory(dest_parent)?;
    let src = src_path.canonicalize()?;
    let dest_parent = dest_parent.canonicalize()?;
    if src.parent().is_some_and(|parent| parent == dest_parent) {
        return Ok(src_path.to_path_buf());
    }
    if dest_parent.starts_with(&src) {
        return Err(IpcError::Conflict { current_mtime: 0 });
    }
    let folder_name = src
        .file_name()
        .ok_or_else(|| IpcError::Io("folder path has no final segment".to_string()))?;
    let dest = dest_parent.join(folder_name);
    if dest.exists() {
        return Err(IpcError::Conflict { current_mtime: 0 });
    }
    move_dir_with_fallback(&src, &dest)?;
    Ok(dest)
}

pub fn trash_folder(path: &Path) -> Result<(), IpcError> {
    ensure_directory(path)?;
    trash::delete(path).map_err(|err| IpcError::Io(err.to_string()))
}

fn resolve_folder_path(root: &Path, input: &Path) -> Result<PathBuf, IpcError> {
    let path = if input.is_absolute() {
        input.to_path_buf()
    } else {
        root.join(input)
    };
    let root = root.canonicalize()?;
    let canonical = if path.exists() {
        path.canonicalize()?
    } else {
        let parent = path.parent().ok_or(IpcError::NotFound)?.canonicalize()?;
        parent.join(path.file_name().ok_or(IpcError::NotFound)?)
    };
    if canonical == root || canonical.starts_with(&root) {
        Ok(canonical)
    } else {
        Err(IpcError::NotFound)
    }
}

fn validate_folder_name(name: &str) -> Result<(), IpcError> {
    let trimmed = name.trim();
    if trimmed.is_empty()
        || trimmed == "."
        || trimmed == ".."
        || trimmed.starts_with('.')
        || trimmed.starts_with('_')
        || trimmed.contains(['/', '\\', ':', '*', '?', '"', '<', '>', '|'])
    {
        return Err(IpcError::Io("invalid folder name".to_string()));
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

fn move_dir_with_fallback(src: &Path, dest: &Path) -> Result<(), IpcError> {
    match fs::rename(src, dest) {
        Ok(()) => Ok(()),
        Err(_err) => {
            copy_dir_all(src, dest)?;
            if let Err(remove_err) = fs::remove_dir_all(src) {
                let _ = fs::remove_dir_all(dest);
                return Err(IpcError::Io(remove_err.to_string()));
            }
            Ok(())
        }
    }
}

fn copy_dir_all(src: &Path, dest: &Path) -> Result<(), IpcError> {
    fs::create_dir(dest)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let target = dest.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_all(&entry.path(), &target)?;
        } else if file_type.is_file() {
            fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}

fn emit_folder_changed(
    app: &AppHandle,
    path: PathBuf,
    old_path: Option<PathBuf>,
    kind: FolderChangeKind,
) -> Result<(), IpcError> {
    app.emit(
        "vault:folderChanged",
        VaultFolderChangedEvent {
            path,
            old_path,
            kind,
            source: FileChangeSource::Internal,
        },
    )
    .map_err(|err| IpcError::Other(err.to_string()))
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::*;

    #[test]
    fn creates_folder_under_parent() {
        let dir = tempdir().unwrap();
        let path = create_folder(dir.path(), "Projects").unwrap();
        assert!(path.is_dir());
    }

    #[test]
    fn create_rejects_existing_folder() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join("Projects")).unwrap();
        assert!(matches!(
            create_folder(dir.path(), "Projects"),
            Err(IpcError::Conflict { .. })
        ));
    }

    #[test]
    fn rejects_hidden_folder_name() {
        let dir = tempdir().unwrap();
        assert!(matches!(
            create_folder(dir.path(), ".hidden"),
            Err(IpcError::Io(_))
        ));
    }

    #[test]
    fn rejects_names_with_separators() {
        let dir = tempdir().unwrap();
        assert!(matches!(
            create_folder(dir.path(), "bad/name"),
            Err(IpcError::Io(_))
        ));
    }

    #[test]
    fn renames_folder() {
        let dir = tempdir().unwrap();
        let old = create_folder(dir.path(), "Old").unwrap();
        let renamed = rename_folder(&old, "New").unwrap();
        assert!(renamed.ends_with("New"));
        assert!(!old.exists());
    }

    #[test]
    fn rename_rejects_sibling_conflict() {
        let dir = tempdir().unwrap();
        let old = create_folder(dir.path(), "Old").unwrap();
        create_folder(dir.path(), "New").unwrap();
        assert!(matches!(
            rename_folder(&old, "New"),
            Err(IpcError::Conflict { .. })
        ));
    }

    #[test]
    fn moves_folder_to_destination_parent() {
        let dir = tempdir().unwrap();
        let src = create_folder(dir.path(), "Src").unwrap();
        fs::write(src.join("note.md"), "body").unwrap();
        let dest_parent = create_folder(dir.path(), "Dest").unwrap();
        let moved = move_folder(&src, &dest_parent).unwrap();
        assert!(moved.join("note.md").exists());
        assert!(!src.exists());
    }

    #[test]
    fn move_rejects_descendant_destination() {
        let dir = tempdir().unwrap();
        let src = create_folder(dir.path(), "Src").unwrap();
        let child = create_folder(&src, "Child").unwrap();
        assert!(matches!(
            move_folder(&src, &child),
            Err(IpcError::Conflict { .. })
        ));
    }

    #[test]
    fn move_rejects_destination_name_conflict() {
        let dir = tempdir().unwrap();
        let src = create_folder(dir.path(), "Src").unwrap();
        let dest_parent = create_folder(dir.path(), "Dest").unwrap();
        create_folder(&dest_parent, "Src").unwrap();
        assert!(matches!(
            move_folder(&src, &dest_parent),
            Err(IpcError::Conflict { .. })
        ));
    }

    #[test]
    fn copy_dir_all_preserves_nested_files_for_fallback_path() {
        let dir = tempdir().unwrap();
        let src = create_folder(dir.path(), "Src").unwrap();
        let nested = create_folder(&src, "Nested").unwrap();
        fs::write(nested.join("note.md"), "body").unwrap();
        let dest = dir.path().join("Copied");
        copy_dir_all(&src, &dest).unwrap();
        assert_eq!(
            fs::read_to_string(dest.join("Nested/note.md")).unwrap(),
            "body"
        );
    }

    #[test]
    fn trash_rejects_missing_folder() {
        let dir = tempdir().unwrap();
        assert!(matches!(
            trash_folder(&dir.path().join("missing")),
            Err(IpcError::NotFound)
        ));
    }
}
