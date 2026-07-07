use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Sender};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::Value;
use sha1::{Digest, Sha1};
use walkdir::WalkDir;

use crate::error::sql_error;
use crate::index::migrate::open_index_at;
use crate::index::parser::{parse, ParsedNote};
use crate::index::resolver;
use crate::vault::io::{metadata_mtime_ms, to_slash_string};
use crate::vault::list::{asset_kind, is_markdown, sha1_hex};
use crate::IpcError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IndexJob {
    BuildAll,
    Upsert(PathBuf),
    Remove(PathBuf),
    Rename {
        old_path: PathBuf,
        new_path: PathBuf,
    },
    Shutdown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexProgress {
    pub processed: usize,
    pub total: usize,
    pub phase: IndexPhase,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum IndexPhase {
    Building,
    Updating,
    Removing,
    Renaming,
}

pub type ProgressSink = Arc<dyn Fn(IndexProgress) + Send + Sync + 'static>;
pub type ErrorSink = Arc<dyn Fn(String) + Send + Sync + 'static>;
/// Invoked after each successfully processed job (Upsert/Remove/Rename/BuildAll).
/// The frontend listens to a corresponding event to refresh derived views
/// (pinned drawer, tag tree, etc.) once the index has caught up.
pub type UpdateSink = Arc<dyn Fn() + Send + Sync + 'static>;

pub fn spawn_worker(
    db_path: PathBuf,
    vault_path: PathBuf,
    progress_sink: Option<ProgressSink>,
    error_sink: Option<ErrorSink>,
    update_sink: Option<UpdateSink>,
) -> Sender<IndexJob> {
    let (sender, receiver) = mpsc::channel::<IndexJob>();
    thread::spawn(move || {
        let mut conn = match open_index_at(&db_path) {
            Ok(conn) => conn,
            Err(error) => {
                emit_error(&error_sink, error.to_string());
                return;
            }
        };
        while let Ok(job) = receiver.recv() {
            let result = match job {
                IndexJob::BuildAll => build_all(&mut conn, &vault_path, progress_sink.as_deref()),
                IndexJob::Upsert(path) => {
                    upsert_path(&mut conn, &vault_path, &path, progress_sink.as_deref())
                }
                IndexJob::Remove(path) => remove_path(&mut conn, &path, progress_sink.as_deref()),
                IndexJob::Rename { old_path, new_path } => rename_path(
                    &mut conn,
                    &vault_path,
                    &old_path,
                    &new_path,
                    progress_sink.as_deref(),
                ),
                IndexJob::Shutdown => break,
            };
            if let Err(error) = result {
                emit_error(&error_sink, error.to_string());
            } else if let Some(sink) = update_sink.as_deref() {
                sink();
            }
        }
    });
    sender
}

pub fn build_all(
    conn: &mut Connection,
    vault_path: &Path,
    progress_sink: Option<&(dyn Fn(IndexProgress) + Send + Sync + 'static)>,
) -> Result<(), IpcError> {
    let files = indexable_files(vault_path)?;
    let total = files.len();
    emit_progress(progress_sink, 0, total, IndexPhase::Building);
    conn.execute("DELETE FROM assets", []).map_err(sql_error)?;

    let live_note_ids: BTreeSet<String> = files
        .iter()
        .filter(|path| is_markdown(path))
        .map(|path| note_id(path))
        .collect();

    let mut last_emit = Instant::now();
    for (index, chunk) in files.chunks(100).enumerate() {
        let tx = conn.transaction().map_err(sql_error)?;
        for path in chunk {
            upsert_path_in_tx(&tx, vault_path, path)?;
        }
        tx.commit().map_err(sql_error)?;
        let processed = ((index + 1) * 100).min(total);
        if processed == total
            || processed % 50 == 0
            || last_emit.elapsed() >= Duration::from_millis(100)
        {
            emit_progress(progress_sink, processed, total, IndexPhase::Building);
            last_emit = Instant::now();
        }
    }

    purge_stale_notes(conn, &live_note_ids)?;
    resolve_all_links(conn)?;
    if total == 0 {
        emit_progress(progress_sink, 0, 0, IndexPhase::Building);
    }
    Ok(())
}

pub fn upsert_path(
    conn: &mut Connection,
    vault_path: &Path,
    path: &Path,
    progress_sink: Option<&(dyn Fn(IndexProgress) + Send + Sync + 'static)>,
) -> Result<(), IpcError> {
    let id = note_id(path);
    let mut affected_terms = collect_note_terms(conn, &id)?;
    let tx = conn.transaction().map_err(sql_error)?;
    upsert_path_in_tx(&tx, vault_path, path)?;
    tx.commit().map_err(sql_error)?;
    affected_terms.extend(collect_note_terms(conn, &id)?);
    resolve_links_for_source(conn, &id)?;
    resolve_links_matching_targets(conn, &affected_terms)?;
    emit_progress(progress_sink, 1, 1, IndexPhase::Updating);
    Ok(())
}

pub fn remove_path(
    conn: &mut Connection,
    path: &Path,
    progress_sink: Option<&(dyn Fn(IndexProgress) + Send + Sync + 'static)>,
) -> Result<(), IpcError> {
    let id = note_id(path);
    let affected_terms = collect_note_terms(conn, &id)?;
    let tx = conn.transaction().map_err(sql_error)?;
    tx.execute("DELETE FROM notes_fts WHERE id = ?1", [&id])
        .map_err(sql_error)?;
    tx.execute("DELETE FROM notes WHERE id = ?1", [&id])
        .map_err(sql_error)?;
    tx.execute("DELETE FROM assets WHERE path = ?1", [path_string(path)])
        .map_err(sql_error)?;
    tx.commit().map_err(sql_error)?;
    resolve_links_matching_targets(conn, &affected_terms)?;
    emit_progress(progress_sink, 1, 1, IndexPhase::Removing);
    Ok(())
}

pub fn rename_path(
    conn: &mut Connection,
    vault_path: &Path,
    old_path: &Path,
    new_path: &Path,
    progress_sink: Option<&(dyn Fn(IndexProgress) + Send + Sync + 'static)>,
) -> Result<(), IpcError> {
    if asset_kind(new_path).is_some() {
        conn.execute(
            "DELETE FROM assets WHERE path = ?1",
            [path_string(old_path)],
        )
        .map_err(sql_error)?;
        let tx = conn.transaction().map_err(sql_error)?;
        upsert_asset_in_tx(&tx, new_path)?;
        tx.commit().map_err(sql_error)?;
        emit_progress(progress_sink, 1, 1, IndexPhase::Renaming);
        return Ok(());
    }

    let old_id = note_id(old_path);
    let mut affected_terms = collect_note_terms(conn, &old_id)?;
    let metadata = fs::metadata(new_path)?;
    let folder = folder_for(vault_path, new_path);
    let title = new_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("Untitled")
        .to_string();
    conn.execute(
        "UPDATE notes SET path = ?1, folder = ?2, title = ?3, size = ?4, mtime = ?5 WHERE id = ?6",
        params![
            path_string(new_path),
            folder,
            title,
            metadata.len() as i64,
            metadata_mtime_ms(&metadata)?,
            old_id
        ],
    )
    .map_err(sql_error)?;
    affected_terms.extend(collect_note_terms(conn, &old_id)?);
    resolve_links_matching_targets(conn, &affected_terms)?;
    emit_progress(progress_sink, 1, 1, IndexPhase::Renaming);
    Ok(())
}

fn upsert_path_in_tx(
    tx: &rusqlite::Transaction<'_>,
    vault_path: &Path,
    path: &Path,
) -> Result<(), IpcError> {
    if asset_kind(path).is_some() {
        return upsert_asset_in_tx(tx, path);
    }
    if !is_markdown(path) {
        return Ok(());
    }

    let metadata = fs::metadata(path)?;
    let content = fs::read_to_string(path).unwrap_or_default();
    let parsed = parse(&content, &path_string(path))?;
    let id = note_id(path);

    let existing_hash = tx
        .query_row("SELECT body_hash FROM notes WHERE id = ?1", [&id], |row| {
            row.get::<_, String>(0)
        })
        .optional()
        .map_err(sql_error)?;
    if existing_hash.as_deref() == Some(parsed.body_hash.as_str()) {
        tx.execute(
            "UPDATE notes SET path = ?1, folder = ?2, title = ?3, size = ?4, mtime = ?5 WHERE id = ?6",
            params![
                path_string(path),
                folder_for(vault_path, path),
                parsed.title,
                metadata.len() as i64,
                metadata_mtime_ms(&metadata)?,
                id
            ],
        )
        .map_err(sql_error)?;
        // Re-index frontmatter even when body unchanged (e.g. pinned toggle)
        tx.execute("DELETE FROM frontmatter WHERE note_id = ?1", [&id])
            .map_err(sql_error)?;
        if let Value::Object(map) = &parsed.frontmatter {
            for (key, value) in map {
                tx.execute(
                    "INSERT INTO frontmatter (note_id, key, value) VALUES (?1, ?2, ?3)",
                    params![
                        id,
                        key,
                        serde_json::to_string(value).map_err(|err| IpcError::Other(err.to_string()))?
                    ],
                )
                .map_err(sql_error)?;
            }
        }
        return Ok(());
    }

    replace_note_rows(tx, vault_path, path, &metadata, &parsed, &id)
}

fn replace_note_rows(
    tx: &rusqlite::Transaction<'_>,
    vault_path: &Path,
    path: &Path,
    metadata: &fs::Metadata,
    parsed: &ParsedNote,
    id: &str,
) -> Result<(), IpcError> {
    tx.execute("DELETE FROM notes_fts WHERE id = ?1", [id])
        .map_err(sql_error)?;
    tx.execute("DELETE FROM notes WHERE id = ?1", [id])
        .map_err(sql_error)?;
    tx.execute(
        "INSERT INTO notes (id, path, folder, title, size, mtime, created, updated, body_hash)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            path_string(path),
            folder_for(vault_path, path),
            parsed.title,
            metadata.len() as i64,
            metadata_mtime_ms(metadata)?,
            frontmatter_i64(&parsed.frontmatter, "created"),
            frontmatter_i64(&parsed.frontmatter, "updated"),
            parsed.body_hash,
        ],
    )
    .map_err(sql_error)?;

    for tag in &parsed.tags {
        tx.execute("INSERT OR IGNORE INTO tags (tag) VALUES (?1)", [tag])
            .map_err(sql_error)?;
        tx.execute(
            "INSERT OR IGNORE INTO note_tags (note_id, tag) VALUES (?1, ?2)",
            params![id, tag],
        )
        .map_err(sql_error)?;
    }

    for link in &parsed.links {
        tx.execute(
            "INSERT INTO links (src_note_id, target_text, target_id, position, alias) VALUES (?1, ?2, NULL, ?3, ?4)",
            params![id, link.target_text, link.position as i64, link.alias],
        )
        .map_err(sql_error)?;
    }

    if let Value::Object(map) = &parsed.frontmatter {
        for (key, value) in map {
            tx.execute(
                "INSERT INTO frontmatter (note_id, key, value) VALUES (?1, ?2, ?3)",
                params![
                    id,
                    key,
                    serde_json::to_string(value).map_err(|err| IpcError::Other(err.to_string()))?
                ],
            )
            .map_err(sql_error)?;
        }
    }

    tx.execute(
        "INSERT INTO notes_fts (id, title, body) VALUES (?1, ?2, ?3)",
        params![id, parsed.title, parsed.body],
    )
    .map_err(sql_error)?;
    Ok(())
}

fn purge_stale_notes(conn: &mut Connection, live_ids: &BTreeSet<String>) -> Result<(), IpcError> {
    let mut stmt = conn
        .prepare("SELECT id FROM notes")
        .map_err(sql_error)?;
    let stale_ids: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(sql_error)?
        .filter_map(|r| r.ok())
        .filter(|id| !live_ids.contains(id))
        .collect();
    drop(stmt);

    if !stale_ids.is_empty() {
        let tx = conn.transaction().map_err(sql_error)?;
        for id in &stale_ids {
            tx.execute("DELETE FROM notes_fts WHERE id = ?1", [id])
                .map_err(sql_error)?;
            tx.execute("DELETE FROM notes WHERE id = ?1", [id])
                .map_err(sql_error)?;
        }
        tx.commit().map_err(sql_error)?;
    }
    Ok(())
}

fn resolve_all_links(conn: &Connection) -> Result<(), IpcError> {
    let links = collect_link_rows(
        conn,
        "SELECT l.rowid, l.target_text, COALESCE(n.folder, '')
         FROM links l
         LEFT JOIN notes n ON n.id = l.src_note_id",
        [],
    )?;
    resolve_link_rows(conn, links)
}

fn resolve_links_for_source(conn: &Connection, note_id: &str) -> Result<(), IpcError> {
    let links = collect_link_rows(
        conn,
        "SELECT l.rowid, l.target_text, COALESCE(n.folder, '')
         FROM links l
         LEFT JOIN notes n ON n.id = l.src_note_id
         WHERE l.src_note_id = ?1",
        [note_id],
    )?;
    resolve_link_rows(conn, links)
}

fn resolve_links_matching_targets(
    conn: &Connection,
    targets: &BTreeSet<String>,
) -> Result<(), IpcError> {
    for target in targets {
        let links = collect_link_rows(
            conn,
            "SELECT l.rowid, l.target_text, COALESCE(n.folder, '')
             FROM links l
             LEFT JOIN notes n ON n.id = l.src_note_id
             WHERE LOWER(l.target_text) = LOWER(?1)",
            [target.as_str()],
        )?;
        resolve_link_rows(conn, links)?;
    }
    Ok(())
}

fn collect_link_rows<P: rusqlite::Params>(
    conn: &Connection,
    sql: &str,
    params: P,
) -> Result<Vec<(i64, String, String)>, IpcError> {
    let mut stmt = conn.prepare(sql).map_err(sql_error)?;
    let rows = stmt
        .query_map(params, |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(sql_error)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(sql_error)
}

fn resolve_link_rows(conn: &Connection, links: Vec<(i64, String, String)>) -> Result<(), IpcError> {
    for (rowid, target_text, source_folder) in links {
        let resolved = resolver::resolve(&target_text, conn, &source_folder)?;
        match resolved {
            Some(resolution) => {
                conn.execute(
                    "UPDATE links SET target_id = ?1, ambiguous = ?2 WHERE rowid = ?3",
                    params![resolution.target_id, i64::from(resolution.ambiguous), rowid],
                )
                .map_err(sql_error)?;
            }
            None => {
                conn.execute(
                    "UPDATE links SET target_id = NULL, ambiguous = 0 WHERE rowid = ?1",
                    [rowid],
                )
                .map_err(sql_error)?;
            }
        }
    }
    Ok(())
}

fn collect_note_terms(conn: &Connection, note_id: &str) -> Result<BTreeSet<String>, IpcError> {
    let mut terms = BTreeSet::new();
    let note = conn
        .query_row(
            "SELECT path, title FROM notes WHERE id = ?1",
            [note_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()
        .map_err(sql_error)?;
    if let Some((path, title)) = note {
        terms.insert(filename_stem(&path).to_string());
        terms.insert(title);
    }
    let aliases = conn
        .query_row(
            "SELECT value FROM frontmatter WHERE note_id = ?1 AND key = 'aliases'",
            [note_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(sql_error)?;
    if let Some(value) = aliases {
        if let Ok(values) = serde_json::from_str::<Vec<String>>(&value) {
            terms.extend(values);
        }
    }
    Ok(terms
        .into_iter()
        .filter(|term| !term.trim().is_empty())
        .collect())
}

fn filename_stem(path: &str) -> &str {
    Path::new(path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(path)
}

fn indexable_files(root: &Path) -> Result<Vec<PathBuf>, IpcError> {
    let mut files = Vec::new();
    for entry in WalkDir::new(root).follow_links(false) {
        let entry = entry.map_err(|err| IpcError::Io(err.to_string()))?;
        if entry.file_type().is_file()
            && (is_markdown(entry.path()) || asset_kind(entry.path()).is_some())
        {
            files.push(entry.path().to_path_buf());
        }
    }
    files.sort();
    Ok(files)
}

fn upsert_asset_in_tx(tx: &rusqlite::Transaction<'_>, path: &Path) -> Result<(), IpcError> {
    let metadata = fs::metadata(path)?;
    let kind = asset_kind(path)
        .ok_or_else(|| IpcError::Other("unsupported asset extension".to_string()))?;
    tx.execute(
        "INSERT OR REPLACE INTO assets (path, kind, size, mtime, sha1) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            path_string(path),
            kind.as_str(),
            metadata.len() as i64,
            metadata_mtime_ms(&metadata)?,
            file_sha1(path)?,
        ],
    )
    .map_err(sql_error)?;
    Ok(())
}

fn file_sha1(path: &Path) -> Result<String, IpcError> {
    let bytes = fs::read(path)?;
    let mut hasher = Sha1::new();
    hasher.update(&bytes);
    Ok(hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

fn note_id(path: &Path) -> String {
    sha1_hex(path_string(path).as_bytes())
}

fn folder_for(vault_path: &Path, path: &Path) -> String {
    path.parent()
        .and_then(|parent| parent.strip_prefix(vault_path).ok())
        .map(|relative| to_slash_string(relative))
        .unwrap_or_default()
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn frontmatter_i64(frontmatter: &Value, key: &str) -> Option<i64> {
    frontmatter.get(key).and_then(|value| match value {
        Value::Number(number) => number.as_i64(),
        Value::String(text) => text.parse::<i64>().ok(),
        _ => None,
    })
}

fn emit_progress(
    progress_sink: Option<&(dyn Fn(IndexProgress) + Send + Sync + 'static)>,
    processed: usize,
    total: usize,
    phase: IndexPhase,
) {
    if let Some(sink) = progress_sink {
        sink(IndexProgress {
            processed,
            total,
            phase,
        });
    }
}

fn emit_error(error_sink: &Option<ErrorSink>, message: String) {
    if let Some(sink) = error_sink {
        sink(message);
    }
}
