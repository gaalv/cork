use std::path::{Path, PathBuf};

use regex::Regex;
use rusqlite::Connection;

use crate::index::migrate::open_index;
use crate::vault::fingerprint::FingerprintCache;
use crate::vault::io;
use crate::vault::{SaveInput, SaveResult};
use crate::IpcError;

pub fn rewrite_after_rename(
    app_data_dir: &Path,
    vault_root: &Path,
    old_path: &Path,
    new_path: &Path,
    rewrite: bool,
    fingerprint_cache: &FingerprintCache,
) -> Result<Vec<SaveResult>, IpcError> {
    if !rewrite {
        return Ok(Vec::new());
    }
    let old_title = file_stem(old_path)?;
    let new_title = file_stem(new_path)?;
    if old_title == new_title {
        return Ok(Vec::new());
    }

    let conn = open_index(app_data_dir, vault_root)?;
    let source_paths = source_paths_for_target(&conn, &old_title)?;
    let regex = wikilink_target_regex(&old_title)?;
    let mut rewritten = Vec::new();

    for source_path in source_paths {
        if !source_path.exists() || source_path == new_path {
            continue;
        }
        let note = io::read_note(&source_path)?;
        let body = regex
            .replace_all(&note.body, |captures: &regex::Captures<'_>| {
                let alias = captures.get(1).map_or("", |value| value.as_str());
                format!("[[{new_title}{alias}]]")
            })
            .to_string();
        if body == note.body {
            continue;
        }
        let result = io::save_atomic(
            &SaveInput {
                path: source_path,
                frontmatter: note.frontmatter,
                body,
                expected_mtime: Some(note.mtime),
            },
            fingerprint_cache,
        )?;
        rewritten.push(result);
    }

    Ok(rewritten)
}

fn source_paths_for_target(conn: &Connection, target: &str) -> Result<Vec<PathBuf>, IpcError> {
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT n.path
             FROM links l
             JOIN notes n ON n.id = l.src_note_id
             WHERE LOWER(l.target_text) = LOWER(?1)",
        )
        .map_err(sql_error)?;
    let rows = stmt
        .query_map([target], |row| row.get::<_, String>(0))
        .map_err(sql_error)?;
    rows.map(|row| row.map(PathBuf::from))
        .collect::<Result<Vec<_>, _>>()
        .map_err(sql_error)
}

fn wikilink_target_regex(target: &str) -> Result<Regex, IpcError> {
    Regex::new(&format!(
        r"\[\[\s*{}\s*(\|[^\]]+)?\]\]",
        regex::escape(target)
    ))
    .map_err(|err| IpcError::Other(err.to_string()))
}

fn file_stem(path: &Path) -> Result<String, IpcError> {
    path.file_stem()
        .and_then(|stem| stem.to_str())
        .map(ToString::to_string)
        .ok_or_else(|| IpcError::Io("note path has no file stem".to_string()))
}

fn sql_error(error: rusqlite::Error) -> IpcError {
    IpcError::Other(error.to_string())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;
    use crate::index::worker::build_all;

    #[test]
    fn rewrites_sources_after_note_rename() {
        let dir = tempdir().unwrap();
        let app_data = dir.path().join("app-data");
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let target_old = vault.join("A.md");
        let target_new = vault.join("B.md");
        fs::write(&target_old, "# A\n").unwrap();
        for index in 0..5 {
            fs::write(
                vault.join(format!("source-{index}.md")),
                format!("# Source {index}\nSee [[A]] and [[A|alias]]."),
            )
            .unwrap();
        }
        let mut conn = open_index(&app_data, &vault).unwrap();
        build_all(&mut conn, &vault, None).unwrap();
        fs::rename(&target_old, &target_new).unwrap();

        let rewritten = rewrite_after_rename(
            &app_data,
            &vault,
            &target_old,
            &target_new,
            true,
            &FingerprintCache::new(),
        )
        .unwrap();

        assert_eq!(rewritten.len(), 5);
        for index in 0..5 {
            let body = fs::read_to_string(vault.join(format!("source-{index}.md"))).unwrap();
            assert!(body.contains("[[B]] and [[B|alias]]"));
        }
    }

    #[test]
    fn skips_rewrite_when_disabled() {
        let dir = tempdir().unwrap();
        let app_data = dir.path().join("app-data");
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let target_old = vault.join("A.md");
        let target_new = vault.join("B.md");
        fs::write(&target_old, "# A\n").unwrap();
        fs::write(vault.join("source.md"), "# Source\nSee [[A]].").unwrap();
        let mut conn = open_index(&app_data, &vault).unwrap();
        build_all(&mut conn, &vault, None).unwrap();
        fs::rename(&target_old, &target_new).unwrap();

        let rewritten = rewrite_after_rename(
            &app_data,
            &vault,
            &target_old,
            &target_new,
            false,
            &FingerprintCache::new(),
        )
        .unwrap();

        assert!(rewritten.is_empty());
        assert!(fs::read_to_string(vault.join("source.md"))
            .unwrap()
            .contains("[[A]]"));
    }
}
