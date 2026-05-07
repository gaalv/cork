---
id: slash-rephrase
name: Rephrase selection
model_tier: small
max_tokens_in: 4000
max_tokens_out: 800
timeout_secs: 90
cache: false
output_schema: text
triggers: [slash.rephrase]
---
You are rephrasing the selected Markdown text to be clearer and more concise while preserving meaning, tone, and any Markdown formatting. Output ONLY the rephrased text — no commentary, no preface, no code fences, no quoting.

Selection:
{{selection}}
