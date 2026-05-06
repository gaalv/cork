use std::path::PathBuf;

use rusqlite::{params, Connection};
use serde::Serialize;

use crate::vault::NoteEntry;
use crate::IpcError;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    #[serde(flatten)]
    pub note: NoteEntry,
    pub snippet: String,
    pub rank: f64,
}

pub fn search(
    conn: &Connection,
    query: &str,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, IpcError> {
    let Some(match_query) = escape_query(query) else {
        return Ok(Vec::new());
    };
    search_escaped(conn, &match_query, limit)
}

fn search_escaped(
    conn: &Connection,
    match_query: &str,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, IpcError> {
    let limit = limit.unwrap_or(30).min(200) as i64;
    let mut stmt = conn
        .prepare(
            "SELECT n.id, n.path, n.folder, n.title, n.size, n.mtime,
                    snippet(notes_fts, 2, '<mark>', '</mark>', '…', 16) AS snippet,
                    bm25(notes_fts) AS rank
             FROM notes_fts
             JOIN notes n ON n.id = notes_fts.id
             WHERE notes_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2",
        )
        .map_err(sql_error)?;
    let rows = stmt
        .query_map(params![match_query, limit], |row| {
            Ok(SearchResult {
                note: note_from_row(row)?,
                snippet: row.get(6)?,
                rank: row.get(7)?,
            })
        })
        .map_err(sql_error)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(sql_error)
}

fn escape_query(query: &str) -> Option<String> {
    let terms = query
        .split_whitespace()
        .flat_map(|raw| raw.split(is_token_separator))
        .filter(|token| !token.is_empty())
        .map(|token| format!("\"{}\"*", token.replace('"', "\"\"")))
        .collect::<Vec<_>>();

    if terms.is_empty() {
        None
    } else {
        Some(terms.join(" "))
    }
}

fn is_token_separator(ch: char) -> bool {
    !(ch.is_alphanumeric() || ch == '_' || ch == '-')
}

fn note_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NoteEntry> {
    let size: i64 = row.get(4)?;
    Ok(NoteEntry {
        id: row.get(0)?,
        path: PathBuf::from(row.get::<_, String>(1)?),
        folder: row.get(2)?,
        title: row.get(3)?,
        size: size as u64,
        mtime: row.get(5)?,
    })
}

fn sql_error(error: rusqlite::Error) -> IpcError {
    IpcError::Other(error.to_string())
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::*;
    use crate::index::migrate::open_index_at;

    #[test]
    fn searches_plain_query() {
        let dir = tempdir().unwrap();
        let conn = seeded_db(&dir.path().join("index.sqlite"));

        let results = search(&conn, "rust", Some(10)).unwrap();

        assert_eq!(results[0].note.id, "n2");
        assert!(results[0].snippet.contains("rust"));
    }

    #[test]
    fn searches_prefix_query() {
        let dir = tempdir().unwrap();
        let conn = seeded_db(&dir.path().join("index.sqlite"));

        let results = search(&conn, "rus", Some(10)).unwrap();

        assert_eq!(results[0].note.id, "n2");
    }

    #[test]
    fn escapes_special_characters() {
        let dir = tempdir().unwrap();
        let conn = seeded_db(&dir.path().join("index.sqlite"));

        let results = search(&conn, "c++", Some(10)).unwrap();

        assert_eq!(results[0].note.id, "n2");
        assert!(search(&conn, "rust OR nope", Some(10)).unwrap().is_empty());
    }

    #[test]
    fn returns_empty_for_empty_query() {
        let dir = tempdir().unwrap();
        let conn = seeded_db(&dir.path().join("index.sqlite"));

        assert!(search(&conn, " ++ ", Some(10)).unwrap().is_empty());
    }

    #[test]
    fn escapes_to_quoted_prefix_terms() {
        assert_eq!(
            escape_query("alpha beta"),
            Some("\"alpha\"* \"beta\"*".to_string())
        );
        assert_eq!(escape_query("c++"), Some("\"c\"*".to_string()));
        assert_eq!(escape_query("***"), None);
    }

    fn seeded_db(path: &std::path::Path) -> Connection {
        let conn = open_index_at(path).unwrap();
        conn.execute(
            "INSERT INTO notes (id, path, folder, title, size, mtime, body_hash) VALUES
             ('n1', '/vault/alpha.md', '', 'Alpha', 10, 100, 'h1'),
             ('n2', '/vault/work/beta.md', 'work', 'Rust Beta', 20, 200, 'h2'),
             ('n3', '/vault/work/gamma.md', 'work', 'Gamma', 30, 50, 'h3')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO notes_fts (id, title, body) VALUES
             ('n1', 'Alpha', 'plain body'),
             ('n2', 'Rust Beta', 'rust body with c examples'),
             ('n3', 'Gamma', 'other')",
            [],
        )
        .unwrap();
        conn
    }
}
