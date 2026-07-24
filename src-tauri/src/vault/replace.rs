//! Find & replace across every note body in the vault.
//!
//! Runs in two modes over one command: a dry run (`apply = false`) returns the
//! per-file match counts for a preview, and the apply pass rewrites the note
//! bodies. Frontmatter is never touched — only the Markdown body is searched.

use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

use crate::vault::io::{metadata_mtime_ms, read_note, save_atomic};
use crate::vault::list::{is_excluded, is_markdown};
use crate::vault::watcher::{FileChangeKind, FileChangeSource, VaultFileChangedEvent};
use crate::vault::{SaveInput, VaultState};
use crate::IpcError;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceHit {
    pub path: PathBuf,
    pub title: String,
    pub folder: String,
    pub count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceResult {
    pub files: Vec<ReplaceHit>,
    pub total: usize,
    pub applied: bool,
}

#[tauri::command]
pub fn notes_replace_in_vault(
    app: AppHandle,
    state: tauri::State<'_, VaultState>,
    find: String,
    replace_with: String,
    case_sensitive: bool,
    apply: bool,
) -> Result<ReplaceResult, IpcError> {
    if find.is_empty() {
        return Ok(ReplaceResult {
            files: Vec::new(),
            total: 0,
            applied: apply,
        });
    }

    let root = state.current_path().ok_or(IpcError::NotFound)?.canonicalize()?;
    // Default attachments folder is enough to keep the walker out of assets.
    let attachments_folder = "_attachments";

    let mut files = Vec::new();
    let mut total = 0usize;

    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| !is_excluded(entry.path(), &root, attachments_folder))
    {
        let entry = entry.map_err(|err| IpcError::Io(err.to_string()))?;
        let file_type = entry.file_type();
        if !file_type.is_file() || file_type.is_symlink() || !is_markdown(entry.path()) {
            continue;
        }

        let path = entry.path().canonicalize()?;
        let mut note = read_note(&path)?;
        let (new_body, count) = replace_all(&note.body, &find, &replace_with, case_sensitive);
        if count == 0 {
            continue;
        }
        total += count;
        files.push(ReplaceHit {
            path: path.clone(),
            title: title_of(&path),
            folder: folder_of(&path, &root),
            count,
        });

        if apply {
            note.body = new_body;
            save_atomic(
                &SaveInput {
                    path: note.path.clone(),
                    frontmatter: note.frontmatter,
                    body: note.body,
                    expected_mtime: None,
                },
                &state.fingerprint_cache,
            )?;
            if let Ok(metadata) = std::fs::metadata(&path) {
                let _ = app.emit(
                    "vault:fileChanged",
                    VaultFileChangedEvent {
                        path: path.clone(),
                        kind: FileChangeKind::Modified,
                        source: FileChangeSource::Internal,
                        mtime: metadata_mtime_ms(&metadata).unwrap_or(0),
                        size: metadata.len(),
                    },
                );
            }
        }
    }

    files.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.path.cmp(&b.path)));
    Ok(ReplaceResult {
        files,
        total,
        applied: apply,
    })
}

/// Replace every occurrence of `find` with `replacement`, returning the new
/// text and the number of substitutions. Case-insensitive matching folds each
/// character so it stays correct across multi-byte code points.
fn replace_all(text: &str, find: &str, replacement: &str, case_sensitive: bool) -> (String, usize) {
    if find.is_empty() {
        return (text.to_string(), 0);
    }
    if case_sensitive {
        let count = text.matches(find).count();
        if count == 0 {
            return (text.to_string(), 0);
        }
        return (text.replace(find, replacement), count);
    }

    let chars: Vec<char> = text.chars().collect();
    let needle: Vec<char> = find.chars().collect();
    let m = needle.len();
    let n = chars.len();
    let mut out = String::with_capacity(text.len());
    let mut count = 0usize;
    let mut i = 0;
    while i < n {
        if i + m <= n
            && (0..m).all(|k| chars[i + k].to_lowercase().eq(needle[k].to_lowercase()))
        {
            out.push_str(replacement);
            count += 1;
            i += m;
        } else {
            out.push(chars[i]);
            i += 1;
        }
    }
    (out, count)
}

fn title_of(path: &Path) -> String {
    path.file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("Untitled")
        .to_string()
}

fn folder_of(path: &Path, root: &Path) -> String {
    path.parent()
        .and_then(|parent| parent.strip_prefix(root).ok())
        .map(|rel| rel.to_string_lossy().replace('\\', "/"))
        .unwrap_or_default()
}
