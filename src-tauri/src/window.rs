use tauri::{AppHandle, Manager, PhysicalPosition, Position, WebviewWindow};

pub fn ensure_visible(window: &WebviewWindow) -> Result<(), tauri::Error> {
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

pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = ensure_visible(&window);
    }
}
