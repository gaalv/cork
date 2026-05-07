use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::vault::VaultState;
use crate::IpcError;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: String,
    pub text: String,
    pub done: bool,
    pub created_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoList {
    #[serde(default)]
    pub todos: Vec<Todo>,
}

fn todos_path(vault_root: &Path) -> std::path::PathBuf {
    vault_root.join(".noxe").join("todos.json")
}

pub fn load_todos(vault_root: &Path) -> Result<TodoList, IpcError> {
    let path = todos_path(vault_root);
    if !path.exists() {
        return Ok(TodoList::default());
    }
    let text = fs::read_to_string(&path)?;
    if text.trim().is_empty() {
        return Ok(TodoList::default());
    }
    serde_json::from_str(&text).map_err(|err| IpcError::Parse(err.to_string()))
}

pub fn save_todos(vault_root: &Path, list: &TodoList) -> Result<(), IpcError> {
    let dir = vault_root.join(".noxe");
    fs::create_dir_all(&dir)?;
    let text = serde_json::to_string_pretty(list).map_err(|err| IpcError::Parse(err.to_string()))?;
    fs::write(dir.join("todos.json"), text)?;
    Ok(())
}

#[tauri::command]
pub fn todos_load(state: tauri::State<'_, VaultState>) -> Result<TodoList, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    load_todos(&root)
}

#[tauri::command]
pub fn todos_save(
    state: tauri::State<'_, VaultState>,
    list: TodoList,
) -> Result<TodoList, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    save_todos(&root, &list)?;
    Ok(list)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn missing_returns_default_empty_list() {
        let dir = tempdir().unwrap();
        let list = load_todos(dir.path()).unwrap();
        assert!(list.todos.is_empty());
    }

    #[test]
    fn save_then_load_roundtrip() {
        let dir = tempdir().unwrap();
        let list = TodoList {
            todos: vec![
                Todo {
                    id: "a".into(),
                    text: "Buy milk".into(),
                    done: false,
                    created_at: "2026-01-01T00:00:00Z".into(),
                    completed_at: None,
                },
                Todo {
                    id: "b".into(),
                    text: "Ship feature".into(),
                    done: true,
                    created_at: "2026-01-02T00:00:00Z".into(),
                    completed_at: Some("2026-01-03T00:00:00Z".into()),
                },
            ],
        };
        save_todos(dir.path(), &list).unwrap();
        let loaded = load_todos(dir.path()).unwrap();
        assert_eq!(loaded, list);
    }

    #[test]
    fn empty_file_returns_default() {
        let dir = tempdir().unwrap();
        fs::create_dir_all(dir.path().join(".noxe")).unwrap();
        fs::write(dir.path().join(".noxe").join("todos.json"), "").unwrap();
        let list = load_todos(dir.path()).unwrap();
        assert!(list.todos.is_empty());
    }

    #[test]
    fn malformed_json_returns_parse_error() {
        let dir = tempdir().unwrap();
        fs::create_dir_all(dir.path().join(".noxe")).unwrap();
        fs::write(dir.path().join(".noxe").join("todos.json"), "{ not json").unwrap();
        let err = load_todos(dir.path()).unwrap_err();
        assert!(matches!(err, IpcError::Parse(_)));
    }
}
