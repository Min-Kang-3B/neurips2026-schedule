-- D1 schema for the NeurIPS 2026 MCP server. Paper/event tables are reseeded on every data
-- refresh (scripts/build_d1.py); the wish table holds synced wishlists and is never reseeded.
CREATE TABLE IF NOT EXISTS papers (
  id TEXT NOT NULL, sid TEXT NOT NULL, venue TEXT, en TEXT, ko TEXT, authors TEXT, inst TEXT,
  tag TEXT, ws INTEGER, emb INTEGER, pos TEXT, psess TEXT, link TEXT, abs TEXT, abs_ko TEXT, hay TEXT
);
CREATE INDEX IF NOT EXISTS papers_id ON papers(id);
CREATE INDEX IF NOT EXISTS papers_emb ON papers(emb);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, venue TEXT, date TEXT, start TEXT, end_t TEXT, end_next INTEGER, type TEXT,
  type_en TEXT, type_ko TEXT, en TEXT, ko TEXT, room TEXT, speaker TEXT, organizers TEXT, n_papers INTEGER
);
CREATE INDEX IF NOT EXISTS events_day ON events(venue, date);
CREATE TABLE IF NOT EXISTS wish (code TEXT PRIMARY KEY, doc TEXT NOT NULL, updated INTEGER NOT NULL);
