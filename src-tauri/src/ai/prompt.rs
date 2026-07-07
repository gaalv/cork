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
    let mut rest = template;
    while let Some(open) = rest.find("{{") {
        out.push_str(&rest[..open]);
        let after_open = &rest[open + 2..];
        if let Some(close) = after_open.find("}}") {
            let key = after_open[..close].trim();
            match vars.get(key) {
                Some(value) => out.push_str(value),
                None => {
                    eprintln!("cork: prompt var '{{{{{key}}}}}' is missing — substituted empty string");
                }
            }
            rest = &after_open[close + 2..];
        } else {
            // No closing `}}` — emit the `{{` literally and continue.
            out.push_str("{{");
            rest = after_open;
        }
    }
    out.push_str(rest);
    out
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
