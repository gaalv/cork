use std::collections::HashMap;
use std::path::PathBuf;

use include_dir::{include_dir, Dir};
use serde::{Deserialize, Serialize};

static BUNDLED: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/skills");

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ModelTier {
    Small,
    Standard,
    Premium,
}

impl Default for ModelTier {
    fn default() -> Self {
        ModelTier::Standard
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct SkillFrontmatter {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub model_tier: ModelTier,
    #[serde(default = "default_max_in")]
    pub max_tokens_in: u32,
    #[serde(default = "default_max_out")]
    pub max_tokens_out: u32,
    #[serde(default = "default_cache")]
    pub cache: bool,
    #[serde(default = "default_schema")]
    pub output_schema: String,
    #[serde(default)]
    pub triggers: Vec<String>,
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
}

fn default_max_in() -> u32 {
    8000
}
fn default_max_out() -> u32 {
    400
}
fn default_cache() -> bool {
    true
}
fn default_schema() -> String {
    "text".to_string()
}
fn default_timeout() -> u64 {
    60
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub model_tier: ModelTier,
    pub max_tokens_in: u32,
    pub max_tokens_out: u32,
    pub cache: bool,
    pub output_schema: String,
    pub triggers: Vec<String>,
    pub timeout_secs: u64,
    pub system_prompt: String,
    pub source: SkillSource,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SkillSource {
    Bundled,
    User,
}

#[derive(Debug, Default)]
pub struct SkillStore {
    by_id: HashMap<String, Skill>,
}

impl SkillStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get(&self, id: &str) -> Option<&Skill> {
        self.by_id.get(id)
    }

    pub fn all(&self) -> Vec<&Skill> {
        let mut v: Vec<&Skill> = self.by_id.values().collect();
        v.sort_by(|a, b| a.id.cmp(&b.id));
        v
    }

    pub fn len(&self) -> usize {
        self.by_id.len()
    }

    pub fn is_empty(&self) -> bool {
        self.by_id.is_empty()
    }

    pub fn insert(&mut self, skill: Skill) {
        self.by_id.insert(skill.id.clone(), skill);
    }
}

/// Parse a single skill file content (frontmatter + body) into a Skill.
/// Returns None on parse failure (caller logs and skips).
pub fn parse_skill(raw: &str, source: SkillSource) -> Option<Skill> {
    use gray_matter::engine::YAML;
    use gray_matter::Matter;

    let matter = Matter::<YAML>::new();
    let parsed = matter.parse(raw);
    let data = parsed.data?;
    let fm: SkillFrontmatter = data.deserialize().ok()?;
    let body = parsed.content.trim().to_string();
    if fm.id.is_empty() || body.is_empty() {
        return None;
    }
    Some(Skill {
        id: fm.id,
        name: fm.name,
        model_tier: fm.model_tier,
        max_tokens_in: fm.max_tokens_in,
        max_tokens_out: fm.max_tokens_out,
        cache: fm.cache,
        output_schema: fm.output_schema,
        triggers: fm.triggers,
        timeout_secs: fm.timeout_secs,
        system_prompt: body,
        source,
    })
}

/// Load all skills from bundled defaults, then user overrides under `~/.noxe/skills/`.
/// Later sources override earlier by `id`.
pub fn load_all(user_dir: Option<PathBuf>) -> SkillStore {
    let mut store = SkillStore::new();

    // 1. Bundled defaults.
    for entry in BUNDLED.files() {
        if entry.path().extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        let Some(raw) = entry.contents_utf8() else {
            continue;
        };
        if let Some(skill) = parse_skill(raw, SkillSource::Bundled) {
            store.insert(skill);
        } else {
            eprintln!(
                "noxe: skipping malformed bundled skill: {}",
                entry.path().display()
            );
        }
    }

    // 2. User overrides.
    if let Some(dir) = user_dir {
        if dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|s| s.to_str()) != Some("md") {
                        continue;
                    }
                    match std::fs::read_to_string(&path) {
                        Ok(raw) => {
                            if let Some(skill) = parse_skill(&raw, SkillSource::User) {
                                store.insert(skill);
                            } else {
                                eprintln!(
                                    "noxe: skipping malformed user skill: {}",
                                    path.display()
                                );
                            }
                        }
                        Err(err) => {
                            eprintln!(
                                "noxe: failed to read user skill {}: {}",
                                path.display(),
                                err
                            );
                        }
                    }
                }
            }
        }
    }

    store
}

/// Default user skills directory: `~/.noxe/skills/`.
pub fn default_user_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".noxe").join("skills"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn loads_bundled_defaults() {
        let store = load_all(None);
        assert!(store.get("summarize").is_some());
        assert!(store.get("suggest-tags").is_some());
        assert!(store.get("related-notes").is_some());
        assert!(store.get("generate-note").is_some());
        assert!(store.get("slash-rephrase").is_some());
        assert!(store.get("slash-expand").is_some());
        assert!(store.get("slash-continue").is_some());
        assert_eq!(
            store.get("summarize").unwrap().source,
            SkillSource::Bundled
        );
    }

    #[test]
    fn user_override_takes_precedence() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("summarize.md");
        std::fs::write(
            &path,
            "---\nid: summarize\nname: Custom\n---\nMy custom prompt {{title}}",
        )
        .unwrap();
        let store = load_all(Some(dir.path().to_path_buf()));
        let s = store.get("summarize").unwrap();
        assert_eq!(s.name, "Custom");
        assert_eq!(s.source, SkillSource::User);
        assert!(s.system_prompt.contains("My custom prompt"));
    }

    #[test]
    fn malformed_frontmatter_is_skipped() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("broken.md");
        std::fs::write(&path, "no frontmatter here, just text").unwrap();
        let store = load_all(Some(dir.path().to_path_buf()));
        assert!(store.get("broken").is_none());
        // Bundled defaults should still load.
        assert!(store.get("summarize").is_some());
    }

    #[test]
    fn missing_id_is_skipped() {
        let raw = "---\nname: No id\n---\nbody";
        assert!(parse_skill(raw, SkillSource::User).is_none());
    }

    #[test]
    fn empty_body_is_skipped() {
        let raw = "---\nid: x\nname: X\n---\n";
        assert!(parse_skill(raw, SkillSource::User).is_none());
    }
}
