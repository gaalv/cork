use serde_json::{Map, Value};

use crate::IpcError;

pub fn parse(text: &str) -> Result<(Value, String), IpcError> {
    let normalized = text.replace("\r\n", "\n");
    if !normalized.starts_with("---\n") {
        return Ok((Value::Object(Map::new()), text.to_string()));
    }

    let Some(end_index) = normalized[4..].find("\n---") else {
        return Ok((Value::Object(Map::new()), text.to_string()));
    };

    let yaml = &normalized[4..4 + end_index];
    let after_marker = 4 + end_index + "\n---".len();
    let body_start = if normalized[after_marker..].starts_with('\n') {
        after_marker + 1
    } else {
        after_marker
    };
    let frontmatter = if yaml.trim().is_empty() {
        Value::Object(Map::new())
    } else {
        serde_yaml::from_str::<Value>(yaml).map_err(|err| IpcError::Parse(err.to_string()))?
    };

    Ok((frontmatter, normalized[body_start..].to_string()))
}
