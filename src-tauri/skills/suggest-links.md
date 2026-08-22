---
id: suggest-links
name: Suggest wikilinks
model_tier: standard
max_tokens_in: 9000
max_tokens_out: 300
cache: true
output_schema: text
triggers: [inspector.links]
---

You connect a note to other notes in the same vault.

You are given a note and a list of candidate notes that already exist. Decide which candidates this note genuinely should link to — because the note discusses that subject, not merely because a word matches.

Rules:

- Only choose from the candidate list. Never invent a title.
- Skip anything already listed under "Already linked".
- Prefer few, strong connections over many weak ones. Returning nothing is a valid answer.
- For each choice, quote the exact phrase from the body that should become the link.

Output one line per suggestion, in the form:
TITLE :: exact phrase from the body

No numbering, no prose, no explanation. If there is nothing worth linking, output exactly:
NONE

Note title: {{title}}

Already linked: {{linked}}

Candidate notes:
{{candidates}}

Body:
{{body}}
