use rusqlite::{params, Connection, OptionalExtension};

use crate::IpcError;

#[derive(Debug, Clone)]
pub struct CacheEntry {
    pub output: String,
    pub tokens_in: u32,
    pub tokens_out: u32,
}

pub fn key_for(skill_id: &str, prompt: &str) -> String {
    let mut hasher = blake3::Hasher::new();
    hasher.update(skill_id.as_bytes());
    hasher.update(b"\x00");
    hasher.update(prompt.as_bytes());
    hasher.finalize().to_hex().to_string()
}

pub fn get(conn: &Connection, key: &str) -> Result<Option<CacheEntry>, IpcError> {
    conn.query_row(
        "SELECT output, tokens_in, tokens_out FROM ai_cache WHERE key = ?1",
        [key],
        |row| {
            Ok(CacheEntry {
                output: row.get(0)?,
                tokens_in: row.get::<_, i64>(1)? as u32,
                tokens_out: row.get::<_, i64>(2)? as u32,
            })
        },
    )
    .optional()
    .map_err(|e| IpcError::Other(format!("ai_cache get: {e}")))
}

pub fn put(
    conn: &Connection,
    key: &str,
    skill_id: &str,
    output: &str,
    tokens_in: u32,
    tokens_out: u32,
    provider: &str,
) -> Result<(), IpcError> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    conn.execute(
        "INSERT OR REPLACE INTO ai_cache(key, skill_id, output, tokens_in, tokens_out, provider, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![key, skill_id, output, tokens_in as i64, tokens_out as i64, provider, now],
    )
    .map_err(|e| IpcError::Other(format!("ai_cache put: {e}")))?;
    Ok(())
}

pub fn clear(conn: &Connection, skill_id: Option<&str>) -> Result<usize, IpcError> {
    let n = match skill_id {
        Some(id) => conn
            .execute("DELETE FROM ai_cache WHERE skill_id = ?1", [id])
            .map_err(|e| IpcError::Other(format!("ai_cache clear by skill: {e}")))?,
        None => conn
            .execute("DELETE FROM ai_cache", [])
            .map_err(|e| IpcError::Other(format!("ai_cache clear all: {e}")))?,
    };
    Ok(n)
}

pub fn rows_count(conn: &Connection) -> Result<i64, IpcError> {
    conn.query_row("SELECT count(*) FROM ai_cache", [], |row| row.get(0))
        .map_err(|e| IpcError::Other(format!("ai_cache count: {e}")))
}

pub fn bytes_total(conn: &Connection) -> Result<i64, IpcError> {
    conn.query_row(
        "SELECT COALESCE(SUM(LENGTH(output)), 0) FROM ai_cache",
        [],
        |row| row.get(0),
    )
    .map_err(|e| IpcError::Other(format!("ai_cache bytes: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::db::open_ai_db;
    use tempfile::tempdir;

    #[test]
    fn key_is_deterministic() {
        let a = key_for("summarize", "hello");
        let b = key_for("summarize", "hello");
        assert_eq!(a, b);
        assert_ne!(a, key_for("summarize", "hello world"));
        assert_ne!(a, key_for("rephrase", "hello"));
    }

    #[test]
    fn put_and_get_roundtrip() {
        let dir = tempdir().unwrap();
        let conn = open_ai_db(dir.path()).unwrap();
        let key = key_for("summarize", "prompt");
        assert!(get(&conn, &key).unwrap().is_none());
        put(&conn, &key, "summarize", "out", 100, 50, "claude").unwrap();
        let entry = get(&conn, &key).unwrap().unwrap();
        assert_eq!(entry.output, "out");
        assert_eq!(entry.tokens_in, 100);
        assert_eq!(entry.tokens_out, 50);
    }

    #[test]
    fn clear_by_skill_or_all() {
        let dir = tempdir().unwrap();
        let conn = open_ai_db(dir.path()).unwrap();
        put(&conn, "k1", "summarize", "a", 1, 1, "claude").unwrap();
        put(&conn, "k2", "rephrase", "b", 1, 1, "claude").unwrap();
        assert_eq!(rows_count(&conn).unwrap(), 2);
        let n = clear(&conn, Some("summarize")).unwrap();
        assert_eq!(n, 1);
        assert_eq!(rows_count(&conn).unwrap(), 1);
        let n = clear(&conn, None).unwrap();
        assert_eq!(n, 1);
        assert_eq!(rows_count(&conn).unwrap(), 0);
    }
}
