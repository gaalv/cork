---
id: slash-expand
name: Expand selection
model_tier: small
max_tokens_in: 4000
max_tokens_out: 1200
timeout_secs: 90
cache: false
output_schema: text
triggers: [slash.expand]
---
You are expanding the selected Markdown text with more detail, examples, and context. Preserve any Markdown formatting and the original tone. Output ONLY the expanded version — no commentary, no preface.

Selection:
{{selection}}
