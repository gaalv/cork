ALTER TABLE links ADD COLUMN ambiguous INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_links_ambiguous ON links(ambiguous);
CREATE INDEX IF NOT EXISTS idx_links_target_text_lower ON links(LOWER(target_text));
