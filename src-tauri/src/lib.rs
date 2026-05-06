pub mod assets;
pub mod error;
pub mod index;
pub mod menu;
pub mod settings;
pub mod vault;

pub use error::IpcError;

use tauri::{Emitter, Manager, PhysicalPosition, Position, WebviewWindow};

/// Health check for the IPC bridge — used by the smoke test and as a
/// reference for typed IPC contracts.
#[tauri::command]
fn health() -> Result<&'static str, IpcError> {
    Ok("ok")
}

fn ensure_window_visible(window: &WebviewWindow) -> Result<(), tauri::Error> {
    let position = window.outer_position()?;
    let size = window.outer_size()?;
    let monitors = window.available_monitors()?;
    let is_visible = monitors.iter().any(|monitor| {
        let monitor_position = monitor.position();
        let monitor_size = monitor.size();
        let left = monitor_position.x;
        let top = monitor_position.y;
        let right = left + monitor_size.width as i32;
        let bottom = top + monitor_size.height as i32;
        position.x < right
            && position.x + size.width as i32 > left
            && position.y < bottom
            && position.y + size.height as i32 > top
    });

    if !is_visible {
        let target = monitors.first().map_or(PhysicalPosition { x: 100, y: 100 }, |monitor| {
            let monitor_position = monitor.position();
            let monitor_size = monitor.size();
            PhysicalPosition {
                x: monitor_position.x + ((monitor_size.width.saturating_sub(size.width)) / 2) as i32,
                y: monitor_position.y + ((monitor_size.height.saturating_sub(size.height)) / 2) as i32,
            }
        });
        window.set_position(Position::Physical(target))?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(vault::VaultState::default())
        .manage(index::IndexState::default())
        .manage(assets::AssetScopeState::default())
        .setup(|app| {
            vault::setup(app)?;
            index::setup(app)?;
            let menu = menu::build_app_menu(app.handle())?;
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| {
                app.emit("menu.action", event.id().0.as_str()).ok();
            });
            if let Some(window) = app.get_webview_window("main") {
                ensure_window_visible(&window)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            health,
            vault::vault_open,
            vault::vault_current,
            vault::vault_list,
            vault::vault_watcher_start,
            vault::vault_watcher_stop,
            // === F10 Vault Mgmt ===
            vault::vault_close,
            vault::vault_recent,
            vault::vault_remove_recent,
            vault::vault_settings,
            // === F13 Settings ===
            settings::settings_app_load,
            settings::settings_app_save,
            settings::settings_vault_load,
            settings::settings_vault_save,
            // === F11 Assets ===
            assets::assets_set_scope,
            assets::assets_write_attachment,
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
            index::notes_all_paged,
            index::notes_by_tag,
            index::notes_by_folder,
            index::notes_by_id,
            // === F07 Drawers ===
            index::notes_starred,
            index::notes_search,
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
