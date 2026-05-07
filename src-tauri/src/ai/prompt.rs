use std::collections::HashMap;

use crate::ai::skills::Skill;

/// Build the final prompt by interpolating `{{var}}` placeholders in the skill's
/// system prompt. Missing variables become empty strings (with a warning log).
/// After interpolation, smart-truncates `body` (and falls back to `selection` /
/// `prefix` for slash skills) so the total prompt fits in `max_tokens_in × 4`
/// bytes — title and frontmatter are always preserved.
pub fn build(skill: &Skill, vars: &HashMap<String, String>) -> String {
    let mut working = vars.clone();
    let cap_bytes = (skill.max_tokens_in as usize).saturating_mul(4);

    // Compute everything-but-truncatable size first.
    let truncatable_keys = ["body", "selection", "prefix"];
    let preserved_keys = working
        .keys()
        .filter(|k| !truncatable_keys.contains(&k.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    let preserved_size: usize = preserved_keys
        .iter()
        .map(|k| working.get(k).map(|v| v.len()).unwrap_or(0))
        .sum();
    let template_size = skill.system_prompt.len();
    let safety_margin = 256;
    let truncatable_budget =
        cap_bytes.saturating_sub(template_size + preserved_size + safety_margin);

    // Apply truncation budget across truncatable fields proportional to current size.
    let truncatable_total: usize = truncatable_keys
        .iter()
        .map(|k| working.get(*k).map(|v| v.len()).unwrap_or(0))
        .sum();
    if truncatable_total > truncatable_budget && truncatable_total > 0 {
        for key in &truncatable_keys {
            if let Some(value) = working.get_mut(*key) {
                if value.is_empty() {
                    continue;
                }
                let share =
                    (value.len() as f64 / truncatable_total as f64) * truncatable_budget as f64;
                let target = share.floor() as usize;
                if value.len() > target {
                    truncate_utf8(value, target);
                    value.push_str("\n\n[...truncated]");
                }
            }
        }
    }

    interpolate(&skill.system_prompt, &working)
}

fn interpolate(template: &str, vars: &HashMap<String, String>) -> String {
    let mut out = String::with_capacity(template.len() + 64);
    let bytes = template.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if i + 1 < bytes.len() && bytes[i] == b'{' && bytes[i + 1] == b'{' {
            if let Some(end) = find_close(&bytes[i + 2..]) {
                let key_end = i + 2 + end;
                let key = std::str::from_utf8(&bytes[i + 2..key_end])
                    .unwrap_or("")
                    .trim();
                match vars.get(key) {
                    Some(value) => out.push_str(value),
                    None => {
                        eprintln!("noxe: prompt var '{{{{{key}}}}}' is missing — substituted empty string");
                    }
                }
                i = key_end + 2;
                continue;
            }
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    out
}

fn find_close(rest: &[u8]) -> Option<usize> {
    let mut j = 0;
    while j + 1 < rest.len() {
        if rest[j] == b'}' && rest[j + 1] == b'}' {
            return Some(j);
        }
        j += 1;
    }
    None
}

/// Truncate a String to at most `max` bytes without breaking a UTF-8 char boundary.
fn truncate_utf8(s: &mut String, max: usize) {
    if s.len() <= max {
        return;
    }
    let mut end = max;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    s.truncate(end);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::skills::{ModelTier, SkillSource};

    fn skill(template: &str, max_in: u32) -> Skill {
        Skill {
            id: "t".into(),
            name: "T".into(),
            model_tier: ModelTier::Small,
            max_tokens_in: max_in,
            max_tokens_out: 100,
            cache: true,
            output_schema: "text".into(),
            triggers: vec![],
            system_prompt: template.into(),
            source: SkillSource::Bundled,
        }
    }

    #[test]
    fn interpolates_simple_placeholders() {
        let s = skill("Hello {{name}}", 1000);
        let mut vars = HashMap::new();
        vars.insert("name".into(), "world".into());
        assert_eq!(build(&s, &vars), "Hello world");
    }

    #[test]
    fn missing_variable_becomes_empty() {
        let s = skill("Hi {{missing}}.", 1000);
        let vars = HashMap::new();
        assert_eq!(build(&s, &vars), "Hi .");
    }

    #[test]
    fn smart_truncate_preserves_title_and_frontmatter() {
        // 100 tokens → 400 bytes cap. Big body should be cut, title kept.
        let s = skill(
            "Title: {{title}}\nFrontmatter: {{frontmatter}}\nBody: {{body}}",
            100,
        );
        let mut vars = HashMap::new();
        vars.insert("title".into(), "Important Title".into());
        vars.insert("frontmatter".into(), "tags: [a, b]".into());
        vars.insert("body".into(), "x".repeat(10_000));
        let out = build(&s, &vars);
        assert!(out.contains("Important Title"));
        assert!(out.contains("tags: [a, b]"));
        assert!(out.contains("[...truncated]"));
        assert!(out.len() < 1000);
    }

    #[test]
    fn small_body_is_not_truncated() {
        let s = skill("Body: {{body}}", 1000);
        let mut vars = HashMap::new();
        vars.insert("body".into(), "short".into());
        let out = build(&s, &vars);
        assert_eq!(out, "Body: short");
        assert!(!out.contains("[...truncated]"));
    }

    #[test]
    fn truncate_utf8_respects_char_boundaries() {
        let mut s = String::from("héllo");
        truncate_utf8(&mut s, 3); // would split é (2 bytes) at byte 2 -> end at 1
        assert!(s.is_char_boundary(s.len()));
    }
}
