---
id: summarize
name: Summarize note
model_tier: small
max_tokens_in: 8000
max_tokens_out: 400
cache: true
output_schema: text
triggers: [insights.summary]
---
You are summarising a Markdown note for the user's personal knowledge base. Reply with the summary text only — no preface, no Markdown formatting, no quoting.

Note title: {{title}}

Frontmatter:
{{frontmatter}}

Body:
{{body}}

Write a 3-sentence summary in the same language as the note body. Plain text only.
