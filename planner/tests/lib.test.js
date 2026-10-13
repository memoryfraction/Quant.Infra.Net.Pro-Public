// planner/tests/lib.test.js — tests for planner/assets/lib.js (AWLLib).
const L = require("../assets/lib.js");

// ---- test doubles -----------------------------------------------------------
function makeStorage() {
  const m = new Map();
  return {
    _m: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}
// Throws on every write — simulates private mode / quota exhaustion.
function throwingStorage() {
  return {
    getItem: () => null,
    setItem: () => { throw new Error("quota"); },
    removeItem: () => { throw new Error("quota"); },
  };
}
function setGPC(on) {
  if (typeof globalThis.navigator === "undefined" || globalThis.navigator === null) {
    Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true, writable: true });
  }
  try {
    globalThis.navigator.globalPrivacyControl = on;
  } catch (e) {
    Object.defineProperty(globalThis.navigator, "globalPrivacyControl", { value: on, configurable: true, writable: true });
  }
}

module.exports = function (t) {
  // =========================================================================
  // encodeState / decodeState
  // =========================================================================
  const FIELDS = [
    { id: "expenseNow", type: "num" },
    { id: "inflation", type: "pct" },
    { id: "mode", type: "sel", opts: [["now", "n"], ["retire", "r"]] },
    { id: "near", type: "chk" },
    { id: "note", type: "text" },
  ];

  // round trip keeps exactly the declared fields
  const s1 = L.encodeState({ expenseNow: 100000, inflation: 4, mode: "retire", near: true, note: "hello" });
  t.ok(s1.length > 0, "encodeState returns a non-empty string");
  t.ok(!/[+/=]/.test(s1), "encodeState output is base64url (no + / =)");
  const d1 = L.decodeState(s1, FIELDS);
  t.eq(d1.expenseNow, 100000, "num round trip");
  t.eq(d1.inflation, 4, "pct round trip");
  t.eq(d1.mode, "retire", "sel round trip");
  t.eq(d1.near, true, "chk round trip");
  t.eq(d1.note, "hello", "text round trip");

  // garbage / unknown ids
  t.eq(Object.keys(L.decodeState("!!!not-base64!!!", FIELDS)).length, 0, "garbage string -> {}");
  t.eq(Object.keys(L.decodeState("", FIELDS)).length, 0, "empty string -> {}");
  t.eq(Object.keys(L.decodeState(null, FIELDS)).length, 0, "null -> {}");
  t.eq(Object.keys(L.decodeState(s1, null)).length, 0, "null fields -> {}");
  const withUnknown = L.encodeState({ expenseNow: 1, evil: "x", __proto__: "y" });
  const dU = L.decodeState(withUnknown, FIELDS);
  t.eq(Object.prototype.hasOwnProperty.call(dU, "evil"), false, "unknown id dropped");
  t.eq(dU.expenseNow, 1, "known id kept alongside unknown");

  // type violations are dropped, valid siblings survive.
  // NB: `note` is intentionally 500 chars here — encodeState CLAMPS text to 200
  // rather than dropping it, so it legitimately survives as 200 chars.
  const bad = L.encodeState({ expenseNow: "not a number", inflation: 4, mode: "NOWHERE", near: "yes", note: "x".repeat(500) });
  const dB = L.decodeState(bad, FIELDS);
  t.eq(Object.prototype.hasOwnProperty.call(dB, "expenseNow"), false, "non-finite number dropped");
  t.eq(dB.inflation, 4, "valid sibling survives (num)");
  t.eq(Object.prototype.hasOwnProperty.call(dB, "mode"), false, "sel outside opts dropped");
  t.eq(Object.prototype.hasOwnProperty.call(dB, "near"), false, "non-boolean chk dropped");
  t.eq(dB.note.length, 200, "over-long text is clamped, then accepted at 200 chars");

  // sel must match opts exactly (case sensitive)
  const badSel = L.encodeState({ mode: "Retire" });
  t.eq(Object.prototype.hasOwnProperty.call(L.decodeState(badSel, FIELDS), "mode"), false, "sel is case-sensitive");

  // a JSON array payload is not an object -> {}
  const arrPayload = L.b64urlEncode("[1,2,3]");
  t.eq(Object.keys(L.decodeState(arrPayload, FIELDS)).length, 0, "JSON array payload -> {}");

  // Infinity / NaN never survive
  const infPayload = L.b64urlEncode('{"expenseNow":1e999,"inflation":4}');
  const dInf = L.decodeState(infPayload, FIELDS);
  t.eq(Object.prototype.hasOwnProperty.call(dInf, "expenseNow"), false, "Infinity dropped");
  t.eq(dInf.inflation, 4, "finite sibling survives");

  // encodeState ignores empty strings / undefined, and never throws
  t.eq(Object.keys(L.decodeState(L.encodeState({ expenseNow: "", mode: "", note: undefined }), FIELDS)).length, 0, "empty values omitted");
  t.eq(L.encodeState(null), "", "encodeState(null) -> ''");
  t.eq(L.encodeState("nope"), "", "encodeState(string) -> ''");

  // text is clamped to 200 chars (not rejected) at encode time
  const longText = L.encodeState({ note: "a".repeat(300) });
  t.eq(L.decodeState(longText, FIELDS).note.length, 200, "encodeState clamps text to 200 chars");
  // ...but an over-long note smuggled in by hand is rejected on decode
  const handLong = L.b64urlEncode(JSON.stringify({ note: "b".repeat(201) }));
  t.eq(Object.prototype.hasOwnProperty.call(L.decodeState(handLong, FIELDS), "note"), false, "decode drops >200-char text");
  const handOk = L.b64urlEncode(JSON.stringify({ note: "b".repeat(200) }));
  t.eq(L.decodeState(handOk, FIELDS).note.length, 200, "decode keeps exactly 200-char text");

  // =========================================================================
  // planStore
  // =========================================================================
  const st = makeStorage();
  const ps = L.planStore(st);
  t.eq(ps.get("fi"), null, "get on empty store -> null");
  ps.put("fi", { s: "abc", ts: 1000, lang: "zh", rows: [["a", "1"]] });
  const got = ps.get("fi");
  t.eq(got.s, "abc", "put/get s");
  t.eq(got.ts, 1000, "put/get ts");
  t.eq(got.lang, "zh", "put/get lang");
  t.eq(got.rows.length, 1, "put/get rows");
  t.eq(got.rows[0][0], "a", "rows preserved as pairs");

  // same slug overwrites (only the latest is kept)
  ps.put("fi", { s: "def", ts: 2000, lang: "en", rows: [] });
  t.eq(ps.get("fi").s, "def", "same slug overwritten");
  t.eq(ps.get("fi").ts, 2000, "latest ts wins");
  t.eq(Object.keys(L.readPlans(st)).length, 1, "still exactly one slug");

  // remove
  ps.remove("fi");
  t.eq(ps.get("fi"), null, "remove works");
  ps.remove("nonexistent");
  t.eq(ps.get("fi"), null, "remove of a missing slug is a no-op");

  // eviction: more than MAX_SLUGS slugs drops the OLDEST
  const st2 = makeStorage();
  const ps2 = L.planStore(st2);
  for (let i = 0; i < L.MAX_SLUGS + 5; i++) ps2.put("slug" + i, { s: "s" + i, ts: 1000 + i, lang: "en", rows: [] });
  t.eq(Object.keys(L.readPlans(st2)).length, L.MAX_SLUGS, "never stores more than MAX_SLUGS slugs");
  t.eq(ps2.get("slug0"), null, "oldest slug evicted");
  t.eq(ps2.get("slug" + (L.MAX_SLUGS + 4)).s, "s" + (L.MAX_SLUGS + 4), "newest slug retained");

  // rows clamped to 8
  const st3 = makeStorage();
  L.planStore(st3).put("x", { s: "", ts: 1, lang: "en", rows: new Array(20).fill(["a", "b"]) });
  t.eq(L.planStore(st3).get("x").rows.length, 8, "rows clamped to 8");

  // lang normalised, bad ts defaulted
  const st4 = makeStorage();
  L.planStore(st4).put("x", { s: "", ts: "bogus", lang: "de", rows: [] });
  t.eq(L.planStore(st4).get("x").lang, "en", "unknown lang -> en");
  t.ok(L.planStore(st4).get("x").ts > 0, "bad ts replaced with now");

  // invalid input never throws and never writes
  t.eq(ps2.put("", { s: "x" }), false, "empty slug rejected");
  t.eq(ps2.put("ok", null), false, "null plan rejected");
  t.eq(ps2.put("ok", "string"), false, "non-object plan rejected");

  // storage that throws on write -> silent, no throw
  const badStore = throwingStorage();
  const psBad = L.planStore(badStore);
  t.eq(psBad.put("fi", { s: "x", ts: 1, lang: "en", rows: [] }), false, "throwing storage -> put returns false");
  t.eq(psBad.get("fi"), null, "throwing storage -> get returns null");

  // storage that is null / undefined -> silent
  t.eq(L.planStore(null).put("fi", { s: "x" }), false, "null storage -> put false");
  t.eq(L.planStore(null).get("fi"), null, "null storage -> get null");
  t.eq(L.planStore(undefined).get("fi"), null, "undefined storage -> get null");

  // =========================================================================
  // comparePlan
  // =========================================================================
  const oldRows = [["A", "1"], ["B", "2"], ["C", "3"]];
  const newRows = [["A", "1"], ["B", "9"], ["D", "4"]];
  const cmp = L.comparePlan(oldRows, newRows);
  t.eq(cmp.length, 4, "comparePlan: 4 rows (3 new + 1 removed)");
  t.eq(cmp[0].label, "A", "order follows new rows");
  t.eq(cmp[0].same, true, "identical row marked same");
  t.eq(cmp[1].label, "B", "changed row order");
  t.eq(cmp[1].old, "2", "changed row keeps old value");
  t.eq(cmp[1].now, "9", "changed row keeps new value");
  t.eq(cmp[1].same, false, "changed row not same");
  t.eq(cmp[2].label, "D", "brand new row");
  t.eq(cmp[2].old, null, "brand new row has null old");
  t.eq(cmp[2].same, false, "brand new row not same");
  t.eq(cmp[3].label, "C", "removed row appended last");
  t.eq(cmp[3].now, null, "removed row has null now");
  t.eq(L.comparePlan(null, newRows).length, 3, "null old -> just the new rows");
  t.eq(L.comparePlan(oldRows, null).length, 3, "null new -> just the old rows");
  t.eq(L.comparePlan(null, null).length, 0, "null/null -> empty");

  // =========================================================================
  // getVid / getSid / visitorTag  (incl. GPC)
  // =========================================================================
  setGPC(false);
  const stV = makeStorage();
  const v1 = L.getVid(stV);
  t.ok(/^[a-z0-9-]{8,64}$/.test(v1), "getVid returns a server-acceptable id");
  t.eq(L.getVid(stV), v1, "getVid is stable across calls");
  t.eq(stV.getItem(L.KEYS.VID), v1, "getVid persists to storage");
  const ssV = makeStorage();
  const sid1 = L.getSid(ssV);
  t.ok(/^[a-z0-9-]{8,64}$/.test(sid1), "getSid returns a server-acceptable id");
  t.eq(L.getSid(ssV), sid1, "getSid is stable");

  // storage unavailable -> ""
  t.eq(L.getVid(throwingStorage()), "", "getVid with throwing storage -> ''");
  t.eq(L.getSid(null), "", "getSid with null storage -> ''");
  t.eq(L.getVid(null), "", "getVid with null storage -> ''");

  // GPC on -> no id generated or stored
  setGPC(true);
  const stG = makeStorage();
  t.eq(L.getVid(stG), "", "GPC on -> getVid returns ''");
  t.eq(L.getSid(stG), "", "GPC on -> getSid returns ''");
  t.eq(stG.getItem(L.KEYS.VID), null, "GPC on -> nothing written to storage");
  t.eq(L.visitorTag(stG, Date.now()), "", "GPC on -> visitorTag returns ''");
  t.eq(stG.getItem(L.KEYS.LAST), null, "GPC on -> visitorTag writes nothing");
  t.eq(L.gpcOn(), true, "gpcOn reflects the signal");
  setGPC(false);
  t.eq(L.gpcOn(), false, "gpcOn false when unset");

  // visitorTag buckets: new -> d0 -> d1_7 -> d8_30 -> d30p
  const D = 86400000;
  const base = Date.UTC(2026, 9, 12, 12, 0, 0); // 2026-10-12
  const stT = makeStorage();
  t.eq(L.visitorTag(stT, base), "new", "first visit -> new");
  t.eq(L.visitorTag(stT, base + 3600000), "d0", "same day -> d0");
  const stT2 = makeStorage();
  L.visitorTag(stT2, base);
  t.eq(L.visitorTag(stT2, base + 3 * D), "d1_7", "3 days later -> d1_7");
  const stT3 = makeStorage();
  L.visitorTag(stT3, base);
  t.eq(L.visitorTag(stT3, base + 7 * D), "d1_7", "7 days later -> d1_7 (boundary)");
  const stT4 = makeStorage();
  L.visitorTag(stT4, base);
  t.eq(L.visitorTag(stT4, base + 8 * D), "d8_30", "8 days later -> d8_30 (boundary)");
  const stT5 = makeStorage();
  L.visitorTag(stT5, base);
  t.eq(L.visitorTag(stT5, base + 30 * D), "d8_30", "30 days later -> d8_30 (boundary)");
  const stT6 = makeStorage();
  L.visitorTag(stT6, base);
  t.eq(L.visitorTag(stT6, base + 40 * D), "d30p", "40 days later -> d30p");
  // the tag is a "last visit" marker: it always updates
  const stT7 = makeStorage();
  t.eq(L.visitorTag(stT7, base), "new", "first visit -> new");
  t.eq(L.visitorTag(stT7, base + 40 * D), "d30p", "40 days after the first visit -> d30p");
  t.eq(L.visitorTag(stT7, base + 40 * D + 3600000), "d0", "same day as the last visit -> d0");

  // corrupt awl_last is treated as a first visit, not a crash
  const stCorrupt = makeStorage();
  stCorrupt.setItem(L.KEYS.LAST, "garbage");
  t.eq(L.visitorTag(stCorrupt, base), "new", "corrupt last-visit -> new");

  // =========================================================================
  // utm / campaign
  // =========================================================================
  const u = L.utm("?utm_source=wechat&utm_medium=social&utm_campaign=oct12");
  t.eq(u.us, "wechat", "utm_source parsed");
  t.eq(u.um, "social", "utm_medium parsed");
  t.eq(u.uc, "oct12", "utm_campaign parsed");
  t.eq(L.utm("").us, "", "empty search -> '' source");
  t.eq(L.utm("?utm_source=has%20space").us, "", "value with space rejected");
  t.eq(L.utm("?utm_source=" + "a".repeat(41)).us, "", "over 40 chars rejected");
  t.eq(L.utm("?utm_source=ok.value-1_2").us, "ok.value-1_2", "allowed charset kept");
  t.eq(L.utm(new URLSearchParams("utm_source=email")).us, "email", "accepts URLSearchParams");

  t.eq(L.campaign("?from=share"), "share", "campaign from=share");
  t.eq(L.campaign("?from=wechat"), "wechat", "campaign from=wechat");
  t.eq(L.campaign("?from=CARD"), "card", "campaign is case-insensitive");
  t.eq(L.campaign("?from=evil"), "", "unknown from rejected");
  t.eq(L.campaign(""), "", "missing from -> ''");
  t.eq(L.campaign("?utm_source=share"), "", "utm_source is not a campaign");

  // =========================================================================
  // band helpers (boundaries must match the Worker whitelist)
  // =========================================================================
  t.eq(L.ageBand(29), "<30", "ageBand 29 -> <30");
  t.eq(L.ageBand(30), "30-39", "ageBand 30 boundary");
  t.eq(L.ageBand(39), "30-39", "ageBand 39 boundary");
  t.eq(L.ageBand(40), "40-49", "ageBand 40 boundary");
  t.eq(L.ageBand(49), "40-49", "ageBand 49 boundary");
  t.eq(L.ageBand(50), "50-59", "ageBand 50 boundary");
  t.eq(L.ageBand(59), "50-59", "ageBand 59 boundary");
  t.eq(L.ageBand(60), "60+", "ageBand 60 boundary");
  t.eq(L.ageBand(NaN), "", "ageBand NaN -> ''");
  t.eq(L.ageBand(-1), "", "ageBand negative -> ''");
  t.ok(L.AGE_BANDS.indexOf(L.ageBand(45)) >= 0, "ageBand output is in the whitelist");

  t.eq(L.moneyBand(99999), "<100k", "moneyBand 99999 boundary");
  t.eq(L.moneyBand(100000), "100k-300k", "moneyBand 100k boundary");
  t.eq(L.moneyBand(299999), "100k-300k", "moneyBand 299999 boundary");
  t.eq(L.moneyBand(300000), "300k-1m", "moneyBand 300k boundary");
  t.eq(L.moneyBand(999999), "300k-1m", "moneyBand 999999 boundary");
  t.eq(L.moneyBand(1000000), "1m-3m", "moneyBand 1m boundary");
  t.eq(L.moneyBand(3000000), "3m+", "moneyBand 3m boundary");
  t.eq(L.moneyBand(-5), "", "moneyBand negative -> ''");
  t.ok(L.ASSET_BANDS.indexOf(L.moneyBand(500000)) >= 0, "moneyBand output is in the whitelist");

  t.eq(L.pctBand(0.01), "<2%", "pctBand decimal 1% -> <2%");
  t.eq(L.pctBand(0.02), "2-4%", "pctBand 2% boundary");
  t.eq(L.pctBand(4, true), "4-6%", "pctBand percentage 4% boundary");
  t.eq(L.pctBand(6, true), "6-8%", "pctBand 6% boundary");
  t.eq(L.pctBand(9, true), "8%+", "pctBand 9% -> 8%+");

  // =========================================================================
  // misc helpers
  // =========================================================================
  t.eq(L.olderThan(0, 330, 400 * D), true, "olderThan: 400d ago is older than 330d");
  t.eq(L.olderThan(0, 330, 100 * D), false, "olderThan: 100d ago is not older than 330d");
  t.eq(L.olderThan(NaN, 330, 400 * D), false, "olderThan: NaN -> false");
  t.ok(L.fmtDate(Date.UTC(2026, 9, 12), "zh").length > 0, "fmtDate returns a string");
  t.eq(L.fmtDate("bogus", "en"), "", "fmtDate bad input -> ''");
  t.eq(L.isSlug("social-security"), true, "isSlug accepts a kebab slug");
  t.eq(L.isSlug("Social Security"), false, "isSlug rejects spaces");
  t.eq(L.isSlug(""), false, "isSlug rejects empty");

  // constants stay in sync with the Worker
  t.eq(L.VISITOR_TAGS.join(","), "new,d0,d1_7,d8_30,d30p", "visitor tags match the Worker");
  t.eq(L.AWL_EVENTS.join(","), "calc,share,save,load,join", "tracked events match the Worker");
  t.eq(L.CAMPAIGNS.join(","), "card,share,wechat,email,join", "campaigns match the Worker");
  t.eq(L.FOLLOWS.join(","), "value,beiban,adam_khoo,clec,silicon_valley,satoshi,other,none", "follows match the Worker");
  t.eq(L.WTP.join(","), "multi_plans,pdf_report,yoy_compare,more_authors,none", "wtp options match the Worker");

  // ---- WeChat favorites tip helpers ----
  {
    const WX = "Mozilla/5.0 (Linux; Android 13) MicroMessenger/8.0.44";
    t.eq(L.isWeChat(WX), true, "isWeChat: MicroMessenger UA");
    t.eq(L.isWeChat("Mozilla/5.0 Chrome/120 Safari/537.36"), false, "isWeChat: ordinary UA");
    t.eq(L.isWeChat(undefined), false, "isWeChat: undefined");
    const m = {};
    const st = { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
    t.eq(L.wxFavWanted(WX, st), true, "wxFavWanted: first time in WeChat");
    t.eq(L.wxFavDismiss(st), true, "wxFavDismiss: stored");
    t.eq(L.wxFavWanted(WX, st), false, "wxFavWanted: false after dismissal");
    t.eq(L.wxFavWanted("Chrome", st), false, "wxFavWanted: false outside WeChat");
    const bad = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
    t.eq(L.wxFavWanted(WX, bad), true, "wxFavWanted: unusable storage still shows the tip");
    t.eq(L.wxFavDismiss(bad), false, "wxFavDismiss: unusable storage returns false");
    t.eq(L.wxFavWanted(WX, null), true, "wxFavWanted: no storage still shows the tip");
  }

  // ---- copyright line ----
  {
    t.ok(/© 2026 Alpha Wealth Lab\. All rights reserved/.test(L.copyrightLine("en")), "copyright: en");
    t.ok(/保留所有权利/.test(L.copyrightLine("zh")), "copyright: zh");
    t.ok(/written permission/.test(L.copyrightLine("en")) && /书面许可/.test(L.copyrightLine("zh")), "copyright: both mention permission");
  }
};
