use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::Connection;

use crate::IpcError;

const SCHEMA: &str = r#"
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ai_cache (
  key         TEXT PRIMARY KEY,
  skill_id    TEXT NOT NULL,
  output      TEXT NOT NULL,
  tokens_in   INTEGER NOT NULL DEFAULT 0,
  tokens_out  INTEGER NOT NULL DEFAULT 0,
  provider    TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_cache_skill_idx ON ai_cache(skill_id);

CREATE TABLE IF NOT EXISTS ai_calls (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id    TEXT NOT NULL,
  provider    TEXT NOT NULL,
  cache_hit   INTEGER NOT NULL,
  tokens_in   INTEGER NOT NULL,
  tokens_out  INTEGER NOT NULL,
  latency_ms  INTEGER NOT NULL,
  error_kind  TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_calls_created_idx ON ai_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_calls_skill_idx ON ai_calls(skill_id);
"#;

pub fn ai_db_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("ai.sqlite")
}

pub fn open_ai_db(app_data_dir: &Path) -> Result<Connection, IpcError> {
    let path = ai_db_path(app_data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(&path)
        .map_err(|e| IpcError::Other(format!("open ai.sqlite: {e}")))?;
    conn.execute_batch(SCHEMA)
        .map_err(|e| IpcError::Other(format!("ai.sqlite schema: {e}")))?;
    Ok(conn)
}
