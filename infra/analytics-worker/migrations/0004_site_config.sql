-- Small key/value config the owner can change without a deploy (e.g. the WeChat group QR).
CREATE TABLE IF NOT EXISTS site_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_ts INTEGER NOT NULL
);
