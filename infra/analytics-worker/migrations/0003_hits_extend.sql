-- migrations/0003_hits_extend.sql  (reference DDL)
-- SQLite has no "ADD COLUMN IF NOT EXISTS", so this file is the SOURCE OF TRUTH for the
-- 15 new columns; apply it idempotently via:  node scripts/apply-0003.mjs
-- (which reads PRAGMA table_info(hits) and runs only the missing ALTERs).
ALTER TABLE hits ADD COLUMN visitor      TEXT NOT NULL DEFAULT '';
ALTER TABLE hits ADD COLUMN vid          TEXT NOT NULL DEFAULT '';
ALTER TABLE hits ADD COLUMN sid          TEXT NOT NULL DEFAULT '';
ALTER TABLE hits ADD COLUMN ip_hash      TEXT NOT NULL DEFAULT '';
ALTER TABLE hits ADD COLUMN device       TEXT NOT NULL DEFAULT '';
ALTER TABLE hits ADD COLUMN os           TEXT NOT NULL DEFAULT '';
ALTER TABLE hits ADD COLUMN browser      TEXT NOT NULL DEFAULT '';
ALTER TABLE hits ADD COLUMN blang        TEXT NOT NULL DEFAULT '';
ALTER TABLE hits ADD COLUMN vw           INTEGER;
ALTER TABLE hits ADD COLUMN utm_source   TEXT NOT NULL DEFAULT '';
ALTER TABLE hits ADD COLUMN utm_medium   TEXT NOT NULL DEFAULT '';
ALTER TABLE hits ADD COLUMN utm_campaign TEXT NOT NULL DEFAULT '';
ALTER TABLE hits ADD COLUMN campaign     TEXT NOT NULL DEFAULT '';
ALTER TABLE hits ADD COLUMN dur_ms       INTEGER;
ALTER TABLE hits ADD COLUMN scroll       INTEGER;
CREATE INDEX IF NOT EXISTS idx_hits_vid     ON hits(vid);
CREATE INDEX IF NOT EXISTS idx_hits_day_vid ON hits(day, vid);