// test/index.test.mjs — endpoint-level tests for the analytics Worker.
// Uses a tiny in-memory D1 stub (so `node --test` needs no network / no wrangler).
// Brevo is MOCKED via a global fetch stub: no real email is ever sent.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import worker from "../src/index.js";

// ---------------------------------------------------------------------------
// Minimal D1 stub: supports prepare().bind().run()/first()/all() and the small
// SQL subset our handlers use. Good enough to exercise real handler logic.
// ---------------------------------------------------------------------------
function makeDB() {
  const tables = { hits: [], calcs: [], profiles: [], feedback: [], subscribers: [], site_config: [] };
  const counters = { hits: 0, calcs: 0, feedback: 0 };

  // Columns declared NOT NULL in migrations/0002 + 0003. Real D1 rejects a NULL
  // for any of these; the stub used to accept them, which is how "an invalid
  // enum is stored as NULL" passed here while production threw
  // `NOT NULL constraint failed: profiles.age_band`.
  const NOT_NULL = new Set([
    "hits:path", "hits:event", "hits:day", "hits:ts",
    "calcs:ts", "calcs:day", "calcs:tool", "calcs:lang", "calcs:inputs", "calcs:result",
    "profiles:vid", "profiles:created_ts", "profiles:updated_ts", "profiles:lang",
    "profiles:age_band", "profiles:asset_band", "profiles:goal",
    "profiles:markets", "profiles:follows", "profiles:leverage_exp", "profiles:country",
    "feedback:ts", "feedback:lang", "feedback:message",
    "subscribers:email", "subscribers:lang", "subscribers:source",
    "subscribers:status", "subscribers:token", "subscribers:created_ts",
  ]);

  function assertNotNull(table, rec) {
    for (const [col, val] of Object.entries(rec)) {
      if (val === null && NOT_NULL.has(`${table}:${col}`)) {
        throw new Error(`D1_ERROR: NOT NULL constraint failed: ${table}.${col}`);
      }
    }
  }

  function run(sql, args) {
    const s = sql.replace(/\s+/g, " ").trim();

    // ---- INSERT ----
    let m = s.match(/^INSERT INTO (\w+)\s*\(([^)]*)\)\s*VALUES\s*\(([^)]*)\)/i);
    if (m) {
      const table = m[1];
      const cols = m[2].split(",").map((c) => c.trim());
      // A real D1 rejects a statement whose placeholder count disagrees with
      // its column count. The old stub silently tolerated that, which let a
      // 28-column / 27-placeholder INSERT ship green while every production
      // write failed. Enforce the invariant here so it can never hide again.
      const nPlaceholders = (m[3].match(/\?/g) || []).length;
      assert.equal(
        nPlaceholders, cols.length,
        `INSERT INTO ${table}: ${cols.length} columns but ${nPlaceholders} placeholders`
      );
      assert.equal(
        args.length, nPlaceholders,
        `INSERT INTO ${table}: ${nPlaceholders} placeholders but ${args.length} bound values`
      );
      const rec = {};
      cols.forEach((c, i) => { rec[c] = args[i]; });
      assertNotNull(table, rec);
      if (table === "hits") { rec.id = ++counters.hits; }
      if (table === "calcs") { rec.id = ++counters.calcs; }
      if (table === "feedback") { rec.id = ++counters.feedback; }
      // profiles has ON CONFLICT ... DO UPDATE
      if (table === "profiles") {
        const ix = tables.profiles.findIndex((r) => r.vid === rec.vid);
        if (ix >= 0) { Object.assign(tables.profiles[ix], rec); return { meta: { changes: 1 } }; }
      }
      if (table === "subscribers") {
        if (tables.subscribers.some((r) => r.email === rec.email)) return { meta: { changes: 0 } };
      }
      tables[table].push(rec);
      return { meta: { changes: 1 } };
    }

    // ---- UPDATE ----
    m = s.match(/^UPDATE (\w+) SET (.*?)(?: WHERE (.*))?$/i);
    if (m) {
      const table = m[1];
      const sets = m[2].split(",").map((p) => p.trim().split("=").map((x) => x.trim()));
      const where = m[3] || "";
      // SET placeholders (if any) come BEFORE the WHERE placeholders.
      const setVals = [];
      for (const [, valExpr] of sets) if (valExpr === "?") setVals.push(args.shift());
      const whereArgs = args.slice();
      let n = 0, si = 0;
      for (const row of tables[table]) {
        if (!matchWhere(row, where, whereArgs.slice())) continue;
        const patch = {};
        for (const [col, valExpr] of sets) patch[col] = valExpr === "?" ? setVals[si++] : valExpr.replace(/'/g, "");
        assertNotNull(table, patch);
        Object.assign(row, patch);
        n++;
      }
      return { meta: { changes: n } };
    }

    // ---- DELETE ----
    m = s.match(/^DELETE FROM (\w+)(?: WHERE (.*))?$/i);
    if (m) {
      const table = m[1], where = m[2] || "";
      const before = tables[table].length;
      const kept = tables[table].filter((row) => !matchWhere(row, where, args));
      tables[table] = kept;
      return { meta: { changes: before - kept.length } };
    }
    return { meta: { changes: 0 } };
  }

  function matchWhere(row, where, args) {
    if (!where) return true;
    // Handles: col = ? | col = 'lit' | col <> '' | col < ? etc. | col IS [NOT] NULL
    //          plus a single trailing parenthesised (A OR B) group.
    let w = where.trim();
    const orGroup = w.match(/^(.*?)\s*AND\s*\(([^()]*\bOR\b[^()]*)\)\s*$/i);
    if (orGroup) {
      if (!matchWhere(row, orGroup[1], args)) return false;
      return orGroup[2].split(/\s+OR\s+/i).some((alt) => matchWhere(row, alt, args.slice()));
    }
    const parts = w.split(/\s+AND\s+/i);
    let ai = 0;
    for (const raw of parts) {
      const p = raw.trim().replace(/^\(|\)$/g, "");
      let mm;
      if ((mm = p.match(/^(\w+)\s+IS\s+NULL$/i))) { if (row[mm[1]] != null) return false; continue; }
      if ((mm = p.match(/^(\w+)\s+IS\s+NOT\s+NULL$/i))) { if (row[mm[1]] == null) return false; continue; }
      if ((mm = p.match(/^(\w+)\s*<>\s*''/))) { if (!row[mm[1]]) return false; continue; }
      if ((mm = p.match(/^(\w+)\s*=\s*'([^']*)'/))) { if (String(row[mm[1]]) !== mm[2]) return false; continue; }
      if ((mm = p.match(/^(\w+)\s*=\s*\?/))) { const want = args[ai++]; if (String(row[mm[1]]) !== String(want)) return false; continue; }
      if ((mm = p.match(/^(\w+)\s*(>=|<=|<|>)\s*\?/))) {
        const wantRaw = args[ai++], gotRaw = row[mm[1]];
        // date columns compare lexically (ISO 'YYYY-MM-DD'); numbers numerically.
        const numeric = Number.isFinite(Number(wantRaw)) && typeof gotRaw !== "string";
        const want = numeric ? Number(wantRaw) : String(wantRaw);
        const got = numeric ? Number(gotRaw) : String(gotRaw);
        const ok = mm[2] === ">=" ? got >= want : mm[2] === "<=" ? got <= want : mm[2] === "<" ? got < want : got > want;
        if (!ok) return false;
        continue;
      }
    }
    return true;
  }

  function select(sql, args) {
    const s = sql.replace(/\s+/g, " ").trim();

    // ---- SELECT * (row objects pass through as-is) ----
    let m = s.match(/^SELECT \* FROM (\w+)(?: WHERE (.+?))?(?: ORDER BY .+?)?(?: LIMIT (\d+))?$/i);
    if (m) {
      const [, table, where, limit] = m;
      let rows = (tables[table] || []).filter((r) => matchWhere(r, where || "", args.slice()));
      if (limit) rows = rows.slice(0, Number(limit));
      return { results: rows };
    }

    // ---- COUNT(DISTINCT col) ----
    m = s.match(/^SELECT COUNT\(DISTINCT (\w+)\) (?:n|(\w+)) FROM (\w+)(?: WHERE (.+?))?/i);
    if (m) {
      const [, col, alias, table, where] = m;
      const rows = (tables[table] || []).filter((r) => matchWhere(r, where || "", args.slice()));
      const key = alias || "n";
      return { results: [{ [key]: new Set(rows.map((r) => r[col]).filter(Boolean)).size }] };
    }

    // ---- generic SELECT with optional WHERE / GROUP BY / ORDER BY / LIMIT ----
    // LIMIT may be a literal or a bound "?" (which is always the LAST bound arg).
    const limMatch = s.match(/\sLIMIT\s+(\d+|\?)\s*$/i);
    const limitArg = limMatch ? limMatch[1] : null;
    const sqlBody = limitArg ? s.slice(0, s.length - limMatch[0].length) : s;
    m = sqlBody.match(/^SELECT (.+?) FROM (\w+)(?: WHERE (.+?))?(?: GROUP BY (.+?))?(?: ORDER BY (.+?))?$/i);
    if (!m) return { results: [] };
    const [, colsRaw, table, where, groupBy, orderBy] = m;
    const limit = limitArg === "?" ? args[args.length - 1] : limitArg;
    let rows = (tables[table] || []).filter((r) => matchWhere(r, where || "", args.slice(0, args.length - (limitArg === "?" ? 1 : 0))));
    const colList = colsRaw.split(",").map((c) => c.trim());
    // "expr AS alias" | "expr alias" | "col". The alias is the trailing bare word
    // when the expression is followed by one (e.g. "COUNT(*) n", "SUM(x) view").
    const split = colList.map((c) => {
      const asM = c.match(/^(.*?)\s+as\s+([A-Za-z_]\w*)$/i);
      if (asM) return { expr: asM[1].trim(), key: asM[2] };
      const spM = c.match(/^(.*?)\s+([A-Za-z_]\w*)$/);
      if (spM && !/[('"]$/.test(spM[1])) return { expr: spM[1].trim(), key: spM[2] };
      return { expr: c, key: c };
    });
    const keys = split.map((x) => x.key);
    const exprs = split.map((x) => x.expr);
    const exprFor = (row, col) => {
      let mm;
      if ((mm = col.match(/^COUNT\(\*\)$/i))) return 1;
      if ((mm = col.match(/^MIN\((\w+)\)$/i))) return row[mm[1]];
      if ((mm = col.match(/^MAX\((\w+)\)$/i))) return row[mm[1]];
      if ((mm = col.match(/^SUM\((.+)\)$/i))) {
        const inner = mm[1].trim();
        const cmp = inner.match(/^(\w+)\s*=\s*'([^']*)'$/);
        if (cmp) return row[cmp[1]] === cmp[2] ? 1 : 0;
        return Number(row[inner]) || 0;
      }
      if ((mm = col.match(/^ROUND\((.+?)(?:,\s*(\d+))?\)$/i))) {
        const v = Number(exprFor(row, mm[1].trim()));
        const d = mm[2] === undefined ? 0 : Number(mm[2]);
        const f = Math.pow(10, d);
        return Number.isFinite(v) ? Math.round(v * f) / f : null;
      }
      if ((mm = col.match(/^AVG\((\w+)\)$/i))) return row[mm[1]];
      return row[col];
    };

    let out;
    const hasAgg = exprs.some((c) => /^(COUNT|SUM|MIN|MAX|AVG)\(/i.test(c));
    if (groupBy) {
      const gcols = groupBy.split(",").map((c) => c.trim());
      const buckets = new Map();
      const aggKeys = keys.filter((k, i) => /^(COUNT|SUM|MIN|MAX|AVG)\(/i.test(exprs[i]));
      for (const r of rows) {
        const gk = gcols.map((g) => String(r[g])).join("\u0000");
        if (!buckets.has(gk)) {
          const o = {};
          for (const g of gcols) o[g] = r[g];
          for (const k of aggKeys) {
            const src = exprs[keys.indexOf(k)];
            o[k] = /^(COUNT|SUM)\(/i.test(src) ? 0 : null;
          }
          buckets.set(gk, o);
        }
        const o = buckets.get(gk);
        for (const k of aggKeys) {
          const src = exprs[keys.indexOf(k)];
          if (/^(COUNT|SUM)\(/i.test(src)) o[k] = (Number(o[k]) || 0) + exprFor(r, src);
          else {
            const v = exprFor(r, src);
            if (o[k] == null) o[k] = v;
            else if (/^MIN/i.test(src)) o[k] = v < o[k] ? v : o[k];
            else if (/^MAX/i.test(src)) o[k] = v > o[k] ? v : o[k];
          }
        }
        // non-aggregate passthrough columns
        for (let i = 0; i < keys.length; i++) {
          if (!/^(COUNT|SUM|MIN|MAX|AVG)\(/i.test(exprs[i]) && o[keys[i]] === undefined) o[keys[i]] = exprFor(r, exprs[i]);
        }
      }
      out = Array.from(buckets.values());
    } else if (hasAgg) {
      // aggregate over the whole result set: always exactly one row (like real SQL)
      const o = {};
      keys.forEach((k, i) => { o[k] = /^(COUNT|SUM)\(/i.test(exprs[i]) ? 0 : null; });
      for (const r of rows) {
        keys.forEach((k, i) => {
          const src = exprs[i];
          if (/^(COUNT|SUM)\(/i.test(src)) o[k] = (Number(o[k]) || 0) + exprFor(r, src);
          else {
            const v = exprFor(r, src);
            if (o[k] == null) o[k] = v;
            else if (/^MIN/i.test(src)) o[k] = v < o[k] ? v : o[k];
            else if (/^MAX/i.test(src)) o[k] = v > o[k] ? v : o[k];
          }
        });
      }
      out = [o];
    } else {
      out = rows.map((r) => { const o = {}; keys.forEach((k, i) => { o[k] = exprFor(r, exprs[i]); }); return o; });
    }

    if (orderBy) {
      const om = orderBy.match(/^(\w+)(?:\s+(ASC|DESC))?$/i);
      if (om) {
        const [, col, dir] = om;
        out.sort((a, b) => {
          const x = a[col], y = b[col];
          const c = (typeof x === "number" && typeof y === "number") ? x - y : String(x).localeCompare(String(y));
          return dir === "ASC" ? c : -c;
        });
      }
    }
    if (limit) out = out.slice(0, Number(limit));
    return { results: out };
  }

  return {
    _tables: tables,
    prepare(sql) {
      const args = [];
      // Real D1 validates bind() arity against the placeholder count and throws
      // on a mismatch in EITHER direction. The old stub accepted anything, so
      // two production bugs hid behind a green suite:
      //   - INSERT ... 28 columns / 27 placeholders  (every hit write failed)
      //   - a bind("") attached to a statement with no placeholder  (500)
      // Enforce the invariant at bind() time so neither can return unnoticed.
      const nPlaceholders = (String(sql).match(/\?/g) || []).length;
      return {
        bind(...a) {
          assert.equal(
            a.length, nPlaceholders,
            `bind() arity mismatch: statement has ${nPlaceholders} placeholder(s) but ${a.length} value(s) bound\nSQL: ${String(sql).slice(0, 160)}`
          );
          args.push(...a);
          return this;
        },
        async run() { return run(sql, args.slice()); },
        async first() { const r = select(sql, args.slice()); return r.results[0] || null; },
        async all() { return select(sql, args.slice()); },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------
const STATS_TOKEN = "test-stats-token-1234567890";
const IP_SALT = "a".repeat(64);

const env = () => ({ DB: makeDB(), STATS_TOKEN, IP_SALT, MAIL_FROM: "alphawealthlab@outlook.com" });
// note: BREVO_API_KEY intentionally absent by default -> 503 path.

const UA_DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const UA_WECHAT_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 MicroMessenger/8.0.44";

let ipCounter = 0;
function req(path, { method = "POST", body, ua = UA_DESKTOP, headers = {}, cf = {}, ip } = {}) {
  const init = {
    method,
    headers: {
      "User-Agent": ua,
      // Cloudflare sets this; handlers read it to build the salted ip_hash (raw IP never stored).
      // Each request gets a fresh IP by default so the rate-limit fallback (5/min per client)
      // does not bleed between independent test cases.
      "CF-Connecting-IP": ip === undefined ? "203.0.113." + (++ipCounter % 250 + 1) : ip,
      ...(body !== undefined ? { "content-type": "text/plain" } : {}),
      ...headers,
    },
  };
  if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body);
  const r = new Request("https://www.alpha-wealth-lab.com" + path, init);
  // attach `cf` the way Cloudflare does
  Object.defineProperty(r, "cf", { value: cf, configurable: true });
  return r;
}

async function call(path, opts, e) {
  return worker.fetch(req(path, opts), e || env(), { waitUntil() {} });
}

// Brevo mock: install once, restore after.
let mailCalls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith("https://api.brevo.com/")) {
    mailCalls.push({ url: String(url), init });
    const key = init && init.headers && init.headers["api-key"];
    if (!key) return new Response("no key", { status: 401 });
    return new Response(JSON.stringify({ messageId: "mock" }), { status: 201, headers: { "content-type": "application/json" } });
  }
  return realFetch(url, init);
};
process.on("exit", () => { globalThis.fetch = realFetch; });

const VID = "abcdef1234567890";
const SID = "0987654321fedcba";

beforeEach(() => { mailCalls = []; });

// ===========================================================================
// /api/health
// ===========================================================================
test("GET /api/health -> 200 ok", async () => {
  const res = await call("/api/health", { method: "GET" });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "ok");
});

// ===========================================================================
// /api/hit
// ===========================================================================
test("POST /api/hit basic view -> 204 and row written with UA parsed", async () => {
  const e = env();
  const res = await call("/api/hit", {
    body: { e: "view", p: "/planner/fi/index.html?x=1", vid: VID, sid: SID, vw: 390, bl: "zh-CN", us: "wechat", c: "share" },
    ua: UA_WECHAT_IOS, cf: { country: "CN", region: "Anhui", city: "Fuyang" },
  }, e);
  assert.equal(res.status, 204);
  const row = e.DB._tables.hits[0];
  assert.equal(row.path, "/planner/fi/");
  assert.equal(row.event, "view");
  assert.equal(row.vid, VID);
  assert.equal(row.browser, "wechat");
  assert.equal(row.device, "mobile");
  assert.equal(row.os, "ios");
  assert.equal(row.country, "CN");
  assert.equal(row.utm_source, "wechat");
  assert.equal(row.campaign, "share");
  // raw IP never stored
  assert.ok(!("ip" in row));
  assert.equal(row.ip_hash.length, 16);
});

test("POST /api/hit invalid vid/sid are dropped (not stored)", async () => {
  const e = env();
  await call("/api/hit", { body: { e: "view", p: "/", vid: "SHORT", sid: "bad!!" } }, e);
  assert.equal(e.DB._tables.hits[0].vid, "");
  assert.equal(e.DB._tables.hits[0].sid, "");
});

test("POST /api/hit leave event keeps d/sc; non-leave drops them", async () => {
  const e = env();
  await call("/api/hit", { body: { e: "leave", p: "/planner/fi/", vid: VID, sid: SID, d: 12345, sc: 80 } }, e);
  assert.equal(e.DB._tables.hits[0].dur_ms, 12345);
  assert.equal(e.DB._tables.hits[0].scroll, 80);
  await call("/api/hit", { body: { e: "view", p: "/planner/fi/", vid: VID, sid: SID, d: 12345, sc: 80 } }, e);
  assert.equal(e.DB._tables.hits[1].dur_ms, null);
  assert.equal(e.DB._tables.hits[1].scroll, null);
});

test("POST /api/hit unknown event -> 400; bot -> 204 no write", async () => {
  const e = env();
  assert.equal((await call("/api/hit", { body: { e: "nope" } }, e)).status, 400);
  const res = await call("/api/hit", { body: { e: "view", p: "/" }, ua: "Googlebot/2.1" }, e);
  assert.equal(res.status, 204);
  assert.equal(e.DB._tables.hits.length, 0);
});

test("POST /api/hit without IP_SALT -> ip_hash is empty string", async () => {
  const e = env(); delete e.IP_SALT;
  await call("/api/hit", { body: { e: "view", p: "/", vid: VID, sid: SID }, cf: { country: "CN" } }, e);
  assert.equal(e.DB._tables.hits[0].ip_hash, "");
});

test("POST /api/hit accepts new /join/ /privacy/ /terms/ paths", async () => {
  const e = env();
  for (const p of ["/join/", "/join/index.html", "/privacy", "/terms/"]) {
    await call("/api/hit", { body: { e: "view", p, vid: VID, sid: SID } }, e);
  }
  assert.deepEqual(e.DB._tables.hits.map((r) => r.path), ["/join/", "/join/", "/privacy/", "/terms/"]);
});

// ===========================================================================
// /api/calc
// ===========================================================================
test("POST /api/calc valid -> 204 with cleaned inputs/result", async () => {
  const e = env();
  const res = await call("/api/calc", {
    body: {
      tool: "fi", lang: "zh", vid: VID, sid: SID,
      inputs: { age: 40, spend: 50000, name: "x".repeat(80), ok: true, bad_key: { a: 1 } },
      result: [["目标资产", "1,000,000"], ["缺口", "500,000"], "junk", ["a".repeat(60), "v"]],
    },
    cf: { country: "CN" },
  }, e);
  assert.equal(res.status, 204);
  const row = e.DB._tables.calcs[0];
  assert.equal(row.tool, "fi");
  const inp = JSON.parse(row.inputs);
  assert.equal(inp.age, 40);
  assert.equal(inp.ok, true);
  assert.equal(inp.name, undefined, "string >60 chars dropped");
  assert.equal(inp.bad_key, undefined, "object value dropped");
  const out = JSON.parse(row.result);
  assert.equal(out.length, 2, "junk + oversize label dropped");
});

test("POST /api/calc missing vid/sid or bad tool -> 204 but nothing written", async () => {
  const e = env();
  assert.equal((await call("/api/calc", { body: { tool: "fi", lang: "zh", vid: "", sid: SID } }, e)).status, 204);
  assert.equal((await call("/api/calc", { body: { tool: "hack", lang: "zh", vid: VID, sid: SID } }, e)).status, 204);
  assert.equal(e.DB._tables.calcs.length, 0);
});

test("POST /api/calc inputs over 40 keys are trimmed", async () => {
  const e = env();
  const inputs = {}; for (let i = 0; i < 60; i++) inputs["k" + i] = i;
  await call("/api/calc", { body: { tool: "fi", lang: "en", vid: VID, sid: SID, inputs, result: [] } }, e);
  assert.equal(Object.keys(JSON.parse(e.DB._tables.calcs[0].inputs)).length, 40);
});

test("POST /api/calc body > 8192 bytes -> 413", async () => {
  const e = env();
  const res = await call("/api/calc", { body: { tool: "fi", lang: "en", vid: VID, sid: SID, pad: "z".repeat(9000) } }, e);
  assert.equal(res.status, 413);
});

// ===========================================================================
// /api/profile
// ===========================================================================
test("POST /api/profile upserts and drops illegal values", async () => {
  const e = env();
  let res = await call("/api/profile", {
    body: { vid: VID, lang: "zh", age_band: "40-49", asset_band: "HACK", goal: "fi", markets: ["us", "cn", "nope"], follows: "clec,satoshi", leverage_exp: "options" },
  }, e);
  assert.equal(res.status, 204);
  let p = e.DB._tables.profiles[0];
  assert.equal(p.age_band, "40-49");
  // An illegal enum must be DROPPED, not written as NULL: every one of these
  // columns is NOT NULL in the real schema, and the previous expectation here
  // (`=== null`, described as "stored as NULL/empty") is exactly what made the
  // production 500 invisible. Dropped means "kept empty", never SQL NULL.
  assert.equal(p.asset_band, "", "illegal enum dropped (column stays an empty string, never NULL)");
  assert.notEqual(p.asset_band, null, "a dropped enum must never reach the column as NULL");
  assert.equal(p.markets, "us,cn", "illegal market dropped, order normalised");
  assert.equal(p.follows, "clec,satoshi");
  const createdTs = p.created_ts;

  // second call: only update goal; other fields preserved
  res = await call("/api/profile", { body: { vid: VID, lang: "en", goal: "retire" } }, e);
  assert.equal(res.status, 204);
  p = e.DB._tables.profiles[0];
  assert.equal(p.goal, "retire");
  assert.equal(p.age_band, "40-49", "existing field preserved");
  assert.equal(p.created_ts, createdTs, "created_ts preserved");
});

test("POST /api/profile with an out-of-whitelist enum still writes every NOT NULL column", async () => {
  // Regression for the 500: a client sending a value outside the whitelist used
  // to store SQL NULL and trip `NOT NULL constraint failed: profiles.age_band`.
  // Invalid input must be ignored, and the request must still succeed.
  const e = env();
  const res = await call("/api/profile", {
    body: {
      vid: VID, lang: "en",
      age_band: "35-44",       // not in AGE_BANDS (<30,30-39,40-49,50-59,60+)
      asset_band: "100k-500k", // not in ASSET_BANDS (<100k,100k-300k,300k-1m,1m-3m,3m+)
      goal: "retire",
      leverage_exp: "bogus",
    },
  }, e);
  assert.equal(res.status, 204, "an unrecognised enum must be ignored, not fatal");
  const p = e.DB._tables.profiles[0];
  assert.ok(p, "the row is still written");
  for (const col of ["age_band", "asset_band", "goal", "markets", "follows", "leverage_exp", "country", "lang"]) {
    assert.notEqual(p[col], null, `${col} must not be NULL (NOT NULL column)`);
    assert.notEqual(p[col], undefined, `${col} must be bound`);
  }
  assert.equal(p.age_band, "", "rejected age_band falls back to its default");
  assert.equal(p.asset_band, "", "rejected asset_band falls back to its default");
  assert.equal(p.goal, "retire", "the valid field in the same request is still applied");
  assert.equal(p.leverage_exp, "", "rejected leverage_exp falls back to its default");
});

test("POST /api/profile keeps the previously stored value when a later enum is invalid", async () => {
  const e = env();
  await call("/api/profile", { body: { vid: VID, lang: "en", age_band: "40-49" } }, e);
  assert.equal(e.DB._tables.profiles[0].age_band, "40-49");
  // A bad value on the next call must not blank out what we already knew.
  const res = await call("/api/profile", { body: { vid: VID, lang: "en", age_band: "nonsense" } }, e);
  assert.equal(res.status, 204);
  assert.equal(e.DB._tables.profiles[0].age_band, "40-49", "invalid update leaves the stored value intact");
});

test("POST /api/profile without/invalid vid -> 400", async () => {
  assert.equal((await call("/api/profile", { body: { lang: "zh", goal: "fi" } })).status, 400);
  assert.equal((await call("/api/profile", { body: { vid: "nope", lang: "zh" } })).status, 400);
});

// ===========================================================================
// /api/feedback
// ===========================================================================
test("POST /api/feedback valid -> 204 stored", async () => {
  const e = env();
  const res = await call("/api/feedback", {
    body: { tool: "fi", lang: "zh", vid: VID, rating: 5, message: "  很有用  ", contact: "wx: abc", wtp: "pdf_report,multi_plans", t: 3000 },
  }, e);
  assert.equal(res.status, 204);
  const f = e.DB._tables.feedback[0];
  assert.equal(f.message, "很有用", "trimmed");
  assert.equal(f.rating, 5);
  assert.equal(f.wtp, "multi_plans,pdf_report", "normalised to whitelist order");
});

test("POST /api/feedback honeypot filled -> silent 204, NOT written", async () => {
  const e = env();
  const res = await call("/api/feedback", { body: { tool: "fi", lang: "zh", message: "hi there", website: "http://spam", t: 5000 } }, e);
  assert.equal(res.status, 204);
  assert.equal(e.DB._tables.feedback.length, 0);
});

test("POST /api/feedback form time <1500ms -> silent 204, NOT written", async () => {
  const e = env();
  const res = await call("/api/feedback", { body: { tool: "fi", lang: "zh", message: "hi there", t: 800 } }, e);
  assert.equal(res.status, 204);
  assert.equal(e.DB._tables.feedback.length, 0);
  // missing t likewise
  assert.equal((await call("/api/feedback", { body: { tool: "fi", lang: "zh", message: "hi there" } }, e)).status, 204);
  assert.equal(e.DB._tables.feedback.length, 0);
});

test("POST /api/feedback message too short -> 400", async () => {
  const res = await call("/api/feedback", { body: { tool: "fi", lang: "zh", message: "hi", t: 3000 } });
  assert.equal(res.status, 400);
});

// ===========================================================================
// /api/subscribe  (BREVO_API_KEY unset)
// ===========================================================================
test("POST /api/subscribe without BREVO_API_KEY -> 503 mail_not_configured", async () => {
  const e = env();
  const res = await call("/api/subscribe", { body: { email: "a@b.com", lang: "zh", source: "fi", t: 3000 } }, e);
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "mail_not_configured" });
});

test("POST /api/subscribe invalid email -> 400", async () => {
  const e = env(); e.BREVO_API_KEY = "xkeysib-test";
  for (const bad of ["nope", "a@b", "a b@c.com", "a@@b.com"]) {
    assert.equal((await call("/api/subscribe", { body: { email: bad, lang: "zh", source: "fi", t: 3000 } }, e)).status, 400, bad);
  }
  assert.equal(e.DB._tables.subscribers.length, 0);
});

test("POST /api/subscribe honeypot / short time -> silent 204, no mail, no row", async () => {
  const e = env(); e.BREVO_API_KEY = "xkeysib-test";
  assert.equal((await call("/api/subscribe", { body: { email: "a@b.com", lang: "zh", source: "fi", website: "x", t: 5000 } }, e)).status, 204);
  assert.equal((await call("/api/subscribe", { body: { email: "a@b.com", lang: "zh", source: "fi", t: 100 } }, e)).status, 204);
  assert.equal(e.DB._tables.subscribers.length, 0);
  assert.equal(mailCalls.length, 0);
});

test("POST /api/subscribe valid -> 204, pending row, Brevo called with unsubscribe header", async () => {
  const e = env(); e.BREVO_API_KEY = "xkeysib-test";
  const res = await call("/api/subscribe", { body: { email: "User@Example.COM", lang: "zh", source: "fi", vid: VID, t: 3000 } }, e);
  assert.equal(res.status, 204);
  const row = e.DB._tables.subscribers[0];
  assert.equal(row.email, "user@example.com", "lowercased");
  assert.equal(row.status, "pending");
  assert.equal(row.vid, VID, "vid linked");
  assert.equal(row.token.length, 64, "32-byte hex token");
  assert.equal(mailCalls.length, 1);
  const sent = JSON.parse(mailCalls[0].init.body);
  assert.equal(sent.to[0].email, "user@example.com");
  assert.ok(sent.htmlContent.includes("/api/confirm?t=" + row.token));
});

test("POST /api/subscribe again within 10 min -> 204, no second mail", async () => {
  const e = env(); e.BREVO_API_KEY = "xkeysib-test";
  await call("/api/subscribe", { body: { email: "a@b.com", lang: "zh", source: "fi", t: 3000 } }, e);
  assert.equal(mailCalls.length, 1);
  const res = await call("/api/subscribe", { body: { email: "a@b.com", lang: "zh", source: "fi", t: 3000 } }, e);
  assert.equal(res.status, 204);
  assert.equal(mailCalls.length, 1, "no duplicate confirmation email");
});

test("POST /api/subscribe when already confirmed -> 204, no mail, no leak", async () => {
  const e = env(); e.BREVO_API_KEY = "xkeysib-test";
  await call("/api/subscribe", { body: { email: "a@b.com", lang: "zh", source: "fi", t: 3000 } }, e);
  const token = e.DB._tables.subscribers[0].token;
  await call("/api/confirm?t=" + token, { method: "GET" }, e);
  mailCalls = [];
  const res = await call("/api/subscribe", { body: { email: "a@b.com", lang: "zh", source: "fi", t: 3000 } }, e);
  assert.equal(res.status, 204);
  assert.equal(mailCalls.length, 0);
});

test("POST /api/subscribe over daily cap (150) -> 204, pending recorded, no mail", async () => {
  const e = env(); e.BREVO_API_KEY = "xkeysib-test";
  const dayStart = Math.floor(Date.now() / 1000) - (new Date().getUTCHours() * 3600);
  for (let i = 0; i < 150; i++) {
    e.DB._tables.subscribers.push({
      email: "f" + i + "@x.com", vid: "", lang: "en", source: "fi", status: "pending",
      token: "t" + i, created_ts: dayStart + i, confirmed_ts: null, last_confirm_sent_ts: dayStart + i, last_sent_year: null,
    });
  }
  mailCalls = [];
  const res = await call("/api/subscribe", { body: { email: "new@x.com", lang: "en", source: "fi", t: 3000 } }, e);
  assert.equal(res.status, 204);
  assert.equal(mailCalls.length, 0, "no mail sent past daily cap");
  const rec = e.DB._tables.subscribers.find((r) => r.email === "new@x.com");
  assert.ok(rec, "pending row still recorded");
  assert.equal(rec.status, "pending");
});

// ===========================================================================
// /api/confirm + /api/unsubscribe
// ===========================================================================
test("GET /api/confirm valid token -> 302 ?ok=1 & status confirmed", async () => {
  const e = env(); e.BREVO_API_KEY = "xkeysib-test";
  await call("/api/subscribe", { body: { email: "a@b.com", lang: "zh", source: "fi", t: 3000 } }, e);
  const t = e.DB._tables.subscribers[0].token;
  const res = await call("/api/confirm?t=" + t, { method: "GET" }, e);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), "/planner/subscribed/?ok=1");
  assert.equal(e.DB._tables.subscribers[0].status, "confirmed");
  assert.ok(e.DB._tables.subscribers[0].confirmed_ts > 0);
});

test("GET /api/confirm invalid token -> 302 ?ok=0", async () => {
  const res = await call("/api/confirm?t=deadbeef", { method: "GET" });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), "/planner/subscribed/?ok=0");
});

test("GET /api/unsubscribe -> 302 ?unsub=1 & status unsubscribed", async () => {
  const e = env(); e.BREVO_API_KEY = "xkeysib-test";
  await call("/api/subscribe", { body: { email: "a@b.com", lang: "zh", source: "fi", t: 3000 } }, e);
  const t = e.DB._tables.subscribers[0].token;
  await call("/api/confirm?t=" + t, { method: "GET" }, e);
  const res = await call("/api/unsubscribe?t=" + t, { method: "GET" }, e);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), "/planner/subscribed/?unsub=1");
  assert.equal(e.DB._tables.subscribers[0].status, "unsubscribed");
});

// ===========================================================================
// admin
// ===========================================================================
test("admin endpoints without token -> 401", async () => {
  for (const p of ["/api/stats", "/api/admin/subscribers", "/api/admin/export?table=calcs", "/api/admin/delete"]) {
    const res = await call(p, { method: p.includes("export") || p.includes("stats") || p.includes("subscribers") ? "GET" : "POST", body: p.includes("delete") ? {} : undefined });
    assert.equal(res.status, 401, p);
  }
  const res = await call("/api/admin/delete", { body: { vid: VID }, headers: { Authorization: "Bearer wrong" } });
  assert.equal(res.status, 401);
});

test("GET /api/admin/subscribers masks emails and counts statuses", async () => {
  const e = env(); e.BREVO_API_KEY = "xkeysib-test";
  await call("/api/subscribe", { body: { email: "alice@example.com", lang: "zh", source: "fi", t: 3000 } }, e);
  await call("/api/subscribe", { body: { email: "bob@example.com", lang: "en", source: "margin", t: 3000 } }, e);
  const t = e.DB._tables.subscribers[0].token;
  await call("/api/confirm?t=" + t, { method: "GET" }, e);

  const res = await call("/api/admin/subscribers", { method: "GET", headers: { Authorization: "Bearer " + STATS_TOKEN } }, e);
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.counts.confirmed, 1);
  assert.equal(j.counts.pending, 1);
  assert.equal(j.recent.length, 2);
  assert.ok(j.recent.every((r) => /^\w\*\*\*@/.test(r.email)), "emails masked");
  assert.ok(!JSON.stringify(j).includes("alice@example.com"), "no raw email leaked");
});

test("GET /api/admin/export CSV escapes commas / quotes / newlines", async () => {
  const e = env();
  e.DB._tables.feedback.push({
    id: 1, ts: Math.floor(Date.now() / 1000), tool: "fi", lang: "zh", vid: "",
    rating: 5, message: 'He said "buy, low"\nand hold', contact: "", wtp: "", country: "CN",
  });
  const res = await call("/api/admin/export?table=feedback&days=90", { method: "GET", headers: { Authorization: "Bearer " + STATS_TOKEN } }, e);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /text\/csv/);
  const text = await res.text();
  assert.ok(text.includes('"He said ""buy, low""\nand hold"'), "quotes doubled and field wrapped");
});

test("GET /api/admin/export unknown table -> 400", async () => {
  const res = await call("/api/admin/export?table=users", { method: "GET", headers: { Authorization: "Bearer " + STATS_TOKEN } });
  assert.equal(res.status, 400);
});

test("POST /api/admin/delete cascades and reports per-table counts", async () => {
  const e = env(); e.BREVO_API_KEY = "xkeysib-test";
  await call("/api/hit", { body: { e: "view", p: "/planner/fi/", vid: VID, sid: SID } }, e);
  await call("/api/calc", { body: { tool: "fi", lang: "zh", vid: VID, sid: SID, inputs: { a: 1 }, result: [["l", "v"]] } }, e);
  await call("/api/profile", { body: { vid: VID, lang: "zh", goal: "fi" } }, e);
  await call("/api/feedback", { body: { tool: "fi", lang: "zh", vid: VID, message: "great tool", t: 3000 } }, e);
  await call("/api/subscribe", { body: { email: "a@b.com", lang: "zh", source: "fi", vid: VID, t: 3000 } }, e);

  const res = await call("/api/admin/delete", { body: { vid: VID }, headers: { Authorization: "Bearer " + STATS_TOKEN } }, e);
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.hits, 1);
  assert.equal(j.calcs, 1);
  assert.equal(j.profiles, 1);
  assert.equal(j.feedback, 1);
  assert.equal(j.subscribers, 1);
  assert.equal(e.DB._tables.hits.length, 0);
  assert.equal(e.DB._tables.calcs.length, 0);
  assert.equal(e.DB._tables.subscribers.length, 0);
});

// ===========================================================================
// /api/stats
// ===========================================================================
test("GET /api/stats without token -> 401", async () => {
  assert.equal((await call("/api/stats", { method: "GET" })).status, 401);
});

test("GET /api/stats returns the extended block set", async () => {
  const e = env();
  await call("/api/hit", { body: { e: "view", p: "/planner/fi/", vid: VID, sid: SID, vw: 390, us: "wechat" }, cf: { country: "CN" } }, e);
  await call("/api/hit", { body: { e: "leave", p: "/planner/fi/", vid: VID, sid: SID, d: 30000, sc: 75 } }, e);
  await call("/api/calc", { body: { tool: "fi", lang: "zh", vid: VID, sid: SID, inputs: { age: 40, spend: 50000 }, result: [["a", "b"]] } }, e);
  await call("/api/profile", { body: { vid: VID, lang: "zh", age_band: "40-49", follows: "clec" } }, e);

  const res = await call("/api/stats?days=30", { method: "GET", headers: { Authorization: "Bearer " + STATS_TOKEN } }, e);
  assert.equal(res.status, 200);
  const j = await res.json();
  for (const k of ["uniques", "sessions", "newVsReturning", "cohorts", "engagement", "devices", "os", "browsers", "wechat", "utm", "campaigns", "calcs", "profiles", "wtp", "subscribers", "feedback", "events", "retention", "summary", "referrers"]) {
    assert.ok(k in j, "missing stats block: " + k);
  }
  assert.equal(j.uniques.vids, 1);
  assert.equal(j.sessions, 1);
  assert.equal(j.calcs.byTool[0].tool, "fi");
  assert.equal(j.calcs.inputs.numeric.age.med, 40);
  assert.ok(j.events.view >= 1);
  assert.ok(j.events.leave >= 1);
  assert.ok("overall" in j.retention);
});

// ===========================================================================
// scheduled() — annual reminder idempotency
// ===========================================================================
test("scheduled() sends once per year and is idempotent", async () => {
  const e = env(); e.BREVO_API_KEY = "xkeysib-test";
  const year = new Date().getUTCFullYear();
  e.DB._tables.subscribers.push({
    email: "c@x.com", vid: "", lang: "zh", source: "fi", status: "confirmed",
    token: "tok1", created_ts: 1, confirmed_ts: 1, last_confirm_sent_ts: 1, last_sent_year: null,
  });
  mailCalls = [];
  await worker.scheduled({}, e, { waitUntil() {} });
  assert.equal(mailCalls.length, 1, "reminder sent");
  assert.equal(e.DB._tables.subscribers[0].last_sent_year, year);

  mailCalls = [];
  await worker.scheduled({}, e, { waitUntil() {} });
  assert.equal(mailCalls.length, 0, "second run does not resend in the same year");
});

test("sendReminder?dry=1 reports count without sending", async () => {
  const e = env(); e.BREVO_API_KEY = "xkeysib-test";
  e.DB._tables.subscribers.push({
    email: "c@x.com", vid: "", lang: "zh", source: "fi", status: "confirmed",
    token: "tok1", created_ts: 1, confirmed_ts: 1, last_confirm_sent_ts: 1, last_sent_year: null,
  });
  mailCalls = [];
  const res = await call("/api/admin/send-reminder?dry=1", { headers: { Authorization: "Bearer " + STATS_TOKEN } }, e);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).count, 1);
  assert.equal(mailCalls.length, 0, "dry run sends nothing");
});

// ===========================================================================
// anti-abuse: rate limiting (spec 3.3 ④) + List-Unsubscribe (spec 3.4)
// ===========================================================================
test("rate limit: the 6th request from one client within a minute -> 429", async () => {
  const e = env(); e.BREVO_API_KEY = "xkeysib-test";
  const SAME_IP = "198.51.100.42";
  const codes = [];
  for (let i = 0; i < 6; i++) {
    const res = await call("/api/subscribe", { body: { email: "rate" + i + "@x.com", lang: "en", source: "fi", t: 3000 }, ip: SAME_IP }, e);
    codes.push(res.status);
  }
  assert.deepEqual(codes.slice(0, 5), [204, 204, 204, 204, 204], "first five pass");
  assert.equal(codes[5], 429, "sixth is throttled");
});

test("List-Unsubscribe header is present on confirmation email (RFC 8058)", async () => {
  const e = env(); e.BREVO_API_KEY = "xkeysib-test";
  await call("/api/subscribe", { body: { email: "hdr@x.com", lang: "en", source: "fi", t: 3000 } }, e);
  const sent = JSON.parse(mailCalls[0].init.body);
  assert.ok(sent.headers, "headers object present");
  assert.match(sent.headers["List-Unsubscribe"], /^<https:\/\/www\.alpha-wealth-lab\.com\/api\/unsubscribe\?t=[0-9a-f]{64}>$/);
  assert.equal(sent.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

test("reminder email links to /planner/rebalance/?from=email and carries an unsubscribe link", async () => {
  const e = env(); e.BREVO_API_KEY = "xkeysib-test";
  e.DB._tables.subscribers.push({
    email: "rem@x.com", vid: "", lang: "en", source: "fi", status: "confirmed",
    token: "a".repeat(64), created_ts: 1, confirmed_ts: 1, last_confirm_sent_ts: 1, last_sent_year: null,
  });
  mailCalls = [];
  await worker.scheduled({}, e, { waitUntil() {} });
  const sent = JSON.parse(mailCalls[0].init.body);
  assert.ok(sent.htmlContent.includes("/planner/rebalance/?from=email"), "reminder deep-links to rebalance");
  assert.ok(sent.htmlContent.includes("/api/unsubscribe?t=" + "a".repeat(64)), "unsubscribe link present");
  assert.match(sent.headers["List-Unsubscribe"], /api\/unsubscribe/);
});

// ===========================================================================
// misc: unknown route + method guard
// ===========================================================================
test("unknown route -> 404; wrong method -> 405", async () => {
  assert.equal((await call("/api/nope", { method: "GET" })).status, 404);
  assert.equal((await call("/api/hit", { method: "GET" })).status, 405);
  assert.equal((await call("/api/stats", { method: "POST" })).status, 405, "method guard runs before auth");
});

test("GET /api/admin/export has UTF-8 BOM, attachment filename, and no subscriber tokens", async () => {
  const e = env();
  e.DB._tables.feedback.push({
    id: 2, ts: Math.floor(Date.now() / 1000), tool: "fi", lang: "zh", vid: "",
    rating: 4, message: '=HYPERLINK("http://x")', contact: "", wtp: "", country: "CN",
  });
  const res = await call("/api/admin/export?table=feedback&days=90", { method: "GET", headers: { Authorization: "Bearer " + STATS_TOKEN } }, e);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-disposition") || "", /attachment; filename="feedback-\d{4}-\d{2}-\d{2}\.csv"/);
  // Response.text() strips a leading BOM, so check the raw bytes.
  const bytes = new Uint8Array(await res.clone().arrayBuffer());
  assert.deepEqual([bytes[0], bytes[1], bytes[2]], [0xef, 0xbb, 0xbf], "starts with UTF-8 BOM");
  const text = await res.text();
  assert.ok(text.includes("'=HYPERLINK"), "formula neutralised");
  const sub = await call("/api/admin/export?table=subscribers&days=90", { method: "GET", headers: { Authorization: "Bearer " + STATS_TOKEN } }, env());
  assert.ok(!(await sub.text()).split("\r\n")[0].split(",").includes("token"), "no token column");
});

// ---------------------------------------------------------------------------
// /api/join + /api/admin/join + daily QR-expiry cron
// ---------------------------------------------------------------------------
const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const ADMIN = { Authorization: "Bearer " + STATS_TOKEN };
const dayPlus = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const setQr = (e, body) => call("/api/admin/join", { method: "POST", headers: ADMIN, body }, e);

test("GET /api/join with nothing configured -> no group, short public cache", async () => {
  const res = await call("/api/join", { method: "GET" });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("cache-control") || "", /public, max-age=60/);
  assert.deepEqual(await res.json(), { group: null, expired: false });
});

test("POST /api/admin/join requires the admin token", async () => {
  const e = env();
  const none = await call("/api/admin/join", { method: "POST", body: { img: PNG_1PX, expires: dayPlus(3) } }, e);
  assert.equal(none.status, 401);
  const bad = await call("/api/admin/join", { method: "POST", headers: { Authorization: "Bearer nope" }, body: { img: PNG_1PX, expires: dayPlus(3) } }, e);
  assert.equal(bad.status, 401);
  assert.equal(e.DB._tables.site_config.length, 0, "nothing written without auth");
});

test("set a QR -> public GET returns it until it expires", async () => {
  const e = env();
  const ok = await setQr(e, { img: PNG_1PX, expires: dayPlus(5), name: "Global Investors" });
  assert.equal(ok.status, 200);
  const j = await (await call("/api/join", { method: "GET" }, e)).json();
  assert.ok(j.group && j.group.img.startsWith("data:image/png;base64,"), "stored as a png data URL");
  assert.equal(j.group.expires, dayPlus(5));
  assert.equal(j.group.name, "Global Investors");
  assert.equal(j.expired, false);
  // a data URL is accepted too
  const ok2 = await setQr(e, { img: "data:image/png;base64," + PNG_1PX, expires: dayPlus(6) });
  assert.equal(ok2.status, 200);
  assert.equal(e.DB._tables.site_config.filter((r) => r.key === "join_group").length, 1, "one row, replaced not duplicated");
});

test("an expired QR is never served; the page is told it expired", async () => {
  const e = env();
  e.DB._tables.site_config.push({ key: "join_group", value: JSON.stringify({ img: "data:image/png;base64," + PNG_1PX, expires: "2020-01-01", name: "" }), updated_ts: 1 });
  const j = await (await call("/api/join", { method: "GET" }, e)).json();
  assert.deepEqual(j, { group: null, expired: true });
});

test("admin/join rejects bad input", async () => {
  const e = env();
  const gif = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  assert.equal((await setQr(e, { img: gif, expires: dayPlus(3) })).status, 400, "GIF is not allowed");
  assert.equal((await setQr(e, { img: Buffer.from("hello world, not an image").toString("base64"), expires: dayPlus(3) })).status, 400, "wrong signature");
  assert.equal((await setQr(e, { img: "data:text/html;base64,PGI+", expires: dayPlus(3) })).status, 400, "html data URL");
  assert.equal((await setQr(e, { img: "not base64 !!", expires: dayPlus(3) })).status, 400);
  assert.equal((await setQr(e, { img: PNG_1PX, expires: "2020-01-01" })).status, 400, "already expired");
  assert.equal((await setQr(e, { img: PNG_1PX, expires: dayPlus(90) })).status, 400, "too far ahead");
  assert.equal((await setQr(e, { img: PNG_1PX, expires: "2026-02-31" })).status, 400, "impossible date");
  assert.equal((await setQr(e, { img: PNG_1PX })).status, 400, "missing date");
  const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(420 * 1024, 1)]).toString("base64");
  assert.equal((await setQr(e, { img: big, expires: dayPlus(3) })).status, 413, "over 400 KB");
  assert.equal(e.DB._tables.site_config.length, 0, "no bad input was stored");
});

test("admin/join {clear:true} removes the QR", async () => {
  const e = env();
  await setQr(e, { img: PNG_1PX, expires: dayPlus(4) });
  const r = await setQr(e, { clear: true });
  assert.equal(r.status, 200);
  assert.deepEqual(await (await call("/api/join", { method: "GET" }, e)).json(), { group: null, expired: false });
});

test("daily cron mails the owner once when the QR is about to expire", async () => {
  const e = env(); e.BREVO_API_KEY = "test-key";
  await setQr(e, { img: PNG_1PX, expires: dayPlus(1) });
  await worker.scheduled({ cron: "0 13 * * *" }, e, { waitUntil() {} });
  assert.equal(mailCalls.length, 1, "one mail");
  const sent = JSON.parse(mailCalls[0].init.body);
  assert.equal(sent.to[0].email, "alphawealthlab@outlook.com");
  assert.match(sent.subject, /二维码/);
  await worker.scheduled({ cron: "0 13 * * *" }, e, { waitUntil() {} });
  assert.equal(mailCalls.length, 1, "not repeated for the same QR");
  // a new QR re-arms the reminder
  await setQr(e, { img: PNG_1PX, expires: dayPlus(2) });
  await worker.scheduled({ cron: "0 13 * * *" }, e, { waitUntil() {} });
  assert.equal(mailCalls.length, 2, "re-armed after the QR was replaced");
});

test("daily cron stays quiet when the QR is fresh, missing, or mail is not configured", async () => {
  const e = env(); e.BREVO_API_KEY = "test-key";
  await worker.scheduled({ cron: "0 13 * * *" }, e, { waitUntil() {} });
  assert.equal(mailCalls.length, 0, "no QR -> no mail");
  await setQr(e, { img: PNG_1PX, expires: dayPlus(6) });
  await worker.scheduled({ cron: "0 13 * * *" }, e, { waitUntil() {} });
  assert.equal(mailCalls.length, 0, "6 days left -> too early");
  const e2 = env(); // no BREVO_API_KEY
  await setQr(e2, { img: PNG_1PX, expires: dayPlus(1) });
  await worker.scheduled({ cron: "0 13 * * *" }, e2, { waitUntil() {} });
  assert.equal(mailCalls.length, 0, "no key -> silently skipped, no crash");
});

test("daily cron never sends the annual subscriber reminder", async () => {
  const e = env(); e.BREVO_API_KEY = "test-key";
  e.DB._tables.subscribers.push({ email: "x@example.com", vid: "", lang: "en", source: "fi", status: "confirmed", token: "t".repeat(64), created_ts: 1, confirmed_ts: 2, last_confirm_sent_ts: 1, last_sent_year: null });
  await worker.scheduled({ cron: "0 13 * * *" }, e, { waitUntil() {} });
  assert.equal(mailCalls.length, 0, "confirmed subscriber was not mailed by the daily cron");
});
