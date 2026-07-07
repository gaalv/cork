use std::path::PathBuf;

use rusqlite::{params, Connection};
use serde::Serialize;

use crate::error::sql_error;
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
            "SELECT n.id, n.path, n.folder, n.title, n.size, n.mtime, n.created,
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
                snippet: row.get(7)?,
                rank: row.get(8)?,
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
    let mtime: i64 = row.get(5)?;
    let ctime: Option<i64> = row.get(6)?;
    Ok(NoteEntry {
        id: row.get(0)?,
        path: PathBuf::from(row.get::<_, String>(1)?),
        folder: row.get(2)?,
        title: row.get(3)?,
        snippet: String::new(),
        size: size as u64,
        mtime,
        ctime: ctime.unwrap_or(mtime),
    })
}
