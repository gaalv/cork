use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::{Map, Value};

use crate::vault::frontmatter;
use crate::vault::io::{metadata_mtime_ms, to_slash_string};
use crate::vault::settings::load_vault_settings;
use crate::vault::VaultState;
use crate::IpcError;

const ARCHIVED_FOLDER: &str = "_archived";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchivedNoteEntry {
    pub path: PathBuf,
    pub title: String,
    pub archived_at: String,
    pub archived_from: String,
    pub days_remaining: Option<i64>,
    pub mtime: i64,
}

#[tauri::command]
pub fn archive_note(
    state: tauri::State<'_, VaultState>,
    path: PathBuf,
) -> Result<PathBuf, IpcError> {
    let vault_root = state.current_path().ok_or(IpcError::NotFound)?;
    let vault_root = vault_root.canonicalize()?;

    let canonical_path = path.canonicalize()?;
    if !canonical_path.starts_with(&vault_root) {
        return Err(IpcError::Other("path is outside the vault".to_string()));
    }
    if !canonical_path.is_file() {
        return Err(IpcError::NotFound);
    }

    let relative_folder = canonical_path
        .parent()
        .and_then(|p| p.strip_prefix(&vault_root).ok())
        .map(to_slash_string)
        .unwrap_or_default();

    let content = fs::read_to_string(&canonical_path)?;
    let (mut fm, body) = frontmatter::parse(&content)?;

    if !fm.is_object() {
        fm = Value::Object(Map::new());
    }
    let fm_map = fm.as_object_mut().unwrap();
    fm_map.insert(
        "archived_at".to_string(),
        Value::String(Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)),
    );
    fm_map.insert(
        "archived_from".to_string(),
        Value::String(relative_folder),
    );

    let archived_dir = vault_root.join(ARCHIVED_FOLDER);
    fs::create_dir_all(&archived_dir)?;

    let file_name = canonical_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled.md");
    let dest = unique_path(&archived_dir, file_name);

    let serialized = serialize_note(&fm, &body)?;
    fs::write(&dest, serialized)?;
    fs::remove_file(&canonical_path)?;

    Ok(dest)
}

#[tauri::command]
pub fn restore_note(
    state: tauri::State<'_, VaultState>,
    path: PathBuf,
) -> Result<PathBuf, IpcError> {
    let vault_root = state.current_path().ok_or(IpcError::NotFound)?;
    let vault_root = vault_root.canonicalize()?;

    let canonical_path = path.canonicalize()?;
    if !canonical_path.starts_with(&vault_root) {
        return Err(IpcError::Other("path is outside the vault".to_string()));
    }
    if !canonical_path.is_file() {
        return Err(IpcError::NotFound);
    }

    let content = fs::read_to_string(&canonical_path)?;
    let (mut fm, body) = frontmatter::parse(&content)?;

    let original_folder = fm
        .get("archived_from")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    if let Some(map) = fm.as_object_mut() {
        map.remove("archived_at");
        map.remove("archived_from");
    }

    let dest_dir = if original_folder.is_empty() {
        vault_root.clone()
    } else {
        vault_root.join(&original_folder)
    };
    fs::create_dir_all(&dest_dir)?;

    let file_name = canonical_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled.md");
    let dest = unique_path(&dest_dir, file_name);

    let serialized = serialize_note(&fm, &body)?;
    fs::write(&dest, serialized)?;
    fs::remove_file(&canonical_path)?;

    Ok(dest)
}

#[tauri::command]
pub fn list_archived(
    state: tauri::State<'_, VaultState>,
) -> Result<Vec<ArchivedNoteEntry>, IpcError> {
    let vault_root = state.current_path().ok_or(IpcError::NotFound)?;
    let vault_root = vault_root.canonicalize()?;
    let archived_dir = vault_root.join(ARCHIVED_FOLDER);

    if !archived_dir.is_dir() {
        return Ok(Vec::new());
    }

    let settings = load_vault_settings(&vault_root).unwrap_or_default();
    let retention_days = settings.archive_retention_days.unwrap_or(30);

    let mut entries = Vec::new();
    for entry in fs::read_dir(&archived_dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file()
            || path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| !e.eq_ignore_ascii_case("md"))
                .unwrap_or(true)
        {
            continue;
        }

        let metadata = fs::metadata(&path)?;
        let mtime = metadata_mtime_ms(&metadata)?;

        let content = fs::read_to_string(&path).unwrap_or_default();
        let (fm, _body) = frontmatter::parse(&content)?;

        let archived_at = fm
            .get("archived_at")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let archived_from = fm
            .get("archived_from")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let days_remaining = if retention_days == 0 {
            None
        } else {
            let days_elapsed = parse_days_since(&archived_at);
            Some((retention_days as i64) - days_elapsed)
        };

        let title = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string();

        entries.push(ArchivedNoteEntry {
            path,
            title,
            archived_at,
            archived_from,
            days_remaining,
            mtime,
        });
    }

    entries.sort_by(|a, b| b.mtime.cmp(&a.mtime));
    Ok(entries)
}

/// Deletes archived notes that have exceeded the retention period.
/// Called during `vault_open` as a lightweight cleanup pass.
pub fn cleanup_expired(vault_root: &Path, retention_days: u32) {
    if retention_days == 0 {
        return;
    }

    let archived_dir = vault_root.join(ARCHIVED_FOLDER);
    if !archived_dir.is_dir() {
        return;
    }

    let entries = match fs::read_dir(&archived_dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    let mut deleted = 0u32;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let (fm, _) = match frontmatter::parse(&content) {
            Ok(pair) => pair,
            Err(_) => continue,
        };
        let archived_at = fm
            .get("archived_at")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let days_elapsed = parse_days_since(archived_at);
        if days_elapsed >= retention_days as i64 {
            if fs::remove_file(&path).is_ok() {
                deleted += 1;
            }
        }
    }

    if deleted > 0 {
        eprintln!("cork archive: cleaned up {deleted} expired note(s)");
    }
}

fn parse_days_since(iso_date: &str) -> i64 {
    DateTime::parse_from_rfc3339(iso_date)
        .map(|dt| (Utc::now() - dt.with_timezone(&Utc)).num_days())
        .unwrap_or(0)
}

fn unique_path(dir: &Path, file_name: &str) -> PathBuf {
    let candidate = dir.join(file_name);
    if !candidate.exists() {
        return candidate;
    }

    let p = Path::new(file_name);
    let stem = p
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(file_name);
    let ext = p.extension().and_then(|e| e.to_str());

    for i in 1.. {
        let suffixed = match ext {
            Some(e) => format!("{stem}-{i}.{e}"),
            None => format!("{stem}-{i}"),
        };
        let candidate = dir.join(suffixed);
        if !candidate.exists() {
            return candidate;
        }
    }
    unreachable!()
}

fn serialize_note(frontmatter: &Value, body: &str) -> Result<String, IpcError> {
    if frontmatter.as_object().is_some_and(Map::is_empty) {
        return Ok(body.to_string());
    }
    let yaml =
        serde_yaml::to_string(frontmatter).map_err(|err| IpcError::Parse(err.to_string()))?;
    Ok(format!(
        "---\n{}---\n{}",
        yaml.trim_start_matches("---\n"),
        body
    ))
}
