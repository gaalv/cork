pub mod error;
pub mod index;
pub mod vault;

pub use error::IpcError;

/// Health check for the IPC bridge — used by the smoke test and as a
/// reference for typed IPC contracts.
#[tauri::command]
fn health() -> Result<&'static str, IpcError> {
    Ok("ok")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(vault::VaultState::default())
        .manage(index::IndexState::default())
        .setup(|app| {
            vault::setup(app)?;
            index::setup(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            health,
            vault::vault_open,
            vault::vault_current,
            vault::vault_list,
            vault::vault_watcher_start,
            vault::vault_watcher_stop,
            // === F12 Folder Ops ===
            vault::folders::folders_create,
            vault::folders::folders_rename,
            vault::folders::folders_move,
            vault::folders::folders_trash,
            vault::notes_read,
            vault::notes_save,
            vault::notes_create,
            vault::notes_rename,
            vault::notes_trash,
            // === F12 Bulk Ops ===
            vault::bulk::notes_move,
            vault::bulk::notes_bulk_move,
            vault::bulk::notes_bulk_trash,
            vault::bulk::notes_bulk_set_frontmatter,
            index::notes_recent,
            index::notes_by_tag,
            index::notes_by_folder,
            index::notes_by_id,
            index::tags_list,
            index::links_outgoing,
            index::links_incoming,
            index::index_search,
            index::index_status,
            index::index_rebuild
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
