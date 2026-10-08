-- One row per page view / event. Stores the visitor's public IP and Cloudflare geo (country/region/city).
CREATE TABLE IF NOT EXISTS hits (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,          -- unix seconds (UTC)
  day     TEXT    NOT NULL,          -- 'YYYY-MM-DD' (UTC)
  path    TEXT    NOT NULL,
  event   TEXT    NOT NULL,          -- 'view' | 'calc' | 'share'
  ip      TEXT    NOT NULL,
  country TEXT    NOT NULL,
  region  TEXT    NOT NULL,
  city    TEXT    NOT NULL,
  ref     TEXT    NOT NULL           -- referrer host, '' = direct, 'self' = internal
);
CREATE INDEX IF NOT EXISTS idx_hits_day  ON hits(day);
CREATE INDEX IF NOT EXISTS idx_hits_path ON hits(path, event);
