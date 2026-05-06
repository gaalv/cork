use std::env;
use std::process::Command;

use noxe_lib::index::migrate::open_index_at;
use tempfile::tempdir;

#[test]
fn database_recovers_after_process_aborts_mid_transaction() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("index.sqlite");
    let conn = open_index_at(&db_path).unwrap();
    conn.execute(
        "INSERT INTO notes (id, path, folder, title, size, mtime, body_hash) VALUES ('seed', '/seed.md', '', 'Seed', 1, 1, 'h')",
        [],
    )
    .unwrap();
    drop(conn);

    let status = Command::new(env::current_exe().unwrap())
        .arg("--ignored")
        .arg("--exact")
        .arg("crash_child_aborts_mid_transaction")
        .env("NOXE_CRASH_DB", &db_path)
        .status()
        .unwrap();
    assert!(!status.success());

    let conn = open_index_at(&db_path).unwrap();
    let integrity: String = conn
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .unwrap();
    let note_count: i64 = conn
        .query_row("SELECT count(*) FROM notes", [], |row| row.get(0))
        .unwrap();
    assert_eq!(integrity, "ok");
    assert_eq!(note_count, 1);
}

#[test]
#[ignore]
fn crash_child_aborts_mid_transaction() {
    let db_path = env::var("NOXE_CRASH_DB").expect("NOXE_CRASH_DB set by parent");
    let mut conn = open_index_at(std::path::Path::new(&db_path)).unwrap();
    let tx = conn.transaction().unwrap();
    tx.execute(
        "INSERT INTO notes (id, path, folder, title, size, mtime, body_hash) VALUES ('mid', '/mid.md', '', 'Mid', 1, 1, 'h')",
        [],
    )
    .unwrap();
    std::process::abort();
}
