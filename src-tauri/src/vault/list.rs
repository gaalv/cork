use std::fs;
use std::path::{Component, Path};

use sha1::{Digest, Sha1};
use walkdir::WalkDir;

use crate::vault::frontmatter;
use crate::vault::io::{metadata_ctime_ms, metadata_mtime_ms, to_slash_string};
use crate::vault::settings::load_vault_settings;
use crate::vault::NoteEntry;

pub const IMAGE_EXTS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "svg"];
pub const OTHER_EXTS: &[&str] = &["pdf", "mp4", "mov", "mp3", "wav", "zip"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssetEntry {
    pub path: std::path::PathBuf,
    pub kind: AssetKind,
    pub size: u64,
    pub mtime: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AssetKind {
    Image,
    Other,
}

impl AssetKind {
    pub fn as_str(self) -> &'static str {
        match self {
            AssetKind::Image => "image",
            AssetKind::Other => "other",
        }
    }
}

use crate::IpcError;

pub fn list(root: &Path) -> Result<Vec<NoteEntry>, IpcError> {
    let root = root.canonicalize()?;
    let attachments_folder = load_vault_settings(&root)
        .ok()
        .and_then(|s| s.attachments_folder)
        .unwrap_or_else(|| "_attachments".to_string());
    let mut entries = Vec::new();

    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| !is_excluded(entry.path(), &root, &attachments_folder))
    {
        let entry = match entry {
            Ok(entry) => entry,
            Err(err) => return Err(IpcError::Io(err.to_string())),
        };
        let file_type = entry.file_type();
        if !file_type.is_file() || file_type.is_symlink() || !is_markdown(entry.path()) {
            continue;
        }

        let path = entry.path().canonicalize()?;
        let path_string = match path.to_str() {
            Some(value) => value.to_string(),
            None => continue,
        };
        let metadata = fs::metadata(&path)?;
        let content = fs::read_to_string(&path).unwrap_or_default();
        let (_, body) = frontmatter::parse(&content)?;
        let title = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("Untitled")
            .to_string();
        let folder = path
            .parent()
            .and_then(|parent| parent.strip_prefix(&root).ok())
            .map(to_slash_string)
            .unwrap_or_default();

        let snippet = snippet_from_body(&body, 120);

        entries.push(NoteEntry {
            id: sha1_hex(path_string.as_bytes()),
            path,
            title,
            folder,
            snippet,
            size: metadata.len(),
            mtime: metadata_mtime_ms(&metadata)?,
            ctime: metadata_ctime_ms(&metadata)?,
        });
    }

    entries.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(entries)
}

pub fn list_assets(root: &Path) -> Result<Vec<AssetEntry>, IpcError> {
    let root = root.canonicalize()?;
    let attachments_folder = load_vault_settings(&root)
        .ok()
        .and_then(|s| s.attachments_folder)
        .unwrap_or_else(|| "_attachments".to_string());
    let mut entries = Vec::new();

    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| !is_excluded(entry.path(), &root, &attachments_folder))
    {
        let entry = match entry {
            Ok(entry) => entry,
            Err(err) => return Err(IpcError::Io(err.to_string())),
        };
        let file_type = entry.file_type();
        let Some(kind) = asset_kind(entry.path()) else {
            continue;
        };
        if !file_type.is_file() || file_type.is_symlink() {
            continue;
        }
        let path = entry.path().canonicalize()?;
        let metadata = fs::metadata(&path)?;
        entries.push(AssetEntry {
            path,
            kind,
            size: metadata.len(),
            mtime: metadata_mtime_ms(&metadata)?,
        });
    }

    entries.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(entries)
}

fn is_hidden(path: &Path, root: &Path) -> bool {
    let relative = path.strip_prefix(root).unwrap_or(path);
    relative.components().any(|component| match component {
        Component::Normal(name) => name.to_str().is_some_and(|name| name.starts_with('.')),
        _ => false,
    })
}

/// Returns true if the path is hidden (dot-prefixed) or inside an internal
/// folder like the attachments folder (default `_attachments`).
pub fn is_excluded(path: &Path, root: &Path, attachments_folder: &str) -> bool {
    if is_hidden(path, root) {
        return true;
    }
    let relative = path.strip_prefix(root).unwrap_or(path);
    relative.components().any(|component| match component {
        Component::Normal(name) => name.to_str().is_some_and(|n| n == attachments_folder),
        _ => false,
    })
}

pub fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
}

pub fn asset_kind(path: &Path) -> Option<AssetKind> {
    let extension = path.extension()?.to_str()?;
    if IMAGE_EXTS
        .iter()
        .any(|candidate| extension.eq_ignore_ascii_case(candidate))
    {
        Some(AssetKind::Image)
    } else if OTHER_EXTS
        .iter()
        .any(|candidate| extension.eq_ignore_ascii_case(candidate))
    {
        Some(AssetKind::Other)
    } else {
        None
    }
}

fn snippet_from_body(body: &str, max_len: usize) -> String {
    let text: String = body
        .lines()
        .filter(|l| {
            let t = l.trim();
            !t.is_empty() && !t.starts_with('#') && !t.starts_with("---")
        })
        .take(3)
        .collect::<Vec<_>>()
        .join(" ");
    if text.len() <= max_len {
        text
    } else {
        let mut end = max_len;
        while end > 0 && !text.is_char_boundary(end) {
            end -= 1;
        }
        format!("{}…", &text[..end])
    }
}

pub fn sha1_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha1::new();
    hasher.update(bytes);
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}
