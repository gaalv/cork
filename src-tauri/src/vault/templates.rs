use std::fs;
use std::path::{Path, PathBuf};

use chrono::SecondsFormat;
use serde::Serialize;
use serde_json::{Map, Value};
use tauri::Emitter;
use walkdir::WalkDir;

use crate::vault::fingerprint::FingerprintCache;
use crate::vault::io::{self, map_not_found, to_slash_string};
use crate::vault::settings::load_vault_settings;
use crate::vault::watcher::{FileChangeKind, FileChangeSource, VaultFileChangedEvent};
use crate::vault::{SaveInput, VaultState};
use crate::IpcError;

pub const DEFAULT_TEMPLATES_FOLDER: &str = "Templates";

const CURSOR_TOKEN: &str = "{{cursor}}";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateEntry {
    pub name: String,
    pub path: PathBuf,
    pub rel_path: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedTemplate {
    pub frontmatter: Value,
    pub body: String,
    /// UTF-16 code-unit offset of the first `{{cursor}}` marker in the body
    /// (after all other tokens are expanded), `None` when absent.
    pub cursor_offset: Option<usize>,
}

/// Single resolution point for the templates folder — every templates
/// command goes through here so the `"Templates"` default lives in one place.
pub fn templates_dir(vault_root: &Path) -> Result<PathBuf, IpcError> {
    let settings = load_vault_settings(vault_root)?;
    let folder = settings
        .templates_folder
        .filter(|folder| !folder.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_TEMPLATES_FOLDER.to_string());
    Ok(vault_root.join(folder))
}

pub fn list_templates(vault_root: &Path) -> Result<Vec<TemplateEntry>, IpcError> {
    let dir = templates_dir(vault_root)?;
    if !dir.is_dir() {
        return Ok(Vec::new());
    }
    let mut entries = Vec::new();
    for entry in WalkDir::new(&dir)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
    {
        let path = entry.path();
        if !entry.file_type().is_file() {
            continue;
        }
        if path.extension().and_then(|ext| ext.to_str()) != Some("md") {
            continue;
        }
        let Some(name) = path.file_stem().and_then(|stem| stem.to_str()) else {
            continue;
        };
        let rel_path = path
            .strip_prefix(&dir)
            .map(to_slash_string)
            .unwrap_or_else(|_| to_slash_string(path));
        entries.push(TemplateEntry {
            name: name.to_string(),
            path: path.to_path_buf(),
            rel_path,
        });
    }
    entries.sort_by(|a, b| a.rel_path.cmp(&b.rel_path));
    Ok(entries)
}

/// Expand template tokens and split frontmatter from body.
///
/// Tokens `{{title}}`, `{{date}}`, `{{time}}`, `{{datetime}}` are expanded in
/// both frontmatter and body; unknown `{{tokens}}` pass through untouched.
/// `{{cursor}}` markers are stripped everywhere; the first occurrence in the
/// body yields `cursor_offset` (frontmatter occurrences are just stripped).
pub fn render(content: &str, title: &str) -> Result<RenderedTemplate, IpcError> {
    let now = chrono::Local::now();
    let (raw_frontmatter, raw_body) = split_frontmatter(content);

    let frontmatter = match raw_frontmatter {
        Some(yaml) => {
            let expanded = expand_tokens(&yaml, title, &now).replace(CURSOR_TOKEN, "");
            if expanded.trim().is_empty() {
                Value::Object(Map::new())
            } else {
                serde_yaml::from_str::<Value>(&expanded)
                    .map_err(|err| IpcError::Parse(err.to_string()))?
            }
        }
        None => Value::Object(Map::new()),
    };

    let expanded_body = expand_tokens(&raw_body, title, &now);
    let cursor_offset = expanded_body
        .find(CURSOR_TOKEN)
        .map(|idx| expanded_body[..idx].encode_utf16().count());
    let body = expanded_body.replace(CURSOR_TOKEN, "");

    Ok(RenderedTemplate {
        frontmatter,
        body,
        cursor_offset,
    })
}

/// Split raw note text into (yaml frontmatter, body) using the same block
/// boundaries as `frontmatter::parse`, but without parsing the YAML — tokens
/// must be expanded on the raw text first (unquoted `{{...}}` is not valid YAML).
fn split_frontmatter(text: &str) -> (Option<String>, String) {
    let normalized = text.replace("\r\n", "\n");
    if !normalized.starts_with("---\n") {
        return (None, normalized);
    }
    let Some(end_index) = normalized[4..].find("\n---") else {
        return (None, normalized);
    };
    let yaml = normalized[4..4 + end_index].to_string();
    let after_marker = 4 + end_index + "\n---".len();
    let body_start = if normalized[after_marker..].starts_with('\n') {
        after_marker + 1
    } else {
        after_marker
    };
    (Some(yaml), normalized[body_start..].to_string())
}

fn expand_tokens(input: &str, title: &str, now: &chrono::DateTime<chrono::Local>) -> String {
    let mut out = String::with_capacity(input.len());
    let mut rest = input;
    while let Some(start) = rest.find("{{") {
        out.push_str(&rest[..start]);
        let after = &rest[start + 2..];
        let Some(end) = after.find("}}") else {
            out.push_str(&rest[start..]);
            return out;
        };
        let token = &after[..end];
        match token.trim() {
            "title" => out.push_str(title),
            "date" => out.push_str(&now.format("%Y-%m-%d").to_string()),
            "time" => out.push_str(&now.format("%H:%M").to_string()),
            "datetime" => out.push_str(&now.to_rfc3339_opts(SecondsFormat::Secs, false)),
            // Unknown tokens (including `{{cursor}}`) pass through untouched;
            // cursor markers are handled separately in `render`.
            _ => {
                out.push_str("{{");
                out.push_str(token);
                out.push_str("}}");
            }
        }
        rest = &after[end + 2..];
    }
    out.push_str(rest);
    out
}

fn read_template(path: &Path) -> Result<String, IpcError> {
    fs::read_to_string(path).map_err(map_not_found)
}

fn resolve_title(title: Option<&str>) -> &str {
    let trimmed = title.unwrap_or("Untitled").trim();
    if trimmed.is_empty() {
        "Untitled"
    } else {
        trimmed
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFromTemplateResult {
    pub path: PathBuf,
    pub cursor_offset: Option<usize>,
}

pub fn create_note_from_template(
    folder: &Path,
    template_path: &Path,
    title: Option<&str>,
) -> Result<CreateFromTemplateResult, IpcError> {
    let content = read_template(template_path)?;
    let title = resolve_title(title);
    let rendered = render(&content, title)?;

    let mut frontmatter = match rendered.frontmatter {
        Value::Object(map) => map,
        _ => Map::new(),
    };
    // Template keys are preserved; `created` wins on a key conflict.
    frontmatter.insert("created".to_string(), Value::String(io::iso_utc_now()));

    fs::create_dir_all(folder)?;
    let path = io::unique_note_path(folder, title);
    let save_input = SaveInput {
        path: path.clone(),
        frontmatter: Value::Object(frontmatter),
        body: rendered.body,
        expected_mtime: None,
    };
    io::write_new_note(&save_input, &FingerprintCache::new())?;

    Ok(CreateFromTemplateResult {
        path,
        cursor_offset: rendered.cursor_offset,
    })
}

#[tauri::command]
pub async fn notes_create_from_template(
    app: tauri::AppHandle,
    state: tauri::State<'_, VaultState>,
    vcs_state: tauri::State<'_, crate::vcs::VcsState>,
    folder: String,
    template_path: PathBuf,
    title: Option<String>,
) -> Result<CreateFromTemplateResult, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    let folder_path = crate::vault::resolve_folder(&root, &folder);
    let result = tauri::async_runtime::spawn_blocking(move || {
        create_note_from_template(&folder_path, &template_path, title.as_deref())
    })
    .await
    .map_err(|err| IpcError::Other(err.to_string()))??;

    let metadata = fs::metadata(&result.path)?;
    let mtime = io::metadata_mtime_ms(&metadata)?;
    app.emit(
        "vault:fileChanged",
        VaultFileChangedEvent {
            path: result.path.clone(),
            kind: FileChangeKind::Created,
            source: FileChangeSource::Internal,
            mtime,
            size: metadata.len(),
        },
    )
    .map_err(|err| IpcError::Other(err.to_string()))?;
    crate::vcs::on_note_saved(&vcs_state, &state, &result.path, true);
    Ok(result)
}

#[tauri::command]
pub async fn templates_list(
    state: tauri::State<'_, VaultState>,
) -> Result<Vec<TemplateEntry>, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    tauri::async_runtime::spawn_blocking(move || list_templates(&root))
        .await
        .map_err(|err| IpcError::Other(err.to_string()))?
}

#[tauri::command]
pub async fn templates_render(
    path: PathBuf,
    title: Option<String>,
) -> Result<RenderedTemplate, IpcError> {
    tauri::async_runtime::spawn_blocking(move || {
        let content = read_template(&path)?;
        render(&content, resolve_title(title.as_deref()))
    })
    .await
    .map_err(|err| IpcError::Other(err.to_string()))?
}
