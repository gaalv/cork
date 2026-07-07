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

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedMarkdownExtension {
    pub kind: String,
    pub value: String,
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
    pub markdown_extensions: Vec<ParsedMarkdownExtension>,
    pub frontmatter: Value,
}

pub fn parse(markdown: &str, filename: &str) -> Result<ParsedNote, IpcError> {
    let (frontmatter, body) = frontmatter::parse(markdown)?;
    let mut tags = BTreeSet::new();
    collect_frontmatter_tags(&frontmatter, &mut tags);
    let mut links = Vec::new();
    let mut headings = Vec::new();
    let mut markdown_extensions = Vec::new();
    let mut in_code_block = false;
    let mut skip_ranges = Vec::new();
    let mut heading: Option<HeadingAccumulator> = None;

    let options = Options::ENABLE_TABLES
        | Options::ENABLE_STRIKETHROUGH
        | Options::ENABLE_TASKLISTS
        | Options::ENABLE_FOOTNOTES;
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

    // Tags are only sourced from frontmatter — inline #tags in the body are ignored.
    collect_links(&body, link_regex(), &skip_ranges, &mut links);
    collect_callouts(&body, &skip_ranges, true, &mut markdown_extensions);
    collect_footnotes(&body, &skip_ranges, &mut markdown_extensions);
    collect_highlights(&body, &skip_ranges, &mut markdown_extensions);
    markdown_extensions.sort_by(|left, right| {
        left.position
            .cmp(&right.position)
            .then_with(|| left.kind.cmp(&right.kind))
            .then_with(|| left.value.cmp(&right.value))
    });

    Ok(ParsedNote {
        title: fallback_title(filename),
        body: body.clone(),
        body_hash: sha1_hex(body.as_bytes()),
        tags: tags.into_iter().collect(),
        links,
        headings,
        markdown_extensions,
        frontmatter,
    })
}

#[derive(Debug)]
struct HeadingAccumulator {
    level: u8,
    position: usize,
    text: String,
}

fn link_regex() -> &'static Regex {
    static LINK_REGEX: OnceLock<Regex> = OnceLock::new();
    LINK_REGEX.get_or_init(|| {
        Regex::new(r"\[\[([^\[\]\|]+?)(?:\|([^\[\]]+?))?\]\]").expect("link regex compiles")
    })
}

fn callout_regex() -> &'static Regex {
    static CALLOUT_REGEX: OnceLock<Regex> = OnceLock::new();
    CALLOUT_REGEX.get_or_init(|| {
        Regex::new(r"(?m)^(?:>\s*)+\[!([A-Za-z][\w-]*)\]\s*([^\r\n]*)").expect("callout regex compiles")
    })
}

fn footnote_definition_regex() -> &'static Regex {
    static FOOTNOTE_DEFINITION_REGEX: OnceLock<Regex> = OnceLock::new();
    FOOTNOTE_DEFINITION_REGEX.get_or_init(|| {
        Regex::new(r"(?m)^\[\^([A-Za-z0-9_-]+)\]:\s*([^\r\n]*)").expect("footnote definition regex compiles")
    })
}

fn footnote_reference_regex() -> &'static Regex {
    static FOOTNOTE_REFERENCE_REGEX: OnceLock<Regex> = OnceLock::new();
    FOOTNOTE_REFERENCE_REGEX.get_or_init(|| {
        Regex::new(r"\[\^([A-Za-z0-9_-]+)\]").expect("footnote reference regex compiles")
    })
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

fn collect_callouts(
    text: &str,
    skip_ranges: &[std::ops::Range<usize>],
    enabled: bool,
    extensions: &mut Vec<ParsedMarkdownExtension>,
) {
    if !enabled {
        return;
    }
    for captures in callout_regex().captures_iter(text) {
        let Some(full_match) = captures.get(0) else {
            continue;
        };
        if is_skipped(full_match.start(), skip_ranges) {
            continue;
        }
        let raw_kind = captures
            .get(1)
            .map(|kind| kind.as_str().to_ascii_lowercase())
            .unwrap_or_else(|| "note".to_string());
        let kind = normalize_callout_kind(&raw_kind);
        let title = captures
            .get(2)
            .map(|title| title.as_str().trim().to_string())
            .filter(|title| !title.is_empty())
            .unwrap_or_else(|| default_callout_title(&kind).to_string());
        extensions.push(ParsedMarkdownExtension {
            kind: "callout".to_string(),
            value: format!("{kind}:{title}"),
            position: full_match.start(),
        });
    }
}

fn collect_footnotes(
    text: &str,
    skip_ranges: &[std::ops::Range<usize>],
    extensions: &mut Vec<ParsedMarkdownExtension>,
) {
    let definitions = footnote_definition_regex()
        .captures_iter(text)
        .filter_map(|captures| {
            let full_match = captures.get(0)?;
            if is_skipped(full_match.start(), skip_ranges) {
                return None;
            }
            Some((
                captures.get(1)?.as_str().to_string(),
                (captures.get(2)?.as_str().trim().to_string(), full_match.start()),
            ))
        })
        .collect::<std::collections::BTreeMap<_, _>>();
    let mut referenced = BTreeSet::new();
    for captures in footnote_reference_regex().captures_iter(text) {
        let Some(full_match) = captures.get(0) else {
            continue;
        };
        if text[full_match.end()..].starts_with(':') || is_skipped(full_match.start(), skip_ranges) {
            continue;
        }
        let Some(id) = captures.get(1).map(|id| id.as_str()) else {
            continue;
        };
        if definitions.contains_key(id) {
            referenced.insert(id.to_string());
            extensions.push(ParsedMarkdownExtension {
                kind: "footnoteRef".to_string(),
                value: id.to_string(),
                position: full_match.start(),
            });
        }
    }
    for id in referenced {
        if let Some((definition, position)) = definitions.get(&id) {
            extensions.push(ParsedMarkdownExtension {
                kind: "footnoteDef".to_string(),
                value: format!("{id}:{definition}"),
                position: *position,
            });
        }
    }
}

fn collect_highlights(
    text: &str,
    skip_ranges: &[std::ops::Range<usize>],
    extensions: &mut Vec<ParsedMarkdownExtension>,
) {
    let mut cursor = 0;
    while let Some(relative_start) = text[cursor..].find("==") {
        let start = cursor + relative_start;
        if start > 0 && text.as_bytes()[start - 1] == b'\\' {
            cursor = text[start + 2..]
                .find("==")
                .map_or(start + 2, |relative_end| start + 2 + relative_end + 2);
            continue;
        }
        let content_start = start + 2;
        let Some(relative_end) = text[content_start..].find("==") else {
            break;
        };
        let end = content_start + relative_end;
        let content = &text[content_start..end];
        if !content.is_empty()
            && !content.contains('\n')
            && !content.starts_with("![")
            && !content.starts_with("![[")
            && !is_skipped(start, skip_ranges)
        {
            extensions.push(ParsedMarkdownExtension {
                kind: "highlight".to_string(),
                value: content.to_string(),
                position: start,
            });
        }
        cursor = end + 2;
    }
}

fn normalize_callout_kind(kind: &str) -> String {
    match kind {
        "note" | "info" | "tip" | "warning" | "danger" | "success" | "quote" | "abstract"
        | "example" => kind.to_string(),
        _ => "note".to_string(),
    }
}

fn default_callout_title(kind: &str) -> &'static str {
    match kind {
        "info" => "Info",
        "tip" => "Tip",
        "warning" => "Warning",
        "danger" => "Danger",
        "success" => "Success",
        "quote" => "Quote",
        "abstract" => "Abstract",
        "example" => "Example",
        _ => "Note",
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
