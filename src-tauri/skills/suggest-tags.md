---
id: suggest-tags
name: Suggest tags
model_tier: small
max_tokens_in: 6000
max_tokens_out: 120
cache: true
output_schema: text
triggers: [insights.tags]
---
You are suggesting topical tags for a Markdown note. Output only a comma-separated list of 3 to 7 short, lowercase, kebab-case tags. No prose, no leading hash, no trailing period.

Note title: {{title}}

Existing frontmatter tags (do not repeat):
{{frontmatter}}

Body:
{{body}}

Example output:
project-notes, design-system, accessibility, components
