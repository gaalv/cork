use tauri::image::Image;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter};

use crate::window;

pub const QUICK_CAPTURE_EVENT: &str = "quick-capture:new";
pub const SYNC_NOW_EVENT: &str = "sync:now";

pub fn trigger_quick_capture(app: &AppHandle) {
    window::show_main(app);
    let _ = app.emit(QUICK_CAPTURE_EVENT, ());
}

pub fn trigger_sync_now(app: &AppHandle) {
    let _ = app.emit(SYNC_NOW_EVENT, ());
}

pub fn build(app: &AppHandle) -> Result<(), tauri::Error> {
    let quick = MenuItemBuilder::with_id("tray:quick-capture", "Quick capture")
        .accelerator("CmdOrCtrl+Shift+I")
        .build(app)?;
    let sync = MenuItemBuilder::with_id("tray:sync-now", "Sync now").build(app)?;
    let show = MenuItemBuilder::with_id("tray:show", "Show Cork").build(app)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItemBuilder::with_id("tray:quit", "Quit Cork").build(app)?;

    let menu = MenuBuilder::new(app).items(&[&quick, &sync, &show, &separator, &quit]).build()?;

    let icon = Image::from_bytes(include_bytes!("../icons/tray-icon.png"))
        .map_err(|_| tauri::Error::AssetNotFound("tray icon".into()))?;

    TrayIconBuilder::with_id("cork-tray")
        .icon(icon)
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray:quick-capture" => trigger_quick_capture(app),
            "tray:sync-now" => trigger_sync_now(app),
            "tray:show" => window::show_main(app),
            "tray:quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}
