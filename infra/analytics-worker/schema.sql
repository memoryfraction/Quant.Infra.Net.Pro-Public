-- One row per page view / event. The IP address is NOT stored; only Cloudflare's geo lookup of it (as fine as it gets).
CREATE TABLE IF NOT EXISTS hits (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,          -- unix seconds (UTC)
  day     TEXT    NOT NULL,          -- 'YYYY-MM-DD' (UTC)
  path    TEXT    NOT NULL,
  event   TEXT    NOT NULL,          -- 'view' | 'calc' | 'share'
  country TEXT    NOT NULL,
  region  TEXT    NOT NULL,          -- state / province
  city    TEXT    NOT NULL,
  postal  TEXT    NOT NULL,          -- postal code
  lat     REAL,                      -- rounded to 2 decimals (~1 km)
  lon     REAL,
  tz      TEXT    NOT NULL,          -- IANA timezone
  metro   TEXT    NOT NULL,          -- US metro code, '' elsewhere
  ref     TEXT    NOT NULL           -- referrer host, '' = direct, 'self' = internal
);
CREATE INDEX IF NOT EXISTS idx_hits_day  ON hits(day);
CREATE INDEX IF NOT EXISTS idx_hits_path ON hits(path, event);
