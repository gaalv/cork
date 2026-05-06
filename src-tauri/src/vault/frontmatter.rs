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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_empty_frontmatter_when_missing() {
        let (frontmatter, body) = parse("# Title\nBody").unwrap();
        assert_eq!(frontmatter, Value::Object(Map::new()));
        assert_eq!(body, "# Title\nBody");
    }

    #[test]
    fn parses_yaml_frontmatter() {
        let (frontmatter, body) =
            parse("---\ntitle: Hello\ntags:\n  - rust\n---\n# Hello").unwrap();
        assert_eq!(frontmatter["title"], "Hello");
        assert_eq!(frontmatter["tags"][0], "rust");
        assert_eq!(body, "# Hello");
    }

    #[test]
    fn rejects_malformed_yaml() {
        let err = parse("---\ntitle: [broken\n---\nBody").unwrap_err();
        assert!(matches!(err, IpcError::Parse(_)));
    }

    #[test]
    fn handles_crlf_line_endings() {
        let (frontmatter, body) = parse("---\r\ntitle: CRLF\r\n---\r\nBody\r\n").unwrap();
        assert_eq!(frontmatter["title"], "CRLF");
        assert_eq!(body, "Body\n");
    }

    #[test]
    fn handles_empty_body() {
        let (frontmatter, body) = parse("---\ntitle: Empty\n---\n").unwrap();
        assert_eq!(frontmatter["title"], "Empty");
        assert_eq!(body, "");
    }

    #[test]
    fn handles_only_frontmatter() {
        let (frontmatter, body) = parse("---\ntitle: Only\n---").unwrap();
        assert_eq!(frontmatter["title"], "Only");
        assert_eq!(body, "");
    }
}
