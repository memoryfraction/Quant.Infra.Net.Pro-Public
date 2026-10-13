// src/lib.js — pure, dependency-free helpers for the analytics Worker.
// Runs identically in Cloudflare Workers and in `node --test` (WebCrypto + fetch are globals).
// No third-party packages. No raw IP / raw User-Agent ever returned here.

export const EVENTS = ["view", "calc", "share", "save", "load", "join", "leave"];

export const BOT_RE = /bot|crawl|spider|slurp|headless|preview|monitor|curl|wget|python|httpclient|okhttp|facebookexternalhit|slackbot|telegrambot|apple-public|lighthouse/i;

export const SELF = ["www.alpha-wealth-lab.com", "alpha-wealth-lab.com"];
const EXACT = ["/", "/ebook", "/changelog", "/mcp"];
const PREFIX = ["/planner/", "/calculator/", "/macro/", "/join/", "/privacy/", "/terms/"];

export const VID_RE = /^[a-z0-9-]{8,64}$/;

// ---- whitelists (used to validate & sanitize client values) ----
export const AGE_BANDS  = ["<30", "30-39", "40-49", "50-59", "60+"];
export const ASSET_BANDS = ["<100k", "100k-300k", "300k-1m", "1m-3m", "3m+"];
export const GOALS       = ["fi", "retire", "growth", "preserve", "learn"];
export const MARKETS     = ["us", "cn", "hk", "tw", "other"];
export const FOLLOWS     = ["value", "beiban", "adam_khoo", "clec", "silicon_valley", "satoshi", "other", "none"];
export const LEVERAGE    = ["none", "etf", "margin", "options"];
export const WTP         = ["multi_plans", "pdf_report", "yoy_compare", "more_authors", "none"];
export const CAMPAIGN_SOURCES = ["card", "share", "wechat", "email", "join"];
export const VISITOR_TAGS = ["new", "d0", "d1_7", "d8_30", "d30p"];
export const TOOLS = ["fi", "allocation", "margin", "rebalance", "withdrawal", "mortgage", "social-security"];

export function isBot(ua) { return BOT_RE.test(String(ua || "")); }

// normalizePath examples:
//   "/planner/fi/index.html?x=1" -> "/planner/fi/"   "/planner/fi" -> "/planner/fi/"
//   "/ebook.html" -> "/ebook"    "/" -> "/"   "/wp-admin/" -> "/other"   "/PLANNER/FI/" -> "/planner/fi/"
//   "/join/index.html" -> "/join/"   "/privacy" -> "/privacy/"   "/terms/" -> "/terms/"
export function normalizePath(p) {
  let s = String(p || "").split("?")[0].split("#")[0].toLowerCase();
  s = s.replace(/index\.html$/, "").replace(/\.html$/, "");
  if (!s.startsWith("/")) s = "/" + s;
  if (s.length > 100 || !/^[a-z0-9/_.-]+$/.test(s)) return "/other";
  if (EXACT.includes(s)) return s;
  const pre = PREFIX.find((x) => s.startsWith(x) || s + "/" === x);
  if (!pre) return "/other";
  return s.endsWith("/") ? s : s + "/";
}

export function refHost(r) {
  const h = String(r || "").toLowerCase();
  if (!h) return "";
  if (h.length > 60 || !/^[a-z0-9.-]+$/.test(h)) return "";
  return SELF.includes(h) ? "self" : h;
}

export function safeEqual(a, b) {
  const x = String(a), y = String(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

// Cloudflare gives lat/lon as strings; keep 2 decimals (~1 km). null when not finite.
export function num(x) { const n = parseFloat(x); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; }

// ---- small generic cleaners ----
export function cleanStr(v, max, re) {
  const s = String(v == null ? "" : v);
  if (s.length > max) return "";
  if (re && !re.test(s)) return "";
  return s;
}
export function clampInt(v, min, max) {
  if (typeof v === "boolean" || v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : (typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return Math.min(max, Math.max(min, i));
}
export function cleanEnum(v, allowed) { return allowed.includes(v) ? v : null; }
// multi-select: accept array or comma string; keep only allowed, in allowed order.
export function cleanMulti(v, allowed) {
  let arr = Array.isArray(v) ? v : String(v == null ? "" : v).split(",");
  const seen = {}; const out = [];
  for (const a of allowed) {
    if (arr.some((x) => String(x).trim() === a) && !seen[a]) { seen[a] = 1; out.push(a); }
  }
  return out;
}
export function isValidVid(v) { return typeof v === "string" && VID_RE.test(v); }
export function isValidEmail(email) {
  const s = String(email || "").trim();
  if (s.length < 6 || s.length > 120) return false;
  if (/\s/.test(s)) return false;
  const at = s.lastIndexOf("@");
  if (at <= 0 || at !== s.indexOf("@")) return false;
  const domain = s.slice(at + 1);
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return false;
  if (s.includes("@@")) return false;
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(s);
}
export function maskEmail(email) {
  const s = String(email || "");
  const at = s.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  return (local.slice(0, 1) || "*") + "***@" + domain;
}

// ---- UA parsing (pure) -> {device, os, browser} ; never returns raw UA ----
export function parseUA(ua) {
  const u = String(ua || "");
  const low = u.toLowerCase();
  let device = "desktop", os = "other", browser = "other";
  if (/iphone|ipod/.test(low)) { device = "mobile"; os = "ios"; }
  else if (/ipad/.test(low)) { device = "tablet"; os = "ios"; }
  else if (/android/.test(low)) { device = "mobile"; os = "android"; }
  else if (/windows/.test(low)) { os = "windows"; }
  else if (/mac os|macintosh|mac/.test(low)) { os = "macos"; }
  else if (/linux|x11/.test(low)) { os = "linux"; }
  if (device === "desktop" && /mobile/.test(low)) device = "mobile";
  if (/micromessenger/.test(low)) browser = "wechat";
  else if (/edg\//.test(low)) browser = "edge";
  else if (/firefox|fxios/.test(low)) browser = "firefox";
  else if (/chrome|crios/.test(low)) browser = "chrome";
  else if (/safari/.test(low)) browser = "safari";
  else browser = "other";
  return { device, os, browser };
}

// ---- crypto (WebCrypto; global in node 26 + Workers) ----
const enc = new TextEncoder();
function toHex(buf) { return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join(""); }

// HMAC-SHA256 prefix. `salt` empty => "" (no IP_SALT set). Used for ip_hash (never raw IP).
export async function hmacHexPrefix(salt, msg, n = 16) {
  if (!salt || !msg) return "";
  try {
    const key = await crypto.subtle.importKey("raw", enc.encode(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
    return toHex(sig).slice(0, n);
  } catch { return ""; }
}

// 32-byte (64 hex) random token for confirm/unsubscribe links.
export function randomTokenHex(byteLen = 32) {
  const b = new Uint8Array(byteLen);
  crypto.getRandomValues(b);
  return toHex(b);
}

// ---- CSV ----
export function csvEscape(v) {
  let s = v === null || v === undefined ? "" : String(v);
  // Spreadsheet formula injection: a user-supplied STRING that starts with = + - @ (or tab/CR)
  // would be executed by Excel/Sheets when the export is opened. Prefix an apostrophe.
  // Real numbers are left untouched (negative numbers stay numeric).
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
export function toCSV(header, rows) {
  const lines = [header.map(csvEscape).join(",")];
  for (const r of rows) lines.push(r.map(csvEscape).join(","));
  return lines.join("\r\n") + "\r\n";
}

// ---- percentiles (input array MUST be ascending) ----
export function percentile(sortedAsc, p) {
  const a = sortedAsc;
  if (!a.length) return null;
  if (p <= 0) return a[0];
  if (p >= 1) return a[a.length - 1];
  const idx = (a.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return a[lo];
  return a[lo] + (a[hi] - a[lo]) * (idx - lo);
}

// ---- retention date math (UTC day keys, exact offsets) ----
export function dayKeyUTC(d) { return d.toISOString().slice(0, 10); }
export function addDaysUTC(dayStr, n) {
  const d = new Date(dayStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---- join page config (WeChat group QR that changes every ~7 days) ----
export const JOIN_MAX_BYTES = 400 * 1024;
export function isValidDay(str) {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}
// whole days from `fromDay` to `toDay` (both YYYY-MM-DD); negative when toDay is earlier
export function daysBetween(fromDay, toDay) {
  return Math.round((Date.parse(toDay + "T00:00:00Z") - Date.parse(fromDay + "T00:00:00Z")) / 86400000);
}
// Accepts "data:image/png;base64,..." or bare base64. Checks the real file signature
// (not just the declared type) and the size. Returns {ok,dataUrl} or {ok:false,error}.
export function parseQrImage(input) {
  if (typeof input !== "string" || !input) return { ok: false, error: "no_image" };
  let b64 = input.trim();
  const m = /^data:image\/(png|jpeg|jpg|webp);base64,(.*)$/i.exec(b64);
  if (m) b64 = m[2];
  else if (/^data:/i.test(b64)) return { ok: false, error: "bad_type" };
  b64 = b64.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { ok: false, error: "bad_base64" };
  if (Math.floor(b64.length * 3 / 4) > JOIN_MAX_BYTES + 3) return { ok: false, error: "too_large" };
  let bin;
  try { bin = atob(b64); } catch (e) { return { ok: false, error: "bad_base64" }; }
  if (bin.length > JOIN_MAX_BYTES) return { ok: false, error: "too_large" };
  const hex = (i) => bin.charCodeAt(i);
  let mime = "";
  if (bin.length > 8 && hex(0) === 0x89 && bin.slice(1, 4) === "PNG") mime = "image/png";
  else if (bin.length > 3 && hex(0) === 0xff && hex(1) === 0xd8 && hex(2) === 0xff) mime = "image/jpeg";
  else if (bin.length > 12 && bin.slice(0, 4) === "RIFF" && bin.slice(8, 12) === "WEBP") mime = "image/webp";
  if (!mime) return { ok: false, error: "bad_type" };
  return { ok: true, dataUrl: "data:" + mime + ";base64," + b64 };
}
