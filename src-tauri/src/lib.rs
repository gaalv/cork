pub mod ai;
pub mod assets;
pub mod error;
pub mod index;
pub mod menu;
pub mod settings;
pub mod todos;
pub mod vault;
pub mod vcs;

pub use error::IpcError;

use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, Position, WebviewWindow, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const QUICK_CAPTURE_EVENT: &str = "quick-capture:new";

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

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = ensure_window_visible(&window);
    }
}

fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        match window.is_visible() {
            Ok(true) => {
                let _ = window.hide();
            }
            _ => show_main_window(app),
        }
    }
}

fn trigger_quick_capture(app: &AppHandle) {
    show_main_window(app);
    let _ = app.emit(QUICK_CAPTURE_EVENT, ());
}

fn build_tray(app: &AppHandle) -> Result<(), tauri::Error> {
    let quick = MenuItemBuilder::with_id("tray:quick-capture", "Quick capture")
        .accelerator("CmdOrCtrl+Shift+I")
        .build(app)?;
    let show = MenuItemBuilder::with_id("tray:show", "Show Noxe").build(app)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItemBuilder::with_id("tray:quit", "Quit Noxe").build(app)?;

    let menu = MenuBuilder::new(app).items(&[&quick, &show, &separator, &quit]).build()?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| tauri::Error::AssetNotFound("tray icon".into()))?;

    TrayIconBuilder::with_id("noxe-tray")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray:quick-capture" => trigger_quick_capture(app),
            "tray:show" => show_main_window(app),
            "tray:quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn register_quick_capture_shortcut(app: &AppHandle) -> Result<(), String> {
    let shortcut = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::SUPER), Code::KeyI);
    let app_for_handler = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut, move |_, _, event| {
            if event.state == ShortcutState::Pressed {
                trigger_quick_capture(&app_for_handler);
            }
        })
        .map_err(|err| err.to_string())?;
    Ok(())
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
        .manage(ai::AiState::default())
        .setup(|app| {
            vault::setup(app)?;
            index::setup(app)?;
            ai::setup(app.handle())?;
            // Start the VCS debounce worker
            vcs::start_worker(&app.state::<vcs::VcsState>());
            let menu = menu::build_app_menu(app.handle())?;
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| {
                app.emit("menu:action", event.id().0.as_str()).ok();
            });
            if let Some(window) = app.get_webview_window("main") {
                ensure_window_visible(&window)?;
                let app_handle = app.handle().clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.hide();
                        }
                        api.prevent_close();
                    }
                });
            }
            build_tray(app.handle())?;
            if let Err(err) = register_quick_capture_shortcut(app.handle()) {
                eprintln!("noxe: failed to register global shortcut: {err}");
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
            index::links_graph,
            index::index_search,
            index::index_status,
            index::index_rebuild,
            // === F18 VCS ===
            vcs::vcs_status,
            vcs::vcs_history,
            vcs::vcs_restore,
            // === F21 AI Infrastructure ===
            ai::ai_run_skill,
            ai::ai_cache_clear,
            ai::ai_skills_reload,
            ai::ai_skills_list,
            ai::ai_stats,
            ai::ai_telemetry_clear,
            // === F25 Todos ===
            todos::todos_load,
            todos::todos_save
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
