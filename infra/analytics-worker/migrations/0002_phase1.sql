-- migrations/0002_phase1.sql  (idempotent: CREATE TABLE IF NOT EXISTS)
-- Phase 1 tables. Raw IP and raw User-Agent are NEVER stored here.

CREATE TABLE IF NOT EXISTS calcs (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,          -- unix seconds (UTC)
  day     TEXT    NOT NULL,          -- 'YYYY-MM-DD' (UTC)
  vid     TEXT    NOT NULL,
  sid     TEXT    NOT NULL,
  tool    TEXT    NOT NULL,
  lang    TEXT    NOT NULL,
  inputs  TEXT    NOT NULL,          -- JSON: {key: number|boolean|string(<=60)}
  result  TEXT    NOT NULL,          -- JSON: [[label(<=40), value(<=80)] x <=8]
  country TEXT    NOT NULL,
  region  TEXT    NOT NULL,
  city    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_calcs_day_tool ON calcs(day, tool);
CREATE INDEX IF NOT EXISTS idx_calcs_vid      ON calcs(vid);

CREATE TABLE IF NOT EXISTS profiles (
  vid           TEXT    PRIMARY KEY,
  created_ts    INTEGER NOT NULL,
  updated_ts    INTEGER NOT NULL,
  lang          TEXT    NOT NULL,
  age_band      TEXT    NOT NULL DEFAULT '',
  asset_band    TEXT    NOT NULL DEFAULT '',
  goal          TEXT    NOT NULL DEFAULT '',
  markets       TEXT    NOT NULL DEFAULT '',   -- comma-joined whitelist
  follows       TEXT    NOT NULL DEFAULT '',   -- comma-joined whitelist
  leverage_exp  TEXT    NOT NULL DEFAULT '',
  country       TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS feedback (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,
  tool     TEXT    NOT NULL,
  lang     TEXT    NOT NULL,
  vid      TEXT    NOT NULL DEFAULT '',
  rating   INTEGER,                          -- 1..5
  message  TEXT    NOT NULL,                 -- 3..1000 chars (trimmed)
  contact  TEXT    NOT NULL,                 -- <=120
  wtp      TEXT    NOT NULL DEFAULT '',      -- comma-joined whitelist
  country  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_ts ON feedback(ts);

CREATE TABLE IF NOT EXISTS subscribers (
  email                   TEXT    PRIMARY KEY,
  vid                     TEXT    NOT NULL DEFAULT '',
  lang                    TEXT    NOT NULL,
  source                  TEXT    NOT NULL,
  status                  TEXT    NOT NULL,   -- pending | confirmed | unsubscribed
  token                   TEXT    NOT NULL,
  created_ts              INTEGER NOT NULL,
  confirmed_ts            INTEGER,
  last_confirm_sent_ts    INTEGER,
  last_sent_year          INTEGER
);
CREATE INDEX IF NOT EXISTS idx_subscribers_status              ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_token               ON subscribers(token);
CREATE INDEX IF NOT EXISTS idx_subscribers_last_confirm_sent   ON subscribers(last_confirm_sent_ts);