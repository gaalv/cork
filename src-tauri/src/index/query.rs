use std::path::PathBuf;

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::error::sql_error;
use crate::vault::NoteEntry;
use crate::IpcError;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagCount {
    pub tag: String,
    pub count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteTagPair {
    pub note_id: String,
    pub tag: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkRow {
    pub src_note_id: String,
    pub target_text: String,
    pub target_id: Option<String>,
    pub position: i64,
    pub alias: Option<String>,
    pub ambiguous: bool,
}

pub fn all_paged(
    conn: &Connection,
    offset: usize,
    limit: usize,
) -> Result<Vec<NoteEntry>, IpcError> {
    let offset = offset.min(100_000) as i64;
    let limit = limit.clamp(1, 200) as i64;
    let mut stmt = conn
        .prepare(
            "SELECT id, path, folder, title, size, mtime, created
             FROM notes
             ORDER BY mtime DESC
             LIMIT ?1 OFFSET ?2",
        )
        .map_err(sql_error)?;
    let rows = stmt
        .query_map(params![limit, offset], note_from_row)
        .map_err(sql_error)?;
    collect_notes(rows)
}

pub fn by_tag(conn: &Connection, tag: &str) -> Result<Vec<NoteEntry>, IpcError> {
    let descendant = format!("{tag}/%");
    let mut stmt = conn
        .prepare(
            "SELECT n.id, n.path, n.folder, n.title, n.size, n.mtime, n.created
             FROM notes n
             JOIN note_tags nt ON nt.note_id = n.id
             WHERE nt.tag = ?1 OR nt.tag LIKE ?2
             ORDER BY n.mtime DESC",
        )
        .map_err(sql_error)?;
    let rows = stmt
        .query_map(params![tag, descendant], note_from_row)
        .map_err(sql_error)?;
    collect_notes(rows)
}

pub fn by_folder(conn: &Connection, folder: &str) -> Result<Vec<NoteEntry>, IpcError> {
    let prefix = if folder.is_empty() {
        "%".to_string()
    } else {
        format!("{folder}/%")
    };
    let mut stmt = conn
        .prepare(
            "SELECT id, path, folder, title, size, mtime, created
             FROM notes
             WHERE folder = ?1 OR folder LIKE ?2
             ORDER BY mtime DESC",
        )
        .map_err(sql_error)?;
    let rows = stmt
        .query_map(params![folder, prefix], note_from_row)
        .map_err(sql_error)?;
    collect_notes(rows)
}

pub fn by_id(conn: &Connection, id: &str) -> Result<Option<NoteEntry>, IpcError> {
    conn.query_row(
        "SELECT id, path, folder, title, size, mtime, created FROM notes WHERE id = ?1",
        [id],
        note_from_row,
    )
    .optional()
    .map_err(sql_error)
}

pub fn pinned(conn: &Connection) -> Result<Vec<NoteEntry>, IpcError> {
    let mut stmt = conn
        .prepare(
            "SELECT n.id, n.path, n.folder, n.title, n.size, n.mtime, n.created
             FROM notes n
             JOIN frontmatter fm ON fm.note_id = n.id
             WHERE fm.key = 'pinned' AND fm.value = 'true'
             ORDER BY n.mtime DESC",
        )
        .map_err(sql_error)?;
    let rows = stmt.query_map([], note_from_row).map_err(sql_error)?;
    collect_notes(rows)
}

pub fn tags_create(conn: &Connection, tag: &str) -> Result<(), IpcError> {
    conn.execute("INSERT OR IGNORE INTO tags (tag) VALUES (?1)", [tag])
        .map_err(sql_error)?;
    Ok(())
}

pub fn tags_rename(conn: &Connection, old_tag: &str, new_tag: &str) -> Result<Vec<PathBuf>, IpcError> {
    // Get all note paths that have this tag
    let mut stmt = conn
        .prepare(
            "SELECT n.path FROM notes n
             JOIN note_tags nt ON nt.note_id = n.id
             WHERE nt.tag = ?1",
        )
        .map_err(sql_error)?;
    let note_paths: Vec<PathBuf> = stmt
        .query_map([old_tag], |row| {
            Ok(PathBuf::from(row.get::<_, String>(0)?))
        })
        .map_err(sql_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(sql_error)?;

    // Ensure new tag exists
    conn.execute("INSERT OR IGNORE INTO tags (tag) VALUES (?1)", [new_tag])
        .map_err(sql_error)?;
    // Update note_tags references
    conn.execute(
        "UPDATE OR IGNORE note_tags SET tag = ?2 WHERE tag = ?1",
        [old_tag, new_tag],
    )
    .map_err(sql_error)?;
    // Clean up any remaining old references (duplicates from OR IGNORE)
    conn.execute("DELETE FROM note_tags WHERE tag = ?1", [old_tag])
        .map_err(sql_error)?;
    // Delete old tag
    conn.execute("DELETE FROM tags WHERE tag = ?1", [old_tag])
        .map_err(sql_error)?;

    Ok(note_paths)
}

pub fn tags_delete(conn: &Connection, tag: &str) -> Result<Vec<PathBuf>, IpcError> {
    // Get all note paths that have this tag
    let mut stmt = conn
        .prepare(
            "SELECT n.path FROM notes n
             JOIN note_tags nt ON nt.note_id = n.id
             WHERE nt.tag = ?1",
        )
        .map_err(sql_error)?;
    let note_paths: Vec<PathBuf> = stmt
        .query_map([tag], |row| {
            Ok(PathBuf::from(row.get::<_, String>(0)?))
        })
        .map_err(sql_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(sql_error)?;

    // Delete from note_tags and tags
    conn.execute("DELETE FROM note_tags WHERE tag = ?1", [tag])
        .map_err(sql_error)?;
    conn.execute("DELETE FROM tags WHERE tag = ?1", [tag])
        .map_err(sql_error)?;

    Ok(note_paths)
}

pub fn tags_list(conn: &Connection) -> Result<Vec<TagCount>, IpcError> {
    let mut stmt = conn
        .prepare(
            "SELECT t.tag, count(nt.note_id) AS count
             FROM tags t
             LEFT JOIN note_tags nt ON nt.tag = t.tag
             GROUP BY t.tag
             ORDER BY count DESC, t.tag ASC",
        )
        .map_err(sql_error)?;
    let rows = stmt
        .query_map([], |row| {
            Ok(TagCount {
                tag: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(sql_error)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(sql_error)
}

pub fn tags_note_map(conn: &Connection) -> Result<Vec<NoteTagPair>, IpcError> {
    let mut stmt = conn
        .prepare("SELECT note_id, tag FROM note_tags ORDER BY tag ASC")
        .map_err(sql_error)?;
    let rows = stmt
        .query_map([], |row| {
            Ok(NoteTagPair {
                note_id: row.get(0)?,
                tag: row.get(1)?,
            })
        })
        .map_err(sql_error)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(sql_error)
}

pub fn links_outgoing(conn: &Connection, note_id: &str) -> Result<Vec<LinkRow>, IpcError> {
    link_query(
        conn,
        "SELECT src_note_id, target_text, target_id, position, alias, ambiguous
         FROM links
         WHERE src_note_id = ?1
         ORDER BY position ASC",
        note_id,
    )
}

pub fn links_incoming(conn: &Connection, note_id: &str) -> Result<Vec<LinkRow>, IpcError> {
    link_query(
        conn,
        "SELECT src_note_id, target_text, target_id, position, alias, ambiguous
         FROM links
         WHERE target_id = ?1
         ORDER BY position ASC",
        note_id,
    )
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub title: String,
    pub folder: String,
    pub link_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

pub fn graph(conn: &Connection) -> Result<GraphData, IpcError> {
    let mut edge_stmt = conn
        .prepare(
            "SELECT src_note_id, target_id
             FROM links
             WHERE target_id IS NOT NULL AND src_note_id <> target_id",
        )
        .map_err(sql_error)?;
    let edge_rows = edge_stmt
        .query_map([], |row| {
            Ok(GraphEdge {
                source: row.get(0)?,
                target: row.get(1)?,
            })
        })
        .map_err(sql_error)?;
    let edges: Vec<GraphEdge> = edge_rows.collect::<Result<Vec<_>, _>>().map_err(sql_error)?;

    let mut node_stmt = conn
        .prepare(
            "SELECT n.id, n.title, n.folder,
                    (SELECT COUNT(*) FROM links l
                     WHERE l.src_note_id = n.id OR l.target_id = n.id) AS link_count
             FROM notes n",
        )
        .map_err(sql_error)?;
    let node_rows = node_stmt
        .query_map([], |row| {
            Ok(GraphNode {
                id: row.get(0)?,
                title: row.get(1)?,
                folder: row.get(2)?,
                link_count: row.get(3)?,
            })
        })
        .map_err(sql_error)?;
    let nodes = node_rows.collect::<Result<Vec<_>, _>>().map_err(sql_error)?;

    Ok(GraphData { nodes, edges })
}

fn collect_notes(
    rows: impl Iterator<Item = rusqlite::Result<NoteEntry>>,
) -> Result<Vec<NoteEntry>, IpcError> {
    rows.collect::<Result<Vec<_>, _>>().map_err(sql_error)
}

fn link_query(conn: &Connection, sql: &str, note_id: &str) -> Result<Vec<LinkRow>, IpcError> {
    let mut stmt = conn.prepare(sql).map_err(sql_error)?;
    let rows = stmt
        .query_map([note_id], |row| {
            Ok(LinkRow {
                src_note_id: row.get(0)?,
                target_text: row.get(1)?,
                target_id: row.get(2)?,
                position: row.get(3)?,
                alias: row.get(4)?,
                ambiguous: row.get::<_, i64>(5)? != 0,
            })
        })
        .map_err(sql_error)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(sql_error)
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

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::*;
    use crate::index::migrate::open_index_at;

    #[test]
    fn reads_notes_by_recent_tag_folder_and_id() {
        let dir = tempdir().unwrap();
        let conn = seeded_db(&dir.path().join("index.sqlite"));

        assert_eq!(all_paged(&conn, 0, 1).unwrap()[0].id, "n2");
        assert_eq!(
            all_paged(&conn, 1, 2)
                .unwrap()
                .iter()
                .map(|note| note.id.as_str())
                .collect::<Vec<_>>(),
            vec!["n1", "n3"]
        );
        assert_eq!(by_tag(&conn, "dev").unwrap().len(), 2);
        assert_eq!(by_tag(&conn, "dev/rust").unwrap().len(), 1);
        assert_eq!(by_folder(&conn, "work").unwrap().len(), 2);
        assert_eq!(by_id(&conn, "n1").unwrap().unwrap().title, "Alpha");
        assert!(by_id(&conn, "missing").unwrap().is_none());
        assert_eq!(pinned(&conn).unwrap()[0].id, "n2");
    }

    #[test]
    fn lists_tags_by_count_then_name() {
        let dir = tempdir().unwrap();
        let conn = seeded_db(&dir.path().join("index.sqlite"));

        let tags = tags_list(&conn).unwrap();

        assert_eq!(
            tags[0],
            TagCount {
                tag: "dev".to_string(),
                count: 1
            }
        );
        assert!(tags
            .iter()
            .any(|tag| tag.tag == "dev/rust" && tag.count == 1));
    }

    #[test]
    fn reads_outgoing_and_incoming_links() {
        let dir = tempdir().unwrap();
        let conn = seeded_db(&dir.path().join("index.sqlite"));

        assert_eq!(links_outgoing(&conn, "n1").unwrap()[0].target_text, "Beta");
        let incoming = links_incoming(&conn, "n2").unwrap();
        assert_eq!(incoming.len(), 1);
        assert_eq!(incoming[0].src_note_id, "n1");
    }

    fn seeded_db(path: &std::path::Path) -> Connection {
        let conn = open_index_at(path).unwrap();
        conn.execute(
            "INSERT INTO notes (id, path, folder, title, size, mtime, body_hash) VALUES
             ('n1', '/vault/alpha.md', '', 'Alpha', 10, 100, 'h1'),
             ('n2', '/vault/work/beta.md', 'work', 'Beta', 20, 200, 'h2'),
             ('n3', '/vault/work/nested/gamma.md', 'work/nested', 'Gamma', 30, 50, 'h3')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO tags (tag) VALUES ('dev'), ('dev/rust'), ('idea')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO note_tags (note_id, tag) VALUES ('n1', 'dev'), ('n2', 'dev/rust'), ('n3', 'idea')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO links (src_note_id, target_text, target_id, position, alias, ambiguous) VALUES
             ('n1', 'Beta', 'n2', 7, 'B', 0),
             ('n3', 'Missing', NULL, 9, NULL, 0)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO frontmatter (note_id, key, value) VALUES ('n2', 'pinned', 'true'), ('n3', 'pinned', 'false')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO notes_fts (id, title, body) VALUES ('n1', 'Alpha', 'plain body'), ('n2', 'Beta', 'rust body'), ('n3', 'Gamma', 'other')",
            [],
        )
        .unwrap();
        conn
    }
}
