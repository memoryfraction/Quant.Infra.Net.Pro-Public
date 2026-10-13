import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../src/lib.js";

test("whitelist constants are non-empty arrays", () => {
  for (const k of ["AGE_BANDS","ASSET_BANDS","GOALS","MARKETS","FOLLOWS","LEVERAGE","WTP","CAMPAIGN_SOURCES","VISITOR_TAGS","TOOLS","EVENTS"]) {
    assert.ok(Array.isArray(L[k]), k + " is array");
    assert.ok(L[k].length > 0, k + " non-empty");
  }
  assert.ok(L.EVENTS.includes("view") && L.EVENTS.includes("leave"));
  assert.ok(L.TOOLS.includes("social-security"));
  assert.ok(L.MARKETS.includes("us") && L.MARKETS.includes("tw"));
});

test("isBot detects bots, passes browsers", () => {
  assert.equal(L.isBot(""), false);
  assert.equal(L.isBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"), false);
  assert.equal(L.isBot("Googlebot/2.1 (+http://www.google.com/bot.html)"), true);
  assert.equal(L.isBot("python-requests/2.31"), true);
  assert.equal(L.isBot("curl/8.0"), true);
  assert.equal(L.isBot("HeadlessChrome"), true);
});

test("normalizePath documented examples", () => {
  assert.equal(L.normalizePath("/planner/fi/index.html?x=1"), "/planner/fi/");
  assert.equal(L.normalizePath("/planner/fi"), "/planner/fi/");
  assert.equal(L.normalizePath("/ebook.html"), "/ebook");
  assert.equal(L.normalizePath("/"), "/");
  assert.equal(L.normalizePath("/wp-admin/"), "/other");
  assert.equal(L.normalizePath("/PLANNER/FI/"), "/planner/fi/");
  assert.equal(L.normalizePath("/join/index.html"), "/join/");
  assert.equal(L.normalizePath("/privacy"), "/privacy/");
  assert.equal(L.normalizePath("/terms/"), "/terms/");
  assert.equal(L.normalizePath("/planner/allocation/"), "/planner/allocation/");
  assert.equal(L.normalizePath("".padStart(1, "") + "/".repeat(60)), "/other"); // too long
});

test("refHost", () => {
  assert.equal(L.refHost(""), "");
  assert.equal(L.refHost("www.alpha-wealth-lab.com"), "self");
  assert.equal(L.refHost("alpha-wealth-lab.com"), "self");
  assert.equal(L.refHost("example.com"), "example.com");
  assert.equal(L.refHost("evil .com"), "");      // space -> invalid
  assert.equal(L.refHost("a".repeat(70) + ".com"), ""); // too long
});

test("safeEqual", () => {
  assert.equal(L.safeEqual("abc","abc"), true);
  assert.equal(L.safeEqual("abc","abd"), false);
  assert.equal(L.safeEqual("abc","abcd"), false);
  assert.equal(L.safeEqual("",""), true);
});

test("cleanStr", () => {
  assert.equal(L.cleanStr("ok",12,/^[A-Za-z0-9-]*$/), "ok");
  assert.equal(L.cleanStr("abcdef",3), "");
  assert.equal(L.cleanStr(null,10), "");
  assert.equal(L.cleanStr("a b",5,/^[A-Za-z0-9-]*$/), "");
});

test("clampInt", () => {
  assert.equal(L.clampInt(5,0,10),5);
  assert.equal(L.clampInt(99,0,10),10);
  assert.equal(L.clampInt(-3,0,10),0);
  assert.equal(L.clampInt("7",0,10),7);
  assert.equal(L.clampInt("x",0,10),null);
  assert.equal(L.clampInt(true,0,10),null);
  assert.equal(L.clampInt(3.9,0,10),3);
  assert.equal(L.clampInt(null,0,10),null);
});

test("cleanEnum keeps only allowed", () => {
  assert.equal(L.cleanEnum("fi", L.GOALS), "fi");
  assert.equal(L.cleanEnum("bad", L.GOALS), null);
  assert.equal(L.cleanEnum(null, L.GOALS), null);
});

test("cleanMulti keeps allowed order, dedupes, drops invalid", () => {
  assert.deepEqual(L.cleanMulti("hk,us,xx", L.MARKETS), ["us","hk"]);
  assert.deepEqual(L.cleanMulti("other,cn", L.MARKETS), ["cn","other"]);
  assert.deepEqual(L.cleanMulti(["us","us","bad"], L.MARKETS), ["us"]);
  assert.deepEqual(L.cleanMulti("", L.MARKETS), []);
  assert.deepEqual(L.cleanMulti(null, L.MARKETS), []);
});

test("isValidVid", () => {
  assert.equal(L.isValidVid("abcdef12"), true);
  assert.equal(L.isValidVid("a1b2c3d4e5f6"), true);
  assert.equal(L.isValidVid("ab-12345"), true);
  assert.equal(L.isValidVid("abc"), false);           // too short
  assert.equal(L.isValidVid("ABCDEF12"), false);      // uppercase
  assert.equal(L.isValidVid("a b c d 12"), false);    // spaces
  assert.equal(L.isValidVid(12345678), false);        // not a string
  assert.equal(L.isValidVid("a".repeat(65)), false);  // too long
});

test("isValidEmail", () => {
  assert.equal(L.isValidEmail("a@b.com"), true);
  assert.equal(L.isValidEmail("user.name+tag@sub.domain.co"), true);
  assert.equal(L.isValidEmail("a@b"), false);
  assert.equal(L.isValidEmail("a@@b.com"), false);
  assert.equal(L.isValidEmail("a b@c.com"), false);
  assert.equal(L.isValidEmail("@b.com"), false);
  assert.equal(L.isValidEmail("a@.com"), false);
  assert.equal(L.isValidEmail("ab"), false);
  assert.equal(L.isValidEmail("a@" + "b".repeat(130) + ".com"), false);
});

test("maskEmail", () => {
  assert.equal(L.maskEmail("alice@example.com"), "a***@example.com");
  assert.equal(L.maskEmail("bob@x.co"), "b***@x.co");
  assert.equal(L.maskEmail("nope"), "***");
});

test("parseUA MicroMessenger => wechat mobile ios", () => {
  const r = L.parseUA("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile MicroMessenger/8.0.0 NetType/WIFI MicroMessenger");
  assert.equal(r.browser, "wechat");
  assert.equal(r.device, "mobile");
  assert.equal(r.os, "ios");
});

test("parseUA desktop browsers", () => {
  assert.equal(L.parseUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36").browser, "chrome");
  assert.equal(L.parseUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15").browser, "safari");
  assert.equal(L.parseUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) like Gecko; Edg/120.0 Safari/537.36").browser, "edge");
  assert.equal(L.parseUA("Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0").browser, "firefox");
  assert.equal(L.parseUA("Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36").device, "mobile");
  assert.equal(L.parseUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64)").os, "windows");
});

test("hmacHexPrefix: empty salt or empty msg => ''", async () => {
  assert.equal(await L.hmacHexPrefix("", "1.2.3.4"), "");
  assert.equal(await L.hmacHexPrefix("salt", ""), "");
});

test("hmacHexPrefix: 16 hex, deterministic, salt-sensitive", async () => {
  const salt = "00112233445566778899aabbccddeeff";
  const a = await L.hmacHexPrefix(salt, "1.2.3.4");
  const b = await L.hmacHexPrefix(salt, "1.2.3.4");
  const c = await L.hmacHexPrefix("ffeeddccbbaa99887766554433221100", "1.2.3.4");
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("randomTokenHex", () => {
  const t1 = L.randomTokenHex();
  const t2 = L.randomTokenHex();
  assert.match(t1, /^[0-9a-f]{64}$/);
  assert.notEqual(t1, t2);
  assert.match(L.randomTokenHex(16), /^[0-9a-f]{32}$/);
});

test("csvEscape", () => {
  assert.equal(L.csvEscape("plain"), "plain");
  assert.equal(L.csvEscape("a,b"), '"a,b"');
  assert.equal(L.csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(L.csvEscape("line1\nline2"), '"line1\nline2"');
  assert.equal(L.csvEscape(null), "");
});

test("toCSV builds CRLF rows and escapes", () => {
  assert.equal(L.toCSV(["a","b"], [["1","x,y"],["2","z"]]), "a,b\r\n1,\"x,y\"\r\n2,z\r\n");
});

test("percentile", () => {
  const a = [1,2,3,4,5,6,7,8,9,10];
  assert.equal(L.percentile(a, 0), 1);
  assert.equal(L.percentile(a, 1), 10);
  assert.equal(L.percentile(a, 0.5), 5.5);
  assert.equal(L.percentile([5], 0.5), 5);
  assert.equal(L.percentile([], 0.5), null);
});

test("dayKeyUTC / addDaysUTC", () => {
  assert.equal(L.dayKeyUTC(new Date("2026-10-12T23:59:00Z")), "2026-10-12");
  assert.equal(L.addDaysUTC("2026-12-01", 1), "2026-12-02");
  assert.equal(L.addDaysUTC("2026-11-30", 30), "2026-12-30");
  assert.equal(L.addDaysUTC("2026-01-31", 1), "2026-02-01");
  assert.equal(L.addDaysUTC("2026-12-31", 1), "2027-01-01");
});

test("profile whitelists (age/asset/goal/markets/follows/leverage/wtp)", () => {
  assert.equal(L.cleanEnum("30-39", L.AGE_BANDS), "30-39");
  assert.equal(L.cleanEnum("60+", L.AGE_BANDS), "60+");
  assert.equal(L.cleanEnum("99", L.AGE_BANDS), null);
  assert.equal(L.cleanEnum("1m-3m", L.ASSET_BANDS), "1m-3m");
  assert.equal(L.cleanEnum("<100k", L.ASSET_BANDS), "<100k");
  assert.equal(L.cleanEnum("preserve", L.GOALS), "preserve");
  assert.deepEqual(L.cleanMulti("cn,tw", L.MARKETS), ["cn","tw"]);
  assert.deepEqual(L.cleanMulti("clec,satoshi", L.FOLLOWS), ["clec","satoshi"]);
  assert.equal(L.cleanEnum("margin", L.LEVERAGE), "margin");
  assert.deepEqual(L.cleanMulti("pdf_report,none", L.WTP), ["pdf_report","none"]);
  assert.deepEqual(L.cleanMulti("yoy_compare", L.WTP), ["yoy_compare"]);
});