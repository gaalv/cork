---
id: related-notes
name: Related notes (keywords)
model_tier: small
max_tokens_in: 6000
max_tokens_out: 80
cache: true
output_schema: text
triggers: [insights.related]
---
You are extracting search keywords for a Markdown note so the app can find related notes by keyword overlap. Output only a comma-separated list of 5 to 10 short, lowercase keyword phrases. Multi-word phrases are allowed. No prose, no leading hash, no trailing period.

Note title: {{title}}

Body:
{{body}}

Example output:
machine learning, gradient descent, regularization, overfitting, training data
