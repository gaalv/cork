use std::collections::HashMap;
use std::path::Path;

use rusqlite::{params, Connection};

use crate::IpcError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LinkResolution {
    pub target_id: String,
    pub ambiguous: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Candidate {
    id: String,
    mtime: i64,
}

pub fn resolve(
    target: &str,
    db: &Connection,
    _source_folder: &str,
) -> Result<Option<LinkResolution>, IpcError> {
    let target = target.trim();
    if target.is_empty() {
        return Ok(None);
    }

    let mut candidates = Vec::new();
    candidates.extend(filename_candidates(db, target)?);
    candidates.extend(title_candidates(db, target)?);
    candidates.extend(alias_candidates(db, target)?);

    let mut by_id: HashMap<String, Candidate> = HashMap::new();
    for candidate in candidates {
        by_id
            .entry(candidate.id.clone())
            .and_modify(|existing| existing.mtime = existing.mtime.max(candidate.mtime))
            .or_insert(candidate);
    }

    let ambiguous = by_id.len() > 1;
    Ok(by_id
        .into_values()
        .max_by_key(|candidate| candidate.mtime)
        .map(|candidate| LinkResolution {
            target_id: candidate.id,
            ambiguous,
        }))
}

fn filename_candidates(conn: &Connection, target: &str) -> Result<Vec<Candidate>, IpcError> {
    let mut stmt = conn
        .prepare("SELECT id, path, mtime FROM notes ORDER BY mtime DESC")
        .map_err(sql_error)?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })
        .map_err(sql_error)?;
    let normalized = normalize(target);
    let mut candidates = Vec::new();
    for row in rows {
        let (id, path, mtime) = row.map_err(sql_error)?;
        if normalize(filename_stem(&path)) == normalized {
            candidates.push(Candidate { id, mtime });
        }
    }
    Ok(candidates)
}

fn title_candidates(conn: &Connection, target: &str) -> Result<Vec<Candidate>, IpcError> {
    let mut stmt = conn
        .prepare("SELECT id, mtime FROM notes WHERE LOWER(title) = LOWER(?1) ORDER BY mtime DESC")
        .map_err(sql_error)?;
    let rows = stmt
        .query_map([target], |row| {
            Ok(Candidate {
                id: row.get(0)?,
                mtime: row.get(1)?,
            })
        })
        .map_err(sql_error)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(sql_error)
}

fn alias_candidates(conn: &Connection, target: &str) -> Result<Vec<Candidate>, IpcError> {
    let mut stmt = conn
        .prepare(
            "SELECT n.id, n.mtime
             FROM notes n
             JOIN frontmatter f ON f.note_id = n.id
             JOIN json_each(f.value) alias
             WHERE f.key = 'aliases' AND LOWER(alias.value) = LOWER(?1)
             ORDER BY n.mtime DESC",
        )
        .map_err(sql_error)?;
    let rows = stmt
        .query_map(params![target], |row| {
            Ok(Candidate {
                id: row.get(0)?,
                mtime: row.get(1)?,
            })
        })
        .map_err(sql_error)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(sql_error)
}

fn filename_stem(path: &str) -> &str {
    Path::new(path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(path)
}

fn normalize(value: &str) -> String {
    value.trim().to_lowercase()
}

fn sql_error(error: rusqlite::Error) -> IpcError {
    IpcError::Other(error.to_string())
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::*;
    use crate::index::migrate::open_index_at;

    #[test]
    fn resolves_by_filename_case_insensitively() {
        let conn = seeded_db();

        let resolved = resolve("alpha", &conn, "").unwrap().unwrap();

        assert_eq!(resolved.target_id, "n1");
        assert!(!resolved.ambiguous);
    }

    #[test]
    fn resolves_by_title() {
        let conn = seeded_db();

        let resolved = resolve("Beta Title", &conn, "").unwrap().unwrap();

        assert_eq!(resolved.target_id, "n2");
        assert!(!resolved.ambiguous);
    }

    #[test]
    fn resolves_by_alias() {
        let conn = seeded_db();

        let resolved = resolve("Project Codename", &conn, "").unwrap().unwrap();

        assert_eq!(resolved.target_id, "n3");
        assert!(!resolved.ambiguous);
    }

    #[test]
    fn marks_collision_ambiguous_and_picks_most_recent() {
        let conn = seeded_db();

        let resolved = resolve("Collision", &conn, "").unwrap().unwrap();

        assert_eq!(resolved.target_id, "n5");
        assert!(resolved.ambiguous);
    }

    #[test]
    fn returns_none_for_missing_target() {
        let conn = seeded_db();

        assert!(resolve("Missing", &conn, "").unwrap().is_none());
    }

    fn seeded_db() -> Connection {
        let dir = tempfile::tempdir().unwrap();
        let conn = open_index_at(&dir.path().join("index.sqlite")).unwrap();
        conn.execute(
            "INSERT INTO notes (id, path, folder, title, size, mtime, body_hash) VALUES
             ('n1', '/vault/Alpha.md', '', 'Alpha Heading', 10, 100, 'h1'),
             ('n2', '/vault/folder/beta.md', 'folder', 'Beta Title', 10, 200, 'h2'),
             ('n3', '/vault/gamma.md', '', 'Gamma', 10, 300, 'h3'),
             ('n4', '/vault/collision.md', '', 'Old Collision', 10, 400, 'h4'),
             ('n5', '/vault/other.md', '', 'Collision', 10, 500, 'h5')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO frontmatter (note_id, key, value) VALUES ('n3', 'aliases', '[\"Project Codename\",\"Gamma Alias\"]')",
            [],
        )
        .unwrap();
        conn
    }
}
