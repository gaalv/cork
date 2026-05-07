use rusqlite::{params, Connection};
use serde::Serialize;

use crate::IpcError;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillStats {
    pub skill_id: String,
    pub calls: i64,
    pub tokens: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStats {
    pub calls_total: i64,
    pub cache_hit_rate: f64,
    pub tokens_in: i64,
    pub tokens_out: i64,
    pub by_skill: Vec<SkillStats>,
    pub cache_rows: i64,
    pub cache_bytes: i64,
}

#[allow(clippy::too_many_arguments)]
pub fn record(
    conn: &Connection,
    skill_id: &str,
    provider: &str,
    cache_hit: bool,
    tokens_in: u32,
    tokens_out: u32,
    latency_ms: u32,
    error_kind: Option<&str>,
) -> Result<(), IpcError> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    conn.execute(
        "INSERT INTO ai_calls(skill_id, provider, cache_hit, tokens_in, tokens_out, latency_ms, error_kind, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            skill_id,
            provider,
            cache_hit as i64,
            tokens_in as i64,
            tokens_out as i64,
            latency_ms as i64,
            error_kind,
            now
        ],
    )
    .map_err(|e| IpcError::Other(format!("ai_calls insert: {e}")))?;
    Ok(())
}

pub fn stats(
    conn: &Connection,
    since: Option<i64>,
    cache_rows: i64,
    cache_bytes: i64,
) -> Result<AiStats, IpcError> {
    let where_clause = if since.is_some() {
        "WHERE created_at >= ?1"
    } else {
        ""
    };

    let totals_sql = format!(
        "SELECT count(*), \
                COALESCE(SUM(cache_hit), 0), \
                COALESCE(SUM(tokens_in), 0), \
                COALESCE(SUM(tokens_out), 0) \
         FROM ai_calls {where_clause}"
    );
    let (calls_total, cache_hits, tokens_in, tokens_out): (i64, i64, i64, i64) = if let Some(s) = since {
        conn.query_row(&totals_sql, [s], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
    } else {
        conn.query_row(&totals_sql, [], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
    }
    .map_err(|e| IpcError::Other(format!("ai_calls totals: {e}")))?;

    let by_skill_sql = format!(
        "SELECT skill_id, count(*), COALESCE(SUM(tokens_in + tokens_out), 0) \
         FROM ai_calls {where_clause} \
         GROUP BY skill_id ORDER BY count(*) DESC"
    );
    let mut stmt = conn
        .prepare(&by_skill_sql)
        .map_err(|e| IpcError::Other(format!("ai_calls by_skill prepare: {e}")))?;
    let mut by_skill = Vec::new();
    {
        let map_row = |row: &rusqlite::Row<'_>| -> rusqlite::Result<SkillStats> {
            Ok(SkillStats {
                skill_id: row.get(0)?,
                calls: row.get(1)?,
                tokens: row.get(2)?,
            })
        };
        let rows_iter = if let Some(s) = since {
            stmt.query_map([s], map_row)
        } else {
            stmt.query_map([], map_row)
        }
        .map_err(|e| IpcError::Other(format!("ai_calls by_skill query: {e}")))?;
        for r in rows_iter {
            by_skill.push(r.map_err(|e| IpcError::Other(format!("ai_calls by_skill row: {e}")))?);
        }
    }

    let cache_hit_rate = if calls_total > 0 {
        cache_hits as f64 / calls_total as f64
    } else {
        0.0
    };

    Ok(AiStats {
        calls_total,
        cache_hit_rate,
        tokens_in,
        tokens_out,
        by_skill,
        cache_rows,
        cache_bytes,
    })
}

pub fn clear_calls(conn: &Connection) -> Result<usize, IpcError> {
    let n = conn
        .execute("DELETE FROM ai_calls", [])
        .map_err(|e| IpcError::Other(format!("ai_calls clear: {e}")))?;
    Ok(n)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::db::open_ai_db;
    use tempfile::tempdir;

    #[test]
    fn record_and_aggregate() {
        let dir = tempdir().unwrap();
        let conn = open_ai_db(dir.path()).unwrap();
        record(&conn, "summarize", "claude", false, 100, 40, 1500, None).unwrap();
        record(&conn, "summarize", "claude", true, 0, 0, 1, None).unwrap();
        record(&conn, "rephrase", "claude", false, 50, 25, 800, Some("timeout")).unwrap();

        let s = stats(&conn, None, 5, 1234).unwrap();
        assert_eq!(s.calls_total, 3);
        assert_eq!(s.tokens_in, 150);
        assert_eq!(s.tokens_out, 65);
        assert_eq!(s.cache_rows, 5);
        assert_eq!(s.cache_bytes, 1234);
        assert!((s.cache_hit_rate - 1.0 / 3.0).abs() < 1e-6);
        assert_eq!(s.by_skill.len(), 2);
        assert_eq!(s.by_skill[0].skill_id, "summarize");
        assert_eq!(s.by_skill[0].calls, 2);
    }

    #[test]
    fn empty_stats_have_zero_hit_rate() {
        let dir = tempdir().unwrap();
        let conn = open_ai_db(dir.path()).unwrap();
        let s = stats(&conn, None, 0, 0).unwrap();
        assert_eq!(s.calls_total, 0);
        assert_eq!(s.cache_hit_rate, 0.0);
    }

    #[test]
    fn clear_calls_only_truncates_calls() {
        let dir = tempdir().unwrap();
        let conn = open_ai_db(dir.path()).unwrap();
        record(&conn, "summarize", "claude", false, 1, 1, 1, None).unwrap();
        let n = clear_calls(&conn).unwrap();
        assert_eq!(n, 1);
        let s = stats(&conn, None, 0, 0).unwrap();
        assert_eq!(s.calls_total, 0);
    }
}
