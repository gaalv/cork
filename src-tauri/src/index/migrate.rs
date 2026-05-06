use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{Connection, OptionalExtension};

use crate::index::paths::index_db_path;
use crate::IpcError;

const SCHEMA: &str = include_str!("schema.sql");
const MIGRATION_003_ASSETS: &str = include_str!("migrations/003_assets.sql");
const SCHEMA_VERSION: i64 = 3;

pub fn open_index(app_data_dir: &Path, vault_path: &Path) -> Result<Connection, IpcError> {
    let db_path = index_db_path(app_data_dir, vault_path);
    open_index_at(&db_path)
}

pub fn open_index_at(db_path: &Path) -> Result<Connection, IpcError> {
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent)?;
    }

    match open_and_migrate(db_path) {
        Ok(conn) => Ok(conn),
        Err(first_error) => {
            remove_sqlite_files(db_path)?;
            open_and_migrate(db_path).map_err(|second_error| {
                IpcError::Other(format!(
                    "failed to recreate index after corruption ({first_error}); retry failed: {second_error}"
                ))
            })
        }
    }
}

fn open_and_migrate(db_path: &Path) -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open(db_path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    ensure_schema(&conn)?;
    Ok(conn)
}

fn ensure_schema(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(SCHEMA)?;
    let existing = conn
        .query_row("SELECT version FROM schema_version LIMIT 1", [], |row| row.get::<_, i64>(0))
        .optional()?;

    match existing {
        None => {
            conn.execute("INSERT INTO schema_version (version) VALUES (?1)", [SCHEMA_VERSION])?;
        }
        Some(version) if version < SCHEMA_VERSION => {
            run_migrations(conn, version)?;
            conn.execute("UPDATE schema_version SET version = ?1", [SCHEMA_VERSION])?;
        }
        _ => {}
    }

    Ok(())
}

fn run_migrations(conn: &Connection, current_version: i64) -> Result<(), rusqlite::Error> {
    if current_version < 3 {
        conn.execute_batch(MIGRATION_003_ASSETS)?;
    }
    Ok(())
}

fn remove_sqlite_files(db_path: &Path) -> Result<(), IpcError> {
    for path in sqlite_paths(db_path) {
        if path.exists() {
            fs::remove_file(path)?;
        }
    }
    Ok(())
}

fn sqlite_paths(db_path: &Path) -> [PathBuf; 3] {
    [
        db_path.to_path_buf(),
        db_path.with_extension("sqlite-wal"),
        db_path.with_extension("sqlite-shm"),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn fresh_database_gets_schema_and_wal_pragmas() {
        let dir = tempdir().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir(&vault).unwrap();

        let conn = open_index(dir.path(), &vault).unwrap();

        let version: i64 = conn
            .query_row("SELECT version FROM schema_version LIMIT 1", [], |row| row.get(0))
            .unwrap();
        let note_count: i64 = conn
            .query_row("SELECT count(*) FROM notes", [], |row| row.get(0))
            .unwrap();
        let journal_mode: String = conn
            .pragma_query_value(None, "journal_mode", |row| row.get(0))
            .unwrap();
        let asset_count: i64 = conn
            .query_row("SELECT count(*) FROM assets", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
        assert_eq!(note_count, 0);
        assert_eq!(asset_count, 0);
        assert_eq!(journal_mode.to_lowercase(), "wal");
    }

    #[test]
    fn migrates_existing_database_to_assets_schema() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("index.sqlite");
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER NOT NULL);
             INSERT INTO schema_version (version) VALUES (1);",
        )
        .unwrap();
        drop(conn);

        let conn = open_index_at(&db_path).unwrap();

        let version: i64 = conn
            .query_row("SELECT version FROM schema_version LIMIT 1", [], |row| row.get(0))
            .unwrap();
        let asset_count: i64 = conn
            .query_row("SELECT count(*) FROM assets", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
        assert_eq!(asset_count, 0);
    }

    #[test]
    fn corrupt_database_is_deleted_and_recreated() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("index.sqlite");
        fs::write(&db_path, b"not sqlite").unwrap();

        let conn = open_index_at(&db_path).unwrap();

        let count: i64 = conn
            .query_row("SELECT count(*) FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }
}
