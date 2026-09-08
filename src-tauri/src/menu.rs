use tauri::menu::{
    Menu, MenuBuilder, MenuItem, MenuItemBuilder, PredefinedMenuItem, Submenu, SubmenuBuilder,
};
use tauri::{AppHandle, Manager, Runtime};

use crate::vault::VaultState;
use crate::IpcError;

pub fn build_app_menu<R: Runtime>(app: &AppHandle<R>) -> Result<Menu<R>, IpcError> {
    let app_menu = SubmenuBuilder::new(app, "Cork")
        .item(&item(app, "about", "About Cork", None)?)
        .item(&item(
            app,
            "open-settings",
            "Settings…",
            Some("CmdOrControl+,"),
        )?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("Quit Cork")).map_err(menu_error)?)
        .build()
        .map_err(menu_error)?;

    let recent_vaults = recent_vaults_menu(app)?;
    // Export and import were reachable only through the command palette. The
    // File menu is where anyone looks for them first, and it costs no screen
    // space — which also means Windows and Linux get them for free, since
    // Tauri renders this menu inside the window there.
    let file = SubmenuBuilder::new(app, "File")
        .item(&item(app, "new-note", "New Note", Some("CmdOrControl+N"))?)
        .item(&item(app, "new-from-template", "New from Template…", None)?)
        .item(&item(app, "insert-template", "Insert Template…", None)?)
        .separator()
        .item(&item(
            app,
            "open-vault",
            "Open Vault…",
            Some("CmdOrControl+O"),
        )?)
        .item(&recent_vaults)
        .item(&item(app, "import-folder", "Import Folder…", None)?)
        .item(&item(app, "close-vault", "Close Vault", None)?)
        .separator()
        .item(&item(app, "export-html", "Export as HTML…", None)?)
        .item(&item(app, "export-pdf", "Export as PDF…", None)?)
        .item(&item(app, "copy-markdown", "Copy as Markdown", None)?)
        .separator()
        .item(&item(app, "reveal-vault", "Reveal Vault", None)?)
        .build()
        .map_err(menu_error)?;

    // The Inspector holds the skills that act on the open note. These act on
    // the whole vault, so they had nowhere to live and ended up palette-only.
    let ai = SubmenuBuilder::new(app, "AI")
        .item(&item(app, "ai-ask", "Ask Your Vault…", None)?)
        .item(&item(app, "ai-triage", "Triage the Inbox…", None)?)
        .separator()
        .item(&item(
            app,
            "ai-generate",
            "Generate Note from Topic…",
            None,
        )?)
        .item(&item(
            app,
            "ai-daily-brief",
            "Brief Today\u{2019}s Daily Note",
            None,
        )?)
        .item(&item(
            app,
            "ai-meeting-note",
            "Structure as Meeting Note",
            None,
        )?)
        .build()
        .map_err(menu_error)?;

    let edit = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .separator()
        .item(&item(app, "find", "Find", Some("CmdOrControl+F"))?)
        .item(&item(
            app,
            "replace",
            "Find and Replace",
            Some("CmdOrControl+Shift+F"),
        )?)
        .build()
        .map_err(menu_error)?;

    let view = SubmenuBuilder::new(app, "View")
        .item(&item(
            app,
            "toggle-folders",
            "Toggle Folders",
            Some("CmdOrControl+\\"),
        )?)
        .item(&item(
            app,
            "command-palette",
            "Command Palette",
            Some("CmdOrControl+K"),
        )?)
        .item(&item(
            app,
            "view:keyboard-shortcuts",
            "Keyboard Shortcuts",
            Some("?"),
        )?)
        .build()
        .map_err(menu_error)?;

    let help = SubmenuBuilder::new(app, "Help")
        .item(&item(app, "documentation", "Documentation", None)?)
        .item(&item(
            app,
            "help:keyboard-shortcuts",
            "Keyboard Shortcuts",
            None,
        )?)
        .item(&item(app, "about", "About", None)?)
        .build()
        .map_err(menu_error)?;

    MenuBuilder::new(app)
        .items(&[&app_menu, &file, &edit, &view, &ai, &help])
        .build()
        .map_err(menu_error)
}

fn recent_vaults_menu<R: Runtime>(app: &AppHandle<R>) -> Result<Submenu<R>, IpcError> {
    let mut builder = SubmenuBuilder::new(app, "Recent Vaults");
    let recent = app
        .try_state::<VaultState>()
        .map(|state| state.recent_vaults().unwrap_or_default())
        .unwrap_or_default();

    if recent.is_empty() {
        builder = builder.item(
            &MenuItemBuilder::with_id("recent-vaults-empty", "No Recent Vaults")
                .enabled(false)
                .build(app)
                .map_err(menu_error)?,
        );
    } else {
        for vault in recent.iter().take(10) {
            let id = format!("open-recent-vault:{}", vault.path.display());
            builder = builder.item(&item(app, id, &vault.name, None)?);
        }
    }

    builder.build().map_err(menu_error)
}

fn item<R: Runtime, I: Into<tauri::menu::MenuId>>(
    app: &AppHandle<R>,
    id: I,
    text: &str,
    accelerator: Option<&str>,
) -> Result<MenuItem<R>, IpcError> {
    let mut builder = MenuItemBuilder::with_id(id, text);
    if let Some(accelerator) = accelerator {
        builder = builder.accelerator(accelerator);
    }
    builder.build(app).map_err(menu_error)
}

fn menu_error(error: tauri::Error) -> IpcError {
    IpcError::Other(error.to_string())
}
