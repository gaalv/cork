use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

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
        return Err(IpcError::Conflict {
            current_mtime,
        });
    }

    let dir = input
        .path
        .parent()
        .ok_or_else(|| IpcError::Io("note path has no parent directory".to_string()))?;
    let mut temp_file = NamedTempFile::new_in(dir)?;
    temp_file.write_all(serialize_note(&input.frontmatter, &input.body)?.as_bytes())?;
    temp_file.flush()?;
    temp_file.persist(&input.path).map_err(|err| IpcError::Io(err.to_string()))?;

    let metadata = fs::metadata(&input.path)?;
    let fingerprint_path = input.path.canonicalize().unwrap_or_else(|_| input.path.clone());
    cache.record(fingerprint_path, metadata.len(), metadata.modified()?);

    Ok(SaveResult {
        path: input.path.clone(),
        mtime: metadata_mtime_ms(&metadata)?,
    })
}

pub fn create_note(input: &CreateNoteInput) -> Result<PathBuf, IpcError> {
    fs::create_dir_all(&input.folder)?;
    let base_title = input.title.as_deref().unwrap_or("Untitled").trim();
    let base_title = if base_title.is_empty() { "Untitled" } else { base_title };
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
    let new_path = parent.join(file_name);
    if new_path.exists() {
        let current_mtime = fs::metadata(&new_path)
            .ok()
            .and_then(|metadata| metadata_mtime_ms(&metadata).ok())
            .unwrap_or_default();
        return Err(IpcError::Conflict { current_mtime });
    }
    fs::rename(old_path, &new_path).map_err(map_not_found)?;
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
    let fingerprint_path = input.path.canonicalize().unwrap_or_else(|_| input.path.clone());
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
    let yaml = serde_yaml::to_string(frontmatter).map_err(|err| IpcError::Parse(err.to_string()))?;
    Ok(format!("---\n{}---\n{}", yaml.trim_start_matches("---\n"), body))
}

pub fn metadata_mtime_ms(metadata: &fs::Metadata) -> Result<i64, IpcError> {
    let duration = metadata
        .modified()?
        .duration_since(UNIX_EPOCH)
        .map_err(|err| IpcError::Other(err.to_string()))?;
    Ok(duration.as_millis() as i64)
}

fn map_not_found(err: std::io::Error) -> IpcError {
    if err.kind() == std::io::ErrorKind::NotFound {
        IpcError::NotFound
    } else {
        IpcError::Io(err.to_string())
    }
}

fn iso_utc_now() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let days = seconds.div_euclid(86_400);
    let seconds_of_day = seconds.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    let hour = seconds_of_day / 3_600;
    let minute = seconds_of_day % 3_600 / 60;
    let second = seconds_of_day % 60;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z")
}

fn civil_from_days(days_since_unix_epoch: i64) -> (i64, i64, i64) {
    let z = days_since_unix_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 }.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096).div_euclid(365);
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2).div_euclid(153);
    let day = doy - (153 * mp + 2).div_euclid(5) + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    let year = year + if month <= 2 { 1 } else { 0 };
    (year, month, day)
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::thread;

    use tempfile::tempdir;

    use super::*;

    #[test]
    fn reads_note_frontmatter_body_and_mtime() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("note.md");
        fs::write(&path, "---\ntitle: Read\n---\n# Read\n").unwrap();

        let note = read_note(&path).unwrap();

        assert_eq!(note.frontmatter["title"], "Read");
        assert_eq!(note.body, "# Read\n");
        assert!(note.mtime > 0);
    }

    #[test]
    fn save_atomic_writes_note_and_records_fingerprint() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("note.md");
        fs::write(&path, "old").unwrap();
        let current_mtime = metadata_mtime_ms(&fs::metadata(&path).unwrap()).unwrap();
        let cache = FingerprintCache::new();
        let input = SaveInput {
            path: path.clone(),
            frontmatter: serde_json::json!({"title":"Saved"}),
            body: "# Saved\n".to_string(),
            expected_mtime: Some(current_mtime),
        };

        let result = save_atomic(&input, &cache).unwrap();
        let metadata = fs::metadata(&path).unwrap();

        assert_eq!(result.path, path);
        assert!(fs::read_to_string(&input.path).unwrap().contains("title: Saved"));
        assert!(cache.pop_recent(&input.path.canonicalize().unwrap(), metadata.len(), metadata.modified().unwrap()));
    }

    #[test]
    fn stale_save_returns_conflict() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("note.md");
        fs::write(&path, "old").unwrap();
        let cache = FingerprintCache::new();
        let input = SaveInput {
            path,
            frontmatter: Value::Object(Map::new()),
            body: "new".to_string(),
            expected_mtime: Some(1),
        };

        assert!(matches!(save_atomic(&input, &cache), Err(IpcError::Conflict { .. })));
    }

    #[test]
    fn creates_unique_note_with_frontmatter() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("Untitled.md"), "exists").unwrap();

        let path = create_note(&CreateNoteInput {
            folder: dir.path().to_path_buf(),
            title: None,
        })
        .unwrap();

        assert_eq!(path.file_name().unwrap(), "Untitled-1.md");
        assert!(fs::read_to_string(path).unwrap().contains("created:"));
    }

    #[test]
    fn renames_note_and_rejects_existing_target() {
        let dir = tempdir().unwrap();
        let old_path = dir.path().join("old.md");
        let existing = dir.path().join("existing.md");
        fs::write(&old_path, "old").unwrap();
        fs::write(&existing, "existing").unwrap();

        assert!(matches!(rename_note(&old_path, "existing"), Err(IpcError::Conflict { .. })));
        let new_path = rename_note(&old_path, "new").unwrap();
        assert!(new_path.ends_with("new.md"));
        assert!(new_path.exists());
    }

    #[test]
    fn writes_many_files_concurrently_with_unique_contents() {
        let dir = tempdir().unwrap();
        let cache = Arc::new(FingerprintCache::new());
        let mut handles = Vec::new();

        for index in 0..100 {
            let cache = Arc::clone(&cache);
            let path = dir.path().join(format!("note-{index}.md"));
            fs::write(&path, "seed").unwrap();
            handles.push(thread::spawn(move || {
                let input = SaveInput {
                    path: path.clone(),
                    frontmatter: Value::Object(Map::new()),
                    body: format!("body {index}"),
                    expected_mtime: None,
                };
                save_atomic(&input, &cache).unwrap();
                fs::read_to_string(path).unwrap()
            }));
        }

        let bodies = handles
            .into_iter()
            .map(|handle| handle.join().unwrap())
            .collect::<Vec<_>>();
        assert_eq!(bodies.len(), 100);
        assert!(bodies.iter().enumerate().all(|(index, body)| body == &format!("body {index}")));
    }

    #[test]
    fn civil_from_days_formats_unix_epoch() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
    }
}
