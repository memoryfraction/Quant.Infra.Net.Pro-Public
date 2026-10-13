/*
 * planner/assets/lib.js — AWLLib: pure, testable helpers for the planner pages.
 *
 * UMD: in the browser it attaches `window.AWLLib`; in Node it `module.exports`.
 * No dependencies. No DOM access except the storage objects, which are injected.
 *
 * Privacy contract (site-wide):
 *   - Nothing here ever talks to the network.
 *   - When `navigator.globalPrivacyControl === true`, getVid/getSid/visitorTag
 *     ALL return "" — no identifier is generated, stored or reported.
 *   - Raw IP and raw User-Agent are never handled on the client either; the
 *     server derives them. This module only creates random local ids.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AWLLib = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // constants (must stay in sync with the Worker's whitelists in src/lib.js)
  // ---------------------------------------------------------------------------
  var AGE_BANDS = ["<30", "30-39", "40-49", "50-59", "60+"];
  var ASSET_BANDS = ["<100k", "100k-300k", "300k-1m", "1m-3m", "3m+"];
  var GOALS = ["fi", "retire", "growth", "preserve", "learn"];
  var MARKETS = ["us", "cn", "hk", "tw", "other"];
  var FOLLOWS = ["value", "beiban", "adam_khoo", "clec", "silicon_valley", "satoshi", "other", "none"];
  var LEVERAGE = ["none", "etf", "margin", "options"];
  var WTP = ["multi_plans", "pdf_report", "yoy_compare", "more_authors", "none"];
  var CAMPAIGNS = ["card", "share", "wechat", "email", "join"];
  var VISITOR_TAGS = ["new", "d0", "d1_7", "d8_30", "d30p"];
  var AWL_EVENTS = ["calc", "share", "save", "load", "join"];

  var KEY_VID = "awl_vid";
  var KEY_SID = "awl_sid";
  var KEY_LAST = "awl_last";
  var KEY_PLANS = "awl_plans_v1";
  var KEY_NOTICE = "awl_notice";
  var KEY_PROFILE = "awl_profile_done";
  var MAX_SLUGS = 20;

  // ---------------------------------------------------------------------------
  // privacy
  // ---------------------------------------------------------------------------
  function gpcOn() {
    try { return (typeof navigator !== "undefined") && navigator.globalPrivacyControl === true; }
    catch (e) { return false; }
  }

  // ---------------------------------------------------------------------------
  // ids
  // ---------------------------------------------------------------------------
  function uuid() {
    try {
      if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) { /* fall through */ }
    try {
      var b = new Uint8Array(16);
      crypto.getRandomValues(b);
      b[6] = (b[6] & 0x0f) | 0x40;  // version 4
      b[8] = (b[8] & 0x3f) | 0x80;  // variant
      var hx = [];
      for (var i = 0; i < 16; i++) hx.push((b[i] + 0x100).toString(16).slice(1));
      return hx.slice(0, 4).join("") + "-" + hx.slice(4, 6).join("") + "-" + hx.slice(6, 8).join("") +
             "-" + hx.slice(8, 10).join("") + "-" + hx.slice(10).join("");
    } catch (e) { return ""; }
  }

  function readStore(store, key) {
    try { return store ? store.getItem(key) : null; } catch (e) { return null; }
  }
  function writeStore(store, key, val) {
    if (!store) return false;              // no storage -> nothing persisted
    try { store.setItem(key, val); return true; } catch (e) { return false; }
  }

  // Stable per-browser id. Returns "" when unavailable OR when it cannot be
  // persisted (private mode / throwing storage / quota) OR when GPC is on.
  // Never falls back to an in-memory-only id: an id the next page load cannot
  // reproduce would inflate the independent-visitor count with phantom visitors.
  function getVid(storage) {
    if (gpcOn()) return "";
    if (!storage) return "";
    var cur = readStore(storage, KEY_VID);
    if (cur && /^[a-z0-9-]{8,64}$/.test(cur)) return cur;
    var id = uuid();
    if (!id) return "";
    return writeStore(storage, KEY_VID, id) ? id : "";
  }
  // Per-tab-session id; same rules as getVid.
  function getSid(sessionStorage) {
    if (gpcOn()) return "";
    if (!sessionStorage) return "";
    var cur = readStore(sessionStorage, KEY_SID);
    if (cur && /^[a-z0-9-]{8,64}$/.test(cur)) return cur;
    var id = uuid();
    if (!id) return "";
    return writeStore(sessionStorage, KEY_SID, id) ? id : "";
  }

  function dayStartMs(ms) {
    var d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  /*
   * Visitor tag relative to the previous visit stored in `storage` (key awl_last):
   *   "new"   first visit ever
   *   "d0"    already visited today
   *   "d1_7"  1–7 days since the last visit
   *   "d8_30" 8–30 days ago
   *   "d30p"  more than 30 days ago
   * Always "" when GPC is on (no identifier may be produced or reported).
   * This function also records the current day as the new "last" day.
   */
  function visitorTag(storage, nowMs) {
    if (gpcOn()) return "";
    var now = typeof nowMs === "number" ? nowMs : Date.now();
    var today = dayStartMs(now);
    var raw = readStore(storage, KEY_LAST);
    var last = raw === null || raw === "" ? NaN : Number(raw);
    var tag;
    if (!isFinite(last)) tag = "new";
    else {
      var diff = Math.round((today - dayStartMs(last)) / 86400000);
      if (diff <= 0) tag = "d0";
      else if (diff <= 7) tag = "d1_7";
      else if (diff <= 30) tag = "d8_30";
      else tag = "d30p";
    }
    writeStore(storage, KEY_LAST, String(today));
    return tag;
  }

  // ---------------------------------------------------------------------------
  // query parsing (utm / campaign)
  // ---------------------------------------------------------------------------
  function cleanToken(s, max) {
    s = String(s == null ? "" : s);
    if (s.length > max) return "";
    return /^[A-Za-z0-9_.-]*$/.test(s) ? s : "";
  }
  // Accepts a search string ("?a=1&b=2") or a URLSearchParams.
  function toParams(search) {
    try {
      if (search && typeof search.get === "function") return search;
      return new URLSearchParams(String(search || "").replace(/^\?/, ""));
    } catch (e) { return new URLSearchParams(""); }
  }
  function utm(search) {
    var p = toParams(search);
    return {
      us: cleanToken(p.get("utm_source"), 40),
      um: cleanToken(p.get("utm_medium"), 40),
      uc: cleanToken(p.get("utm_campaign"), 40)
    };
  }
  function campaign(search) {
    var from = String(toParams(search).get("from") || "").toLowerCase();
    return CAMPAIGNS.indexOf(from) >= 0 ? from : "";
  }

  // ---------------------------------------------------------------------------
  // band helpers (same value sets as the Worker's profile whitelist)
  // ---------------------------------------------------------------------------
  function ageBand(age) {
    var n = Number(age);
    if (!isFinite(n) || n < 0) return "";
    if (n < 30) return "<30";
    if (n < 40) return "30-39";
    if (n < 50) return "40-49";
    if (n < 60) return "50-59";
    return "60+";
  }
  function moneyBand(x) {
    var n = Number(x);
    if (!isFinite(n) || n < 0) return "";
    if (n < 100000) return "<100k";
    if (n < 300000) return "100k-300k";
    if (n < 1000000) return "300k-1m";
    if (n < 3000000) return "1m-3m";
    return "3m+";
  }
  // pctBand takes a decimal (0.043) or a percentage (4.3) depending on `isPct`.
  function pctBand(x, isPct) {
    var n = Number(x);
    if (!isFinite(n)) return "";
    var v = isPct ? n : n * 100;
    if (v < 0) return "";
    if (v < 2) return "<2%";
    if (v < 4) return "2-4%";
    if (v < 6) return "4-6%";
    if (v < 8) return "6-8%";
    return "8%+";
  }

  // ---------------------------------------------------------------------------
  // state encode / decode (share links)
  // ---------------------------------------------------------------------------
  function b64urlEncode(str) {
    var b64;
    if (typeof Buffer !== "undefined" && Buffer.from) b64 = Buffer.from(str, "utf8").toString("base64");
    else if (typeof btoa !== "undefined") b64 = btoa(unescape(encodeURIComponent(str)));
    else return "";
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(s) {
    var b64 = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    try {
      if (typeof Buffer !== "undefined" && Buffer.from) return Buffer.from(b64, "base64").toString("utf8");
      if (typeof atob !== "undefined") return decodeURIComponent(escape(atob(b64)));
    } catch (e) { return null; }
    return null;
  }

  /*
   * encodeState(obj) -> base64url(JSON). Only the keys present in obj are kept;
   * the caller decides which fields matter by passing a plain object of values.
   */
  function encodeState(obj) {
    try {
      if (!obj || typeof obj !== "object") return "";
      var out = {};
      var keys = Object.keys(obj).sort();
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i], v = obj[k];
        if (v === "" || v === null || v === undefined) continue;
        if (typeof v === "number") { if (!isFinite(v)) continue; out[k] = v; }
        else if (typeof v === "boolean") out[k] = v;
        else if (typeof v === "string") { if (v.length > 200) v = v.slice(0, 200); out[k] = v; }
      }
      return b64urlEncode(JSON.stringify(out));
    } catch (e) { return ""; }
  }

  /*
   * decodeState(str, fields) -> partial value object, always safe to merge.
   * `fields` is the page's own field descriptor list:
   *   { id, type: "num"|"pct"|"chk"|"sel"|"text", opts?: [[value, label]] }
   * Any malformed input, unknown id, non-finite number, non-boolean chk,
   * out-of-options sel or over-long text is DROPPED (never thrown).
   * Returns {} on any error.
   */
  function decodeState(str, fields) {
    var out = {};
    try {
      if (!str || !fields) return out;
      var json = b64urlDecode(str);
      if (!json) return out;
      var obj = JSON.parse(json);
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i];
        if (!f || !f.id) continue;
        if (!Object.prototype.hasOwnProperty.call(obj, f.id)) continue;
        var v = obj[f.id];
        if (f.type === "chk") { if (typeof v === "boolean") out[f.id] = v; continue; }
        if (f.type === "sel") {
          var ok = false;
          if (f.opts) for (var j = 0; j < f.opts.length; j++) if (String(f.opts[j][0]) === String(v)) { ok = true; break; }
          if (ok) out[f.id] = String(v);
          continue;
        }
        if (f.type === "text") { if (typeof v === "string" && v.length <= 200) out[f.id] = v; continue; }
        // num / pct
        var n = typeof v === "number" ? v : Number(v);
        if (typeof v !== "boolean" && isFinite(n)) out[f.id] = n;
      }
      return out;
    } catch (e) { return {}; }
  }

  // ---------------------------------------------------------------------------
  // local plans ("my plan", no account)
  // ---------------------------------------------------------------------------
  function readPlans(storage) {
    var raw = readStore(storage, KEY_PLANS);
    if (!raw) return {};
    try {
      var o = JSON.parse(raw);
      return (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
    } catch (e) { return {}; }
  }
  function writePlans(storage, plans) {
    return writeStore(storage, KEY_PLANS, JSON.stringify(plans));
  }

  /*
   * planStore(storage) -> { get, put, remove }
   * plan = { s, ts, lang, rows: [[label, value]] }
   * One entry per slug (latest wins); at most MAX_SLUGS slugs, oldest evicted.
   * Every storage error is swallowed (private mode, quota, disabled storage).
   * When GPC is on, saving is still allowed locally (it never leaves the device).
   */
  function planStore(storage) {
    return {
      get: function (slug) {
        if (!slug) return null;
        var plans = readPlans(storage);
        var p = plans[slug];
        return (p && typeof p === "object") ? p : null;
      },
      put: function (slug, plan) {
        if (!slug || !plan || typeof plan !== "object") return false;
        var plans = readPlans(storage);
        plans[slug] = {
          s: String(plan.s == null ? "" : plan.s),
          ts: isFinite(Number(plan.ts)) ? Number(plan.ts) : Date.now(),
          lang: plan.lang === "zh" ? "zh" : "en",
          rows: Array.isArray(plan.rows) ? plan.rows.slice(0, 8) : []
        };
        var slugs = Object.keys(plans);
        if (slugs.length > MAX_SLUGS) {
          slugs.sort(function (a, b) { return (plans[a].ts || 0) - (plans[b].ts || 0); });
          for (var i = 0; i < slugs.length - MAX_SLUGS; i++) delete plans[slugs[i]];
        }
        return writePlans(storage, plans);
      },
      remove: function (slug) {
        if (!slug) return false;
        var plans = readPlans(storage);
        if (Object.prototype.hasOwnProperty.call(plans, slug)) delete plans[slug];
        return writePlans(storage, plans);
      }
    };
  }

  /*
   * comparePlan(oldRows, newRows) -> [{label, old, now, same}]
   * Ordered by the NEW rows first, then any row that only exists in the old set.
   */
  function comparePlan(oldRows, newRows) {
    var o = Array.isArray(oldRows) ? oldRows : [];
    var n = Array.isArray(newRows) ? newRows : [];
    var idx = {};
    for (var i = 0; i < o.length; i++) if (o[i]) idx[String(o[i][0])] = String(o[i][1] == null ? "" : o[i][1]);
    var out = [], seen = {};
    for (var j = 0; j < n.length; j++) {
      if (!n[j]) continue;
      var lab = String(n[j][0]);
      var val = String(n[j][1] == null ? "" : n[j][1]);
      var had = Object.prototype.hasOwnProperty.call(idx, lab);
      out.push({ label: lab, old: had ? idx[lab] : null, now: val, same: had && idx[lab] === val });
      seen[lab] = 1;
    }
    for (var k = 0; k < o.length; k++) {
      if (!o[k]) continue;
      var lab2 = String(o[k][0]);
      if (seen[lab2]) continue;
      out.push({ label: lab2, old: String(o[k][1] == null ? "" : o[k][1]), now: null, same: false });
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // misc small helpers
  // ---------------------------------------------------------------------------
  // "2026-10-12" / Date / ms -> localized short date; "" on bad input.
  function fmtDate(d, lang) {
    var ms = d instanceof Date ? d.getTime() : Number(d);
    if (!isFinite(ms)) return "";
    try {
      return new Date(ms).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch (e) { return ""; }
  }
  var DAY_MS = 86400000;
  // True when `thenMs` is at least `days` days before `nowMs` (used for the ~1 year hint).
  function olderThan(thenMs, days, nowMs) {
    var t = Number(thenMs), n = typeof nowMs === "number" ? nowMs : Date.now();
    if (!isFinite(t)) return false;
    return (n - t) >= days * DAY_MS;
  }
  function isSlug(s) {
    return typeof s === "string" && /^[a-z0-9-]{1,40}$/.test(s);
  }

  // ---- WeChat in-app browser: no ordinary bookmarks there, so we point at its Favorites ----
  var WX_KEY = "awl_wxfav";
  function isWeChat(ua) {
    return typeof ua === "string" && /MicroMessenger/i.test(ua);
  }
  // True when the hint should be shown: WeChat browser and not dismissed before.
  // Unusable storage -> still show (it is a harmless one-line tip) but it cannot be remembered.
  function wxFavWanted(ua, storage) {
    if (!isWeChat(ua)) return false;
    try { return !(storage && storage.getItem(WX_KEY)); } catch (e) { return true; }
  }
  function wxFavDismiss(storage) {
    try { if (storage) storage.setItem(WX_KEY, String(Date.now())); return true; } catch (e) { return false; }
  }

  return {
    // constants
    AGE_BANDS: AGE_BANDS, ASSET_BANDS: ASSET_BANDS, GOALS: GOALS, MARKETS: MARKETS,
    FOLLOWS: FOLLOWS, LEVERAGE: LEVERAGE, WTP: WTP, CAMPAIGNS: CAMPAIGNS,
    VISITOR_TAGS: VISITOR_TAGS, AWL_EVENTS: AWL_EVENTS, MAX_SLUGS: MAX_SLUGS,
    KEYS: { VID: KEY_VID, SID: KEY_SID, LAST: KEY_LAST, PLANS: KEY_PLANS, NOTICE: KEY_NOTICE, PROFILE: KEY_PROFILE },
    // privacy
    gpcOn: gpcOn,
    isWeChat: isWeChat,
    wxFavWanted: wxFavWanted,
    wxFavDismiss: wxFavDismiss,
    // ids
    getVid: getVid, getSid: getSid, visitorTag: visitorTag, uuid: uuid,
    // query
    utm: utm, campaign: campaign,
    // bands
    ageBand: ageBand, moneyBand: moneyBand, pctBand: pctBand,
    // state
    encodeState: encodeState, decodeState: decodeState,
    b64urlEncode: b64urlEncode, b64urlDecode: b64urlDecode,
    // plans
    planStore: planStore, comparePlan: comparePlan,
    readPlans: readPlans,
    // misc
    fmtDate: fmtDate, olderThan: olderThan, isSlug: isSlug, cleanToken: cleanToken
  };
});
