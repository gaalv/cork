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
        .setup(|app| vault::setup(app))
        .invoke_handler(tauri::generate_handler![
            health,
            vault::vault_open,
            vault::vault_current,
            vault::vault_list,
            vault::vault_watcher_start,
            vault::vault_watcher_stop,
            vault::notes_read,
            vault::notes_save,
            vault::notes_create,
            vault::notes_rename,
            vault::notes_trash
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
