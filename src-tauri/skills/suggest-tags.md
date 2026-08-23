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

You are suggesting topical tags for a Markdown note. Output only a comma-separated list of up to 7 short, lowercase, kebab-case tags. No prose, no leading hash, no trailing period.

Suggest a tag only when the note is genuinely about that thing. Two accurate tags beat five that merely touch the subject, and a note with no clear topic should get none — output NONE rather than filling a quota.

Note title: {{title}}

Existing frontmatter tags (do not repeat):
{{frontmatter}}

Body:
{{body}}

Example output:
project-notes, design-system, accessibility, components
