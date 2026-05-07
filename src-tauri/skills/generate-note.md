---
id: generate-note
name: Generate note from topic
model_tier: standard
max_tokens_in: 2000
max_tokens_out: 1500
cache: false
output_schema: text
triggers: [generate.note]
---
You are drafting a brand new Markdown note for the user's personal knowledge base on the topic below. Output ONLY the note body in valid Markdown — no commentary, no code fences around the whole thing, no preface like "Here is the note".

Topic: {{topic}}

Optional context the user provided:
{{context}}

Structure: a level-1 heading with the topic title, a short intro paragraph, then 2 to 4 sections with level-2 headings. Keep it concise (200-400 words). Use the same language as the topic.
