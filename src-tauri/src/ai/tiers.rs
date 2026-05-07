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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claude_small_uses_haiku() {
        assert_eq!(
            args_for("claude", &ModelTier::Small),
            vec!["--model".to_string(), "haiku".to_string()]
        );
    }

    #[test]
    fn claude_standard_has_no_flag() {
        assert!(args_for("claude", &ModelTier::Standard).is_empty());
    }

    #[test]
    fn claude_premium_uses_opus() {
        assert_eq!(
            args_for("claude", &ModelTier::Premium),
            vec!["--model".to_string(), "opus".to_string()]
        );
    }

    #[test]
    fn copilot_ignores_tier() {
        assert!(args_for("copilot", &ModelTier::Small).is_empty());
        assert!(args_for("copilot", &ModelTier::Premium).is_empty());
    }

    #[test]
    fn unknown_provider_returns_empty() {
        assert!(args_for("unknown", &ModelTier::Small).is_empty());
    }
}
