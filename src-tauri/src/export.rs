//! Note export (F45) — writes export output to a user-chosen path.
//!
//! `notes.save` only writes `.md` files inside the vault; exported HTML
//! goes wherever the user pointed the OS save dialog, so this module
//! provides one small write command. The path MUST come from the save
//! dialog on the frontend — no vault scoping applies here by design.

use std::fs;

use crate::error::IpcError;

/// Writes `contents` to `path` (UTF-8). Path is dialog-provided.
#[tauri::command]
pub fn export_write(path: String, contents: String) -> Result<(), IpcError> {
    fs::write(&path, contents)?;
    Ok(())
}
