PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  path        TEXT NOT NULL UNIQUE,
  folder      TEXT NOT NULL,
  title       TEXT NOT NULL,
  size        INTEGER NOT NULL,
  mtime       INTEGER NOT NULL,
  created     INTEGER,
  updated     INTEGER,
  body_hash   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_mtime ON notes(mtime DESC);
CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder);

CREATE TABLE IF NOT EXISTS tags (
  tag         TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS note_tags (
  note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL REFERENCES tags(tag) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag);

CREATE TABLE IF NOT EXISTS links (
  src_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  target_text TEXT NOT NULL,
  target_id   TEXT,
  position    INTEGER NOT NULL,
  alias       TEXT
);
CREATE INDEX IF NOT EXISTS idx_links_src ON links(src_note_id);
CREATE INDEX IF NOT EXISTS idx_links_target_id ON links(target_id);
CREATE INDEX IF NOT EXISTS idx_links_target_text ON links(target_text);

CREATE TABLE IF NOT EXISTS frontmatter (
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  key     TEXT NOT NULL,
  value   TEXT NOT NULL,
  PRIMARY KEY (note_id, key)
);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  id UNINDEXED,
  title,
  body,
  tokenize = 'porter unicode61 remove_diacritics 2'
);
