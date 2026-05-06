use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

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

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;

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
