pub mod fingerprint;
pub mod frontmatter;
pub mod list;

use std::path::PathBuf;

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteEntry {
    pub id: String,
    pub path: PathBuf,
    pub title: String,
    pub folder: String,
    pub size: u64,
    pub mtime: i64,
}
