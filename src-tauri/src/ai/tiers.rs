use crate::ai::skills::ModelTier;

/// Maps a logical `ModelTier` to provider-specific CLI args.
/// Returns an empty Vec when no specific flag is needed for that combination.
pub fn args_for(provider: &str, tier: &ModelTier) -> Vec<String> {
    match (provider, tier) {
        ("claude", ModelTier::Small) => vec!["--model".to_string(), "haiku".to_string()],
        ("claude", ModelTier::Standard) => vec![],
        ("claude", ModelTier::Premium) => vec!["--model".to_string(), "opus".to_string()],
        // Copilot CLI does not currently expose model selection — fall back to default.
        ("copilot", _) => vec![],
        _ => vec![],
    }
}
