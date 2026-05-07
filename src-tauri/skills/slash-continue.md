---
id: slash-continue
name: Continue writing
model_tier: small
max_tokens_in: 4000
max_tokens_out: 800
cache: false
output_schema: text
triggers: [slash.continue]
---
You are continuing the user's Markdown note from where they stopped. Output ONLY the continuation text that should be appended directly after the existing content — no commentary, no preface, no repetition of the existing text. Match the tone, language, and Markdown formatting of what came before.

Existing content (you continue from the end of this):
{{prefix}}
