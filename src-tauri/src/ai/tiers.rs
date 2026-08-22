use crate::ai::skills::ModelTier;

/// Maps a logical `ModelTier` to provider-specific CLI args.
///
/// `override_model` is the user's choice for this provider and tier; empty
/// means "no preference", which falls back to the built-in defaults below.
///
/// Every supported CLI takes `--model <name>`. That is verified for `claude`;
/// for `copilot` and `codex` it is the documented convention but has not been
/// exercised here, which is why Settings offers a test button — a wrong flag
/// surfaces as the CLI's own error rather than a silent fallback.
pub fn args_for(provider: &str, tier: &ModelTier, override_model: &str) -> Vec<String> {
    let chosen = override_model.trim();
    if !chosen.is_empty() {
        return vec!["--model".to_string(), chosen.to_string()];
    }

    match (provider, tier) {
        // Cheap tier runs on the small model to keep frequent skills affordable.
        ("claude", ModelTier::Small) => vec!["--model".to_string(), "haiku".to_string()],
        ("claude", ModelTier::Standard) => vec![],
        ("claude", ModelTier::Premium) => vec!["--model".to_string(), "opus".to_string()],
        // No documented default worth assuming for the others — let the CLI pick.
        _ => vec![],
    }
}

/// The tier's slug, for reading the matching user override out of settings.
pub fn tier_key(tier: &ModelTier) -> &'static str {
    match tier {
        ModelTier::Small => "small",
        ModelTier::Standard => "standard",
        ModelTier::Premium => "premium",
    }
}
