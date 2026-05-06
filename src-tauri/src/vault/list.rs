use std::fs;
use std::path::{Component, Path};
use std::time::UNIX_EPOCH;

use sha1::{Digest, Sha1};
use walkdir::WalkDir;

use crate::vault::frontmatter;
use crate::vault::NoteEntry;
use crate::IpcError;

pub fn list(root: &Path) -> Result<Vec<NoteEntry>, IpcError> {
    let root = root.canonicalize()?;
    let mut entries = Vec::new();

    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| !is_hidden(entry.path(), &root))
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
        let title = title_from_body(&body).unwrap_or_else(|| {
            path.file_stem()
                .and_then(|stem| stem.to_str())
                .unwrap_or("Untitled")
                .to_string()
        });
        let folder = path
            .parent()
            .and_then(|parent| parent.strip_prefix(&root).ok())
            .map(path_to_slash_string)
            .unwrap_or_default();

        entries.push(NoteEntry {
            id: sha1_hex(path_string.as_bytes()),
            path,
            title,
            folder,
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

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
}

fn title_from_body(body: &str) -> Option<String> {
    body.lines()
        .find_map(|line| line.strip_prefix("# ").map(str::trim))
        .filter(|title| !title.is_empty())
        .map(ToOwned::to_owned)
}

fn sha1_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha1::new();
    hasher.update(bytes);
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn metadata_mtime_ms(metadata: &fs::Metadata) -> Result<i64, IpcError> {
    let duration = metadata
        .modified()?
        .duration_since(UNIX_EPOCH)
        .map_err(|err| IpcError::Other(err.to_string()))?;
    Ok(duration.as_millis() as i64)
}

fn path_to_slash_string(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(value) => value.to_str(),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_markdown_notes_and_skips_hidden_non_md_and_symlinks() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/vault-list");
        let entries = list(&root).unwrap();

        assert_eq!(entries.len(), 10);
        assert!(entries.iter().all(|entry| entry.path.extension().unwrap() == "md"));
        assert!(entries.iter().all(|entry| !entry.path.to_string_lossy().contains("/.")));
        assert!(entries.iter().all(|entry| entry.size > 0));
        assert!(entries.iter().all(|entry| entry.mtime > 0));
        assert!(entries.iter().any(|entry| entry.title == "From Heading"));
        assert!(entries.iter().any(|entry| entry.title == "filename-title"));
        assert!(entries.iter().any(|entry| entry.folder == "nested/deep"));
        assert!(entries.iter().all(|entry| entry.id.len() == 40));
    }
}
