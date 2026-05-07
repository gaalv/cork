---
id: generate-note
name: Generate note from topic
model_tier: standard
max_tokens_in: 2000
max_tokens_out: 6000
timeout_secs: 240
cache: false
output_schema: text
triggers: [generate.note]
---
You are drafting a comprehensive Markdown note for the user's personal knowledge base on the topic below. Output ONLY the note body in valid Markdown — no commentary, no code fences around the whole thing, no preface like "Here is the note".

Topic: {{topic}}

Optional context the user provided:
{{context}}

Write a thorough, well-structured note. Include:
- a level-1 heading with the topic title
- a short intro paragraph (2-4 sentences) framing the topic
- 4 to 8 sections with level-2 headings covering the main facets, mechanics, trade-offs, examples, and practical guidance
- bullet lists, code blocks (fenced with the appropriate language), and tables where they aid clarity
- a final "## See also" or "## References" section with 3-6 plain-text suggestions for further reading or related topics

Aim for 600-1200 words of actual content. Be concrete: prefer specific names, numbers, examples, and trade-offs over vague generalities. Match the language of the topic (Portuguese topic → Portuguese note, English topic → English note).

