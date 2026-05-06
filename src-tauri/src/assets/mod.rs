use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

use crate::vault::VaultState;
use crate::IpcError;

#[derive(Default)]
pub struct AssetScopeState {
    current_root: Mutex<Option<PathBuf>>,
}

impl AssetScopeState {
    pub fn current_root(&self) -> Option<PathBuf> {
        self.current_root
            .lock()
            .expect("asset scope mutex poisoned")
            .clone()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetScopeInput {
    pub vault_root: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetScope {
    pub vault_root: PathBuf,
}

#[tauri::command]
pub fn assets_set_scope(
    app: AppHandle,
    state: tauri::State<'_, AssetScopeState>,
    input: SetScopeInput,
) -> Result<AssetScope, IpcError> {
    set_scope_for_path(&app, &state, &input.vault_root)
}

pub fn set_scope_for_path<R: Runtime, M: Manager<R>>(
    manager: &M,
    state: &AssetScopeState,
    vault_root: &Path,
) -> Result<AssetScope, IpcError> {
    let canonical = vault_root.canonicalize()?;
    if !canonical.is_dir() {
        return Err(IpcError::NotFound);
    }

    let scope = manager.asset_protocol_scope();
    if let Some(previous) = state.current_root() {
        if previous != canonical {
            scope
                .forbid_directory(previous, true)
                .map_err(|err| IpcError::Other(err.to_string()))?;
        }
    }
    scope
        .allow_directory(&canonical, true)
        .map_err(|err| IpcError::Other(err.to_string()))?;
    *state
        .current_root
        .lock()
        .expect("asset scope mutex poisoned") = Some(canonical.clone());

    Ok(AssetScope {
        vault_root: canonical,
    })
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteAttachmentInput {
    pub source_path: Option<PathBuf>,
    pub bytes: Option<Vec<u8>>,
    pub suggested_name: String,
    pub vault_rel_dir: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteAttachmentResult {
    pub path: PathBuf,
    pub relative_path: String,
}

#[tauri::command]
pub fn assets_write_attachment(
    state: tauri::State<'_, VaultState>,
    input: WriteAttachmentInput,
) -> Result<WriteAttachmentResult, IpcError> {
    let vault_root = state.current_path().ok_or(IpcError::NotFound)?;
    write_attachment_to_vault(&vault_root, &input)
}

pub fn write_attachment_to_vault(
    vault_root: &Path,
    input: &WriteAttachmentInput,
) -> Result<WriteAttachmentResult, IpcError> {
    let vault_root = vault_root.canonicalize()?;
    let folder = input.vault_rel_dir.as_deref().unwrap_or("_attachments");
    let destination_dir = resolve_vault_dir(&vault_root, folder)?;
    fs::create_dir_all(&destination_dir)?;

    let file_name = clean_file_name(&input.suggested_name)?;
    let destination = next_available_path(&destination_dir, &file_name);
    let temp_path = destination.with_file_name(format!(".noxe-asset-{}.tmp", file_name));

    if let Some(bytes) = &input.bytes {
        fs::write(&temp_path, bytes)?;
    } else if let Some(source_path) = &input.source_path {
        if !source_path.is_file() {
            return Err(IpcError::NotFound);
        }
        fs::copy(source_path, &temp_path)?;
    } else {
        return Err(IpcError::Other("missing attachment source".to_string()));
    }

    fs::rename(&temp_path, &destination)?;
    Ok(WriteAttachmentResult {
        relative_path: relative_slash_path(&vault_root, &destination)?,
        path: destination,
    })
}

fn resolve_vault_dir(vault_root: &Path, folder: &str) -> Result<PathBuf, IpcError> {
    let folder_path = PathBuf::from(folder);
    if folder_path.is_absolute()
        || folder_path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::Prefix(_) | Component::RootDir
            )
        })
    {
        return Err(IpcError::Other(
            "attachment folder must stay inside the vault".to_string(),
        ));
    }
    Ok(vault_root.join(folder_path))
}

fn clean_file_name(name: &str) -> Result<String, IpcError> {
    let file_name = Path::new(name)
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty() && *value != "." && *value != "..")
        .ok_or_else(|| IpcError::Other("invalid attachment name".to_string()))?;
    if file_name.contains('/') || file_name.contains('\\') {
        return Err(IpcError::Other(
            "attachment name must not contain separators".to_string(),
        ));
    }
    Ok(file_name.to_string())
}

fn next_available_path(destination_dir: &Path, file_name: &str) -> PathBuf {
    let candidate = destination_dir.join(file_name);
    if !candidate.exists() {
        return candidate;
    }

    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(file_name);
    let extension = path.extension().and_then(|value| value.to_str());
    for index in 1.. {
        let suffixed = match extension {
            Some(extension) => format!("{stem}-{index}.{extension}"),
            None => format!("{stem}-{index}"),
        };
        let candidate = destination_dir.join(suffixed);
        if !candidate.exists() {
            return candidate;
        }
    }
    unreachable!("unbounded collision suffix search should return")
}

fn relative_slash_path(vault_root: &Path, path: &Path) -> Result<String, IpcError> {
    let relative = path
        .strip_prefix(vault_root)
        .map_err(|err| IpcError::Other(err.to_string()))?;
    Ok(relative
        .components()
        .filter_map(|component| match component {
            Component::Normal(value) => value.to_str(),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/"))
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;

    #[test]
    fn write_attachment_uses_default_folder_and_collision_suffix() {
        let dir = tempdir().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir(&vault).unwrap();
        let input = WriteAttachmentInput {
            source_path: None,
            bytes: Some(b"first".to_vec()),
            suggested_name: "logo.png".to_string(),
            vault_rel_dir: None,
        };

        let first = write_attachment_to_vault(&vault, &input).unwrap();
        let second = write_attachment_to_vault(&vault, &input).unwrap();

        assert_eq!(first.relative_path, "_attachments/logo.png");
        assert_eq!(second.relative_path, "_attachments/logo-1.png");
        assert_eq!(fs::read(first.path).unwrap(), b"first");
    }

    #[test]
    fn write_attachment_rejects_folder_traversal() {
        let dir = tempdir().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir(&vault).unwrap();
        let input = WriteAttachmentInput {
            source_path: None,
            bytes: Some(b"bad".to_vec()),
            suggested_name: "bad.png".to_string(),
            vault_rel_dir: Some("../outside".to_string()),
        };

        let err = write_attachment_to_vault(&vault, &input).unwrap_err();

        assert!(matches!(err, IpcError::Other(_)));
    }

    #[test]
    fn set_scope_allows_current_vault_and_forbids_previous_vault() {
        let app = tauri::test::mock_app();
        let state = AssetScopeState::default();
        let dir = tempdir().unwrap();
        let first = dir.path().join("first");
        let second = dir.path().join("second");
        fs::create_dir_all(&first).unwrap();
        fs::create_dir_all(&second).unwrap();
        let first_file = first.join("logo.png");
        let second_file = second.join("logo.png");
        fs::write(&first_file, b"first").unwrap();
        fs::write(&second_file, b"second").unwrap();

        set_scope_for_path(&app, &state, &first).unwrap();
        assert!(app.asset_protocol_scope().is_allowed(&first_file));

        set_scope_for_path(&app, &state, &second).unwrap();

        assert!(!app.asset_protocol_scope().is_allowed(&first_file));
        assert!(app.asset_protocol_scope().is_allowed(&second_file));
        assert_eq!(
            state.current_root().unwrap(),
            second.canonicalize().unwrap()
        );
    }
}
