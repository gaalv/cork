use tauri::AppHandle;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::tray;

pub fn register_quick_capture(app: &AppHandle) -> Result<(), String> {
    let shortcut = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::SUPER), Code::KeyI);
    let app_for_handler = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut, move |_, _, event| {
            if event.state == ShortcutState::Pressed {
                tray::trigger_quick_capture(&app_for_handler);
            }
        })
        .map_err(|err| err.to_string())?;
    Ok(())
}
