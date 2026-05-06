use std::collections::BTreeSet;
use std::sync::OnceLock;

use pulldown_cmark::{Event, HeadingLevel, Options, Parser, Tag, TagEnd};
use regex::Regex;
use serde::Serialize;
use serde_json::Value;
use sha1::{Digest, Sha1};

use crate::vault::frontmatter;
use crate::IpcError;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedHeading {
    pub level: u8,
    pub text: String,
    pub position: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedLink {
    pub target_text: String,
    pub alias: Option<String>,
    pub position: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedNote {
    pub title: String,
    pub body: String,
    pub body_hash: String,
    pub tags: Vec<String>,
    pub links: Vec<ParsedLink>,
    pub headings: Vec<ParsedHeading>,
    pub frontmatter: Value,
}

pub fn parse(markdown: &str, filename: &str) -> Result<ParsedNote, IpcError> {
    let (frontmatter, body) = frontmatter::parse(markdown)?;
    let mut tags = BTreeSet::new();
    collect_frontmatter_tags(&frontmatter, &mut tags);
    let mut links = Vec::new();
    let mut headings = Vec::new();
    let mut first_h1 = None;
    let mut in_code_block = false;
    let mut skip_ranges = Vec::new();
    let mut heading: Option<HeadingAccumulator> = None;

    let options =
        Options::ENABLE_TABLES | Options::ENABLE_STRIKETHROUGH | Options::ENABLE_TASKLISTS;
    for (event, range) in Parser::new_ext(&body, options).into_offset_iter() {
        match event {
            Event::Start(Tag::CodeBlock(_)) => in_code_block = true,
            Event::End(TagEnd::CodeBlock) => in_code_block = false,
            Event::Start(Tag::Heading { level, .. }) => {
                heading = Some(HeadingAccumulator {
                    level: heading_level_to_u8(level),
                    position: range.start,
                    text: String::new(),
                });
            }
            Event::End(TagEnd::Heading(_)) => {
                if let Some(acc) = heading.take() {
                    let text = normalize_inline(&acc.text);
                    if !text.is_empty() {
                        if acc.level == 1 && first_h1.is_none() {
                            first_h1 = Some(text.clone());
                        }
                        headings.push(ParsedHeading {
                            level: acc.level,
                            text,
                            position: acc.position,
                        });
                    }
                }
            }
            Event::Text(text) if !in_code_block => {
                if let Some(acc) = heading.as_mut() {
                    acc.text.push_str(text.as_ref());
                }
            }
            Event::Text(_) if in_code_block => {
                skip_ranges.push(range);
            }
            Event::Code(code) if !in_code_block => {
                skip_ranges.push(range);
                if let Some(acc) = heading.as_mut() {
                    acc.text.push_str(code.as_ref());
                }
            }
            _ => {}
        }
    }

    collect_tags(&body, tag_regex(), &skip_ranges, &mut tags);
    collect_links(&body, link_regex(), &skip_ranges, &mut links);

    Ok(ParsedNote {
        title: first_h1.unwrap_or_else(|| fallback_title(filename)),
        body: body.clone(),
        body_hash: sha1_hex(body.as_bytes()),
        tags: tags.into_iter().collect(),
        links,
        headings,
        frontmatter,
    })
}

#[derive(Debug)]
struct HeadingAccumulator {
    level: u8,
    position: usize,
    text: String,
}

fn tag_regex() -> &'static Regex {
    static TAG_REGEX: OnceLock<Regex> = OnceLock::new();
    TAG_REGEX.get_or_init(|| {
        Regex::new(r"(^|[^A-Za-z0-9/_-])#([A-Za-z0-9][A-Za-z0-9/_-]{0,63})")
            .expect("tag regex compiles")
    })
}

fn link_regex() -> &'static Regex {
    static LINK_REGEX: OnceLock<Regex> = OnceLock::new();
    LINK_REGEX.get_or_init(|| {
        Regex::new(r"\[\[([^\[\]\|]+?)(?:\|([^\[\]]+?))?\]\]").expect("link regex compiles")
    })
}

fn collect_tags(
    text: &str,
    regex: &Regex,
    skip_ranges: &[std::ops::Range<usize>],
    tags: &mut BTreeSet<String>,
) {
    for captures in regex.captures_iter(text) {
        if let Some(tag) = captures.get(2) {
            if !is_skipped(tag.start(), skip_ranges) {
                tags.insert(tag.as_str().to_string());
            }
        }
    }
}

fn collect_links(
    text: &str,
    regex: &Regex,
    skip_ranges: &[std::ops::Range<usize>],
    links: &mut Vec<ParsedLink>,
) {
    for captures in regex.captures_iter(text) {
        let Some(target) = captures.get(1) else {
            continue;
        };
        let Some(full_match) = captures.get(0) else {
            continue;
        };
        if is_skipped(full_match.start(), skip_ranges) {
            continue;
        }
        links.push(ParsedLink {
            target_text: target.as_str().trim().to_string(),
            alias: captures
                .get(2)
                .map(|alias| alias.as_str().trim().to_string()),
            position: full_match.start(),
        });
    }
}

fn is_skipped(position: usize, skip_ranges: &[std::ops::Range<usize>]) -> bool {
    skip_ranges
        .iter()
        .any(|range| position >= range.start && position < range.end)
}

fn collect_frontmatter_tags(frontmatter: &Value, tags: &mut BTreeSet<String>) {
    let Some(value) = frontmatter.get("tags") else {
        return;
    };
    match value {
        Value::Array(values) => {
            for value in values {
                if let Some(tag) = value
                    .as_str()
                    .map(normalize_tag)
                    .filter(|tag| is_valid_tag(tag))
                {
                    tags.insert(tag);
                }
            }
        }
        Value::String(value) => {
            for tag in value
                .split(',')
                .map(normalize_tag)
                .filter(|tag| is_valid_tag(tag))
            {
                tags.insert(tag);
            }
        }
        _ => {}
    }
}

fn normalize_tag(value: &str) -> String {
    value.trim().trim_start_matches('#').to_string()
}

fn is_valid_tag(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .chars()
            .all(|char| char.is_ascii_alphanumeric() || matches!(char, '/' | '_' | '-'))
}

fn heading_level_to_u8(level: HeadingLevel) -> u8 {
    match level {
        HeadingLevel::H1 => 1,
        HeadingLevel::H2 => 2,
        HeadingLevel::H3 => 3,
        HeadingLevel::H4 => 4,
        HeadingLevel::H5 => 5,
        HeadingLevel::H6 => 6,
    }
}

fn normalize_inline(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn fallback_title(filename: &str) -> String {
    filename
        .rsplit_once('/')
        .map_or(filename, |(_, name)| name)
        .strip_suffix(".md")
        .unwrap_or(filename)
        .trim()
        .to_string()
}

fn sha1_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha1::new();
    hasher.update(bytes);
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_first_h1_title_and_headings() {
        let parsed = parse("# Title\n\n## Child\nText", "note.md").unwrap();
        assert_eq!(parsed.title, "Title");
        assert_eq!(parsed.headings.len(), 2);
        assert_eq!(parsed.headings[1].level, 2);
    }

    #[test]
    fn falls_back_to_filename_without_extension() {
        let parsed = parse("Body only", "folder/My Note.md").unwrap();
        assert_eq!(parsed.title, "My Note");
    }

    #[test]
    fn extracts_body_tags_and_sorts_deduplicates() {
        let parsed = parse("#x #dev/rust and #x #todo-list", "a.md").unwrap();
        assert_eq!(parsed.tags, vec!["dev/rust", "todo-list", "x"]);
    }

    #[test]
    fn rejects_tags_with_spaces() {
        let parsed = parse("#bad tag #good_tag", "a.md").unwrap();
        assert_eq!(parsed.tags, vec!["bad", "good_tag"]);
    }

    #[test]
    fn ignores_tags_and_links_inside_fenced_code_blocks() {
        let parsed = parse("```\n#code [[Nope]]\n```\n#real [[Yes]]", "a.md").unwrap();
        assert_eq!(parsed.tags, vec!["real"]);
        assert_eq!(parsed.links[0].target_text, "Yes");
    }

    #[test]
    fn ignores_inline_code_tags() {
        let parsed = parse("`#code [[Nope]]` #real", "a.md").unwrap();
        assert_eq!(parsed.tags, vec!["real"]);
        assert!(parsed.links.is_empty());
    }

    #[test]
    fn extracts_wikilink_aliases() {
        let parsed = parse("See [[Target Note|Alias text]] and [[Other]].", "a.md").unwrap();
        assert_eq!(parsed.links.len(), 2);
        assert_eq!(parsed.links[0].target_text, "Target Note");
        assert_eq!(parsed.links[0].alias.as_deref(), Some("Alias text"));
        assert_eq!(parsed.links[1].alias, None);
    }

    #[test]
    fn parses_frontmatter_tags_from_array() {
        let parsed = parse("---\ntags:\n  - dev\n  - '#rust/lang'\n---\nBody", "a.md").unwrap();
        assert_eq!(parsed.tags, vec!["dev", "rust/lang"]);
    }

    #[test]
    fn parses_frontmatter_tags_from_comma_string() {
        let parsed = parse("---\ntags: dev, rust, bad tag\n---\nBody", "a.md").unwrap();
        assert_eq!(parsed.tags, vec!["dev", "rust"]);
    }

    #[test]
    fn handles_unicode_heading_and_nested_emphasis() {
        let parsed = parse("# Olá **mundo _dev_**\nTexto", "a.md").unwrap();
        assert_eq!(parsed.title, "Olá mundo dev");
        assert_eq!(parsed.headings[0].text, "Olá mundo dev");
    }

    #[test]
    fn computes_body_hash_from_body_without_frontmatter() {
        let parsed = parse("---\ntags: dev\n---\nBody", "a.md").unwrap();
        assert_eq!(parsed.body, "Body");
        assert_eq!(parsed.body_hash.len(), 40);
    }
}
