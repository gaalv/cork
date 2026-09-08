use crate::ai::AiError;

pub struct Invocation {
    pub args: Vec<String>,
    pub stdin: String,
    pub model_identity: String,
}

/// Build the complete non-interactive invocation for one provider.
/// Empty model names always mean the provider's own automatic/default choice.
pub fn invocation(
    provider: &str,
    override_model: &str,
    prompt: &str,
) -> Result<Invocation, AiError> {
    let model = validated_model(override_model)?;
    let model_identity = model.clone().unwrap_or_else(|| "auto".to_string());

    let (args, stdin) = match provider {
        "claude" => {
            let mut args = vec![
                "--print".to_string(),
                "--no-session-persistence".to_string(),
                "--tools".to_string(),
                String::new(),
            ];
            push_model(&mut args, model.as_deref());
            (args, prompt.to_string())
        }
        "copilot" => {
            let mut args = vec![
                "--silent".to_string(),
                "--no-ask-user".to_string(),
                "--no-auto-update".to_string(),
                "--no-custom-instructions".to_string(),
                "--no-remote".to_string(),
                "--no-remote-export".to_string(),
                "--disable-builtin-mcps".to_string(),
                "--available-tools=ask_user".to_string(),
                "--deny-tool=shell,write,read,url,memory".to_string(),
                "--log-level=none".to_string(),
            ];
            if let Some(model) = model.as_deref() {
                args.push(format!("--model={model}"));
            }
            (args, prompt.to_string())
        }
        _ => {
            return Err(AiError::provider_disabled(format!(
                "Unknown AI provider: {provider}"
            )))
        }
    };

    Ok(Invocation {
        args,
        stdin,
        model_identity,
    })
}

fn validated_model(value: &str) -> Result<Option<String>, AiError> {
    let value = value.trim();
    if value.is_empty() {
        return Ok(None);
    }
    if value.len() > 200 || value.chars().any(char::is_control) {
        return Err(AiError::invalid_model("The model name is not valid"));
    }
    Ok(Some(value.to_string()))
}

fn push_model(args: &mut Vec<String>, model: Option<&str>) {
    if let Some(model) = model {
        args.push("--model".to_string());
        args.push(model.to_string());
    }
}

/// The tier's slug, for reading the matching user override out of settings.
pub fn tier_key(tier: &crate::ai::skills::ModelTier) -> &'static str {
    match tier {
        crate::ai::skills::ModelTier::Small => "small",
        crate::ai::skills::ModelTier::Standard => "standard",
        crate::ai::skills::ModelTier::Premium => "premium",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn automatic_never_adds_a_model_flag() {
        for provider in ["claude", "copilot"] {
            let invocation = invocation(provider, "", "hello").expect("provider invocation");
            assert_eq!(invocation.model_identity, "auto");
            assert!(!invocation.args.iter().any(|arg| arg == "--model"));
            assert!(!invocation
                .args
                .iter()
                .any(|arg| arg.starts_with("--model=")));
        }
    }

    #[test]
    fn each_provider_uses_its_own_non_interactive_shape() {
        let claude = invocation("claude", "sonnet", "hello").expect("claude invocation");
        assert!(claude.args.iter().any(|arg| arg == "--print"));
        assert_eq!(claude.stdin, "hello");

        let copilot = invocation("copilot", "gpt-5", "hello").expect("copilot invocation");
        assert!(!copilot.args.iter().any(|arg| arg.starts_with("--prompt")));
        assert_eq!(copilot.stdin, "hello");
        assert!(copilot.args.iter().any(|arg| arg == "--no-remote-export"));
        assert!(copilot
            .args
            .iter()
            .any(|arg| arg == "--available-tools=ask_user"));
        assert!(copilot.args.iter().any(|arg| arg == "--no-ask-user"));

        assert!(invocation("codex", "gpt-5", "hello").is_err());
    }
}
