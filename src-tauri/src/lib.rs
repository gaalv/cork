pub mod ai;
pub mod assets;
pub mod diagnostics;
pub mod error;
pub mod index;
pub mod menu;
pub mod settings;
pub mod shortcuts;
pub mod tray;
pub mod vault;
pub mod vcs;
pub mod window;

pub use error::IpcError;

use tauri::{Emitter, Manager, WindowEvent};

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
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .manage(vault::VaultState::default())
        .manage(index::IndexState::default())
        .manage(assets::AssetScopeState::default())
        .manage(vcs::VcsState::default())
        .manage(vcs::remote::RemoteState::default())
        .manage(ai::AiState::default())
        .setup(|app| {
            diagnostics::setup(app.handle());
            vault::setup(app)?;
            index::setup(app)?;
            ai::setup(app.handle())?;

            // Start the VCS debounce worker (signals RemoteState so commits trigger pushes)
            let vcs_state = app.state::<vcs::VcsState>();
            let remote_state = app.state::<vcs::remote::RemoteState>();
            vcs::start_worker(&vcs_state, &remote_state);
            vcs::remote::start_workers(&remote_state);

            // App menu
            let menu = menu::build_app_menu(app.handle())?;
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| {
                app.emit("menu:action", event.id().0.as_str()).ok();
            });

            // Window lifecycle
            if let Some(win) = app.get_webview_window("main") {
                window::ensure_visible(&win)?;
                let app_handle = app.handle().clone();
                win.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        if let Some(w) = app_handle.get_webview_window("main") {
                            let _ = w.hide();
                        }
                        api.prevent_close();
                    }
                });
            }

            tray::build(app.handle())?;

            if let Err(err) = shortcuts::register_quick_capture(app.handle()) {
                eprintln!("cork: failed to register global shortcut: {err}");
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
            vault::scaffold::vault_scaffold_if_needed,
            // === F13 Settings ===
            settings::settings_app_load,
            settings::settings_app_save,
            settings::settings_vault_load,
            settings::settings_vault_save,
            // === F11 Assets ===
            assets::assets_set_scope,
            assets::assets_write_attachment,
            // === F12 Folder Ops ===
            vault::folders::folders_list,
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
            index::notes_all_paged,
            index::notes_by_tag,
            index::notes_by_folder,
            index::notes_by_id,
            // === F07 Drawers ===
            index::notes_pinned,
            index::notes_search,
            index::tags_create,
            index::tags_rename,
            index::tags_delete,
            index::tags_list,
            index::tags_note_map,
            index::links_outgoing,
            index::links_incoming,
            index::links_graph,
            index::index_search,
            index::index_status,
            index::index_rebuild,
            // === F18 VCS ===
            vcs::vcs_status,
            vcs::vcs_history,
            vcs::vcs_restore,
            vcs::remote::vcs_remote_enable,
            vcs::remote::vcs_remote_clone,
            vcs::remote::vcs_remote_disable,
            vcs::remote::vcs_remote_sync_now,
            vcs::remote::vcs_generate_deploy_key,
            // === F21 AI Infrastructure ===
            ai::ai_run_skill,
            ai::ai_cache_clear,
            ai::ai_skills_reload,
            ai::ai_skills_list,
            ai::ai_stats,
            ai::ai_telemetry_clear,
            ai::ai_providers_available,
            // === F35 Diagnostics ===
            diagnostics::diagnostics_report_error,
            diagnostics::diagnostics_crash_log_path,
            diagnostics::diagnostics_recent
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
