use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Deserialize;
use serde_json::{Map, Value};
use tempfile::NamedTempFile;

use crate::vault::fingerprint::FingerprintCache;
use crate::vault::frontmatter;
use crate::vault::{NoteFile, SaveInput, SaveResult};
use crate::IpcError;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteInput {
    pub folder: PathBuf,
    pub title: Option<String>,
}

pub fn read_note(path: &Path) -> Result<NoteFile, IpcError> {
    let bytes = fs::read(path).map_err(map_not_found)?;
    let text = String::from_utf8(bytes).map_err(|err| IpcError::Parse(err.to_string()))?;
    let (frontmatter, body) = frontmatter::parse(&text)?;
    let metadata = fs::metadata(path).map_err(map_not_found)?;

    Ok(NoteFile {
        path: path.to_path_buf(),
        frontmatter,
        body,
        mtime: metadata_mtime_ms(&metadata)?,
    })
}

pub fn save_atomic(input: &SaveInput, cache: &FingerprintCache) -> Result<SaveResult, IpcError> {
    let current_metadata = fs::metadata(&input.path).map_err(map_not_found)?;
    let current_mtime = metadata_mtime_ms(&current_metadata)?;
    if input
        .expected_mtime
        .is_some_and(|expected_mtime| expected_mtime != current_mtime)
    {
        return Err(IpcError::Conflict { current_mtime });
    }

    let dir = input
        .path
        .parent()
        .ok_or_else(|| IpcError::Io("note path has no parent directory".to_string()))?;
    let mut temp_file = NamedTempFile::new_in(dir)?;
    temp_file.write_all(serialize_note(&input.frontmatter, &input.body)?.as_bytes())?;
    temp_file.flush()?;
    temp_file
        .persist(&input.path)
        .map_err(|err| IpcError::Io(err.to_string()))?;

    let metadata = fs::metadata(&input.path)?;
    let fingerprint_path = input
        .path
        .canonicalize()
        .unwrap_or_else(|_| input.path.clone());
    cache.record(fingerprint_path, metadata.len(), metadata.modified()?);

    Ok(SaveResult {
        path: input.path.clone(),
        mtime: metadata_mtime_ms(&metadata)?,
    })
}

pub fn create_note(input: &CreateNoteInput) -> Result<PathBuf, IpcError> {
    fs::create_dir_all(&input.folder)?;
    let base_title = input.title.as_deref().unwrap_or("Untitled").trim();
    let base_title = if base_title.is_empty() {
        "Untitled"
    } else {
        base_title
    };
    let path = unique_note_path(&input.folder, base_title);
    let mut frontmatter = Map::new();
    frontmatter.insert("created".to_string(), Value::String(iso_utc_now()));
    let save_input = SaveInput {
        path: path.clone(),
        frontmatter: Value::Object(frontmatter),
        body: String::new(),
        expected_mtime: None,
    };
    let cache = FingerprintCache::new();
    write_new_note(&save_input, &cache)?;
    Ok(path)
}

pub fn rename_note(old_path: &Path, new_name: &str) -> Result<PathBuf, IpcError> {
    let parent = old_path
        .parent()
        .ok_or_else(|| IpcError::Io("note path has no parent directory".to_string()))?;
    let file_name = if new_name.ends_with(".md") {
        new_name.to_string()
    } else {
        format!("{new_name}.md")
    };
    let new_path = parent.join(&file_name);
    let old_stem = old_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");
    let is_case_only = old_stem.eq_ignore_ascii_case(&file_name) && old_stem != file_name;
    if !is_case_only && new_path.exists() {
        let current_mtime = fs::metadata(&new_path)
            .ok()
            .and_then(|metadata| metadata_mtime_ms(&metadata).ok())
            .unwrap_or_default();
        return Err(IpcError::Conflict { current_mtime });
    }
    if is_case_only {
        let tmp_path = parent.join(format!("{file_name}__tmp_rename"));
        fs::rename(old_path, &tmp_path).map_err(map_not_found)?;
        fs::rename(&tmp_path, &new_path).map_err(map_not_found)?;
    } else {
        fs::rename(old_path, &new_path).map_err(map_not_found)?;
    }
    Ok(new_path)
}

pub fn trash_note(path: &Path) -> Result<(), IpcError> {
    if !path.exists() {
        return Err(IpcError::NotFound);
    }
    trash::delete(path).map_err(|err| IpcError::Io(err.to_string()))
}

fn write_new_note(input: &SaveInput, cache: &FingerprintCache) -> Result<SaveResult, IpcError> {
    let dir = input
        .path
        .parent()
        .ok_or_else(|| IpcError::Io("note path has no parent directory".to_string()))?;
    let mut temp_file = NamedTempFile::new_in(dir)?;
    temp_file.write_all(serialize_note(&input.frontmatter, &input.body)?.as_bytes())?;
    temp_file.flush()?;
    temp_file.persist_noclobber(&input.path).map_err(|err| {
        if err.error.kind() == std::io::ErrorKind::AlreadyExists {
            IpcError::Conflict { current_mtime: 0 }
        } else {
            IpcError::Io(err.to_string())
        }
    })?;
    let metadata = fs::metadata(&input.path)?;
    let fingerprint_path = input
        .path
        .canonicalize()
        .unwrap_or_else(|_| input.path.clone());
    cache.record(fingerprint_path, metadata.len(), metadata.modified()?);
    Ok(SaveResult {
        path: input.path.clone(),
        mtime: metadata_mtime_ms(&metadata)?,
    })
}

fn unique_note_path(folder: &Path, title: &str) -> PathBuf {
    let stem = sanitize_file_stem(title);
    let mut candidate = folder.join(format!("{stem}.md"));
    let mut index = 1;
    while candidate.exists() {
        candidate = folder.join(format!("{stem}-{index}.md"));
        index += 1;
    }
    candidate
}

fn sanitize_file_stem(title: &str) -> String {
    let sanitized = title
        .chars()
        .map(|ch| match ch {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            _ => ch,
        })
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .to_string();
    if sanitized.is_empty() {
        "Untitled".to_string()
    } else {
        sanitized
    }
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

pub fn metadata_mtime_ms(metadata: &fs::Metadata) -> Result<i64, IpcError> {
    let duration = metadata
        .modified()?
        .duration_since(UNIX_EPOCH)
        .map_err(|err| IpcError::Other(err.to_string()))?;
    Ok(duration.as_millis() as i64)
}

pub fn metadata_ctime_ms(metadata: &fs::Metadata) -> Result<i64, IpcError> {
    let time = metadata
        .created()
        .or_else(|_| metadata.modified())?;
    let duration = time
        .duration_since(UNIX_EPOCH)
        .map_err(|err| IpcError::Other(err.to_string()))?;
    Ok(duration.as_millis() as i64)
}

pub fn map_not_found(err: std::io::Error) -> IpcError {
    if err.kind() == std::io::ErrorKind::NotFound {
        IpcError::NotFound
    } else {
        IpcError::Io(err.to_string())
    }
}

pub fn same_path(left: &Path, right: &Path) -> bool {
    left.canonicalize().ok() == right.canonicalize().ok()
}

pub fn to_slash_string(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            std::path::Component::Normal(value) => value.to_str(),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn iso_utc_now() -> String {
    chrono::Utc::now()
        .to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}
