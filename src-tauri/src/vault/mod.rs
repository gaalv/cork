pub mod fingerprint;
pub mod frontmatter;
pub mod io;
pub mod list;
pub mod watcher;

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::Value;

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

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteFile {
    pub path: PathBuf,
    pub frontmatter: Value,
    pub body: String,
    pub mtime: i64,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveInput {
    pub path: PathBuf,
    pub frontmatter: Value,
    pub body: String,
    pub expected_mtime: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub path: PathBuf,
    pub mtime: i64,
}
