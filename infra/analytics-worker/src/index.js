// Cloudflare Worker: analytics + engagement API for www.alpha-wealth-lab.com (same-origin /api/*).
//   POST /api/hit        extended, backward-compatible
//   POST /api/calc       record a full calculation (inputs + result)
//   POST /api/profile    optional 3-second visitor profile (upsert by vid)
//   POST /api/feedback   feedback + willingness-to-pay
//   POST /api/subscribe  email subscribe (double confirm via Brevo)
//   GET  /api/confirm    confirm subscription by token
//   GET  /api/unsubscribe unsubscribe by token
//   GET  /api/health
//   GET  /api/stats      Bearer STATS_TOKEN (extended)
//   Admin (Bearer STATS_TOKEN): /api/admin/subscribers, /api/admin/send-reminder,
//                               /api/admin/export, /api/admin/delete
// Privacy: raw IP and raw User-Agent are NEVER stored. GPC is enforced client-side (no vid/sid sent).
// Brevo is the only external call (REST API). No third-party packages.

import {
  EVENTS, isBot, normalizePath, refHost, safeEqual, num,
  cleanStr, clampInt, cleanEnum, cleanMulti, isValidVid, isValidEmail, maskEmail,
  parseUA, hmacHexPrefix, randomTokenHex, toCSV, percentile, addDaysUTC,
  AGE_BANDS, ASSET_BANDS, GOALS, MARKETS, FOLLOWS, LEVERAGE, WTP, CAMPAIGN_SOURCES, VISITOR_TAGS, TOOLS,
} from "./lib.js";

const KEY_RE = /^[A-Za-z0-9_]{1,32}$/;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function noStore() { return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } }); }
function redirect(loc) { return new Response(null, { status: 302, headers: { Location: loc, "Cache-Control": "no-store" } }); }
// UTF-8 BOM so Excel opens Chinese text correctly; Content-Disposition names the download.
function csv(headers, rows, filename) {
  const h = { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store" };
  if (filename) h["Content-Disposition"] = 'attachment; filename="' + filename + '"';
  return new Response("﻿" + toCSV(headers, rows), { headers: h });
}

async function readJson(request, limit = 8192) {
  const text = await request.text();
  if (text.length > limit) { const e = new Error("413"); e.status = 413; throw e; }
  let b; try { b = JSON.parse(text); } catch { const e = new Error("400"); e.status = 400; throw e; }
  return b;
}

// ---- clean calc inputs / result per spec 3.3 ----
function cleanInputs(obj) {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return null;
  const out = {};
  for (const k of Object.keys(obj)) {
    if (Object.keys(out).length >= 40) break;
    if (typeof k !== "string" || !KEY_RE.test(k)) continue;
    const v = obj[k];
    let cv = null, ok = false;
    if (typeof v === "number" && isFinite(v)) { cv = v; ok = true; }
    else if (typeof v === "boolean") { cv = v; ok = true; }
    else if (typeof v === "string" && v.length <= 60) { cv = v; ok = true; }
    if (!ok) continue;
    const cand = Object.assign({}, out, { [k]: cv });
    if (JSON.stringify(cand).length > 3000) break;
    out[k] = cv;
  }
  return out;
}
function cleanResult(arr) {
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const it of arr) {
    if (out.length >= 8) break;
    if (!Array.isArray(it) || it.length < 2) continue;
    const a = String(it[0] == null ? "" : it[0]);
    const b = String(it[1] == null ? "" : it[1]);
    if (a.length > 40 || b.length > 80) continue;
    out.push([a.slice(0, 40), b.slice(0, 80)]);
  }
  return out;
}

function toolFromPath(p) {
  const m = String(p || "").toLowerCase().match(/^\/planner\/([a-z0-9-]+)\/?$/);
  if (m && TOOLS.includes(m[1])) return m[1];
  return "";
}
function authed(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = env.STATS_TOKEN || "";
  return !!token && auth.startsWith("Bearer ") && safeEqual(auth.slice(7), token);
}

// ---- anti-abuse: rate limit (spec 3.3 ④) ----
// Preferred: the Workers Rate Limiting binding ([[unsafe.bindings]] type = "ratelimit",
// name = "RL"). It keys on the client identity WITHOUT persisting anything to the DB.
// Fallback when the binding is absent (e.g. `wrangler dev --local`): an in-isolate
// best-effort counter keyed on the salted ip_hash (never the raw IP). It is per-isolate,
// so it is weaker than the binding — the README documents this trade-off.
const RL_FALLBACK = new Map();
const RL_WINDOW_MS = 60_000;
const RL_MAX = 5;

async function limited(request, env) {
  if (env.RL && typeof env.RL.limit === "function") {
    // Workers Rate Limiting binding: { success: boolean }
    try {
      const key = request.headers.get("CF-Connecting-IP") || "anon";
      const r = await env.RL.limit({ key });
      return r && r.success === false;
    } catch { return false; }
  }
  const key = (await hmacHexPrefix(env.IP_SALT || "", request.headers.get("CF-Connecting-IP") || "")) || "anon";
  const now = Date.now();
  const rec = RL_FALLBACK.get(key);
  if (!rec || now - rec.start >= RL_WINDOW_MS) { RL_FALLBACK.set(key, { start: now, n: 1 }); return false; }
  rec.n++;
  if (RL_FALLBACK.size > 5000) RL_FALLBACK.clear(); // bound memory
  return rec.n > RL_MAX;
}

// ---- Brevo (Transactional REST API) ----
// Adds the RFC 8058 one-click List-Unsubscribe header on every mail that has a token.
async function sendMail(env, { to, subject, html, text, unsubUrl }) {
  if (!env.BREVO_API_KEY) { const e = new Error("mail_not_configured"); e.code = "mail_not_configured"; throw e; }
  const payload = {
    sender: { name: "Alpha Wealth Lab", email: env.MAIL_FROM || "alphawealthlab@outlook.com" },
    replyTo: { email: "alphawealthlab@outlook.com" },
    to: [{ email: to }],
    subject, htmlContent: html, textContent: text,
  };
  if (unsubUrl) {
    payload.headers = {
      "List-Unsubscribe": "<" + unsubUrl + ">",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", "accept": "application/json" },
    body: JSON.stringify(payload),
  });
  // Never log the recipient or the token — status code only.
  if (!res.ok) { const e = new Error("mail_failed " + res.status); e.status = res.status; throw e; }
  return { ok: true };
}
function unsubUrlFor(token) {
  return "https://www.alpha-wealth-lab.com/api/unsubscribe?t=" + token;
}
function confirmEmail(lang, confirmUrl) {
  if (lang === "zh") return {
    subject: "请确认订阅：每年 12 月 1 日的再平衡提醒",
    text: "请点击下面的链接确认订阅（每年 12 月 1 日的年度再平衡提醒）：\n\n" + confirmUrl + "\n\n如果不是你本人操作，忽略即可。\n\nAlpha Wealth Lab",
    html: '<p>请点击下面的链接确认订阅（每年 12 月 1 日的年度再平衡提醒）：</p><p><a href="' + confirmUrl + '">点击确认订阅</a></p><p style="color:#5B6B69;font-size:13px">如果不是你本人操作，忽略即可。</p>',
  };
  return {
    subject: "Confirm: annual rebalancing reminder",
    text: "Please click the link below to confirm your subscription (annual rebalancing reminder every Dec 1):\n\n" + confirmUrl + "\n\nIf this wasn't you, just ignore this email.\n\nAlpha Wealth Lab",
    html: '<p>Please click the link below to confirm your subscription (annual rebalancing reminder every Dec 1):</p><p><a href="' + confirmUrl + '">Confirm subscription</a></p><p style="color:#5B6B69;font-size:13px">If this wasn\'t you, just ignore this email.</p>',
  };
}
function reminderEmail(lang, token) {
  const link = "https://www.alpha-wealth-lab.com/planner/rebalance/?from=email";
  const unsub = unsubUrlFor(token || "");
  if (lang === "zh") return {
    subject: "12 月 1 日：该做年度再平衡了",
    text: "12 月 1 日：该做年度再平衡了。\n打开再平衡工具，按今年的涨跌调整你的三部位：\n\n" + link + "\n\n退订：" + unsub + "\n本邮件仅供学习参考，不构成投资建议。\n\nAlpha Wealth Lab",
    html: '<p>12 月 1 日：该做年度再平衡了。</p><p><a href="' + link + '">打开再平衡工具</a></p><p style="color:#5B6B69;font-size:13px"><a href="' + unsub + '">退订</a> · 本邮件仅供学习参考，不构成投资建议。</p>',
  };
  return {
    subject: "Time for your annual rebalancing",
    text: "Dec 1: time for your annual rebalancing.\nOpen the rebalancing tool and adjust your three buckets for this year's moves:\n\n" + link + "\n\nUnsubscribe: " + unsub + "\nThis email is for learning only and is not investment advice.\n\nAlpha Wealth Lab",
    html: '<p>Dec 1: time for your annual rebalancing.</p><p><a href="' + link + '">Open the rebalancing tool</a></p><p style="color:#5B6B69;font-size:13px"><a href="' + unsub + '">Unsubscribe</a> · For learning only, not investment advice.</p>',
  };
}

// ============================ /api/hit ============================
async function handleHit(request, env, ctx) {
  const text = await request.text();
  if (text.length > 1024) return new Response(null, { status: 413 });
  let body; try { body = JSON.parse(text); } catch { return new Response(null, { status: 400 }); }
  if (!body || !EVENTS.includes(body.e)) return new Response(null, { status: 400 });
  const ua = request.headers.get("User-Agent") || "";
  if (isBot(ua)) return noStore();

  const now = new Date();
  const cf = request.cf || {};
  const { device, os, browser } = parseUA(ua);
  const ipHash = await hmacHexPrefix(env.IP_SALT || "", request.headers.get("CF-Connecting-IP") || "");
  const vTag = VISITOR_TAGS.includes(body.v) ? body.v : "";
  const camp = CAMPAIGN_SOURCES.includes(body.c) ? body.c : "";
  const vid = isValidVid(body.vid) ? body.vid : "";
  const sid = isValidVid(body.sid) ? body.sid : "";
  const vw = clampInt(body.vw, 0, 10000);
  const bl = cleanStr(body.bl, 12, /^[A-Za-z0-9-]*$/) || "";
  const us = cleanStr(body.us, 40, /^[A-Za-z0-9_.-]*$/) || "";
  const um = cleanStr(body.um, 40, /^[A-Za-z0-9_.-]*$/) || "";
  const uc = cleanStr(body.uc, 40, /^[A-Za-z0-9_.-]*$/) || "";
  const isLeave = body.e === "leave";
  const d = isLeave ? clampInt(body.d, 0, 3600000) : null;
  const sc = isLeave ? clampInt(body.sc, 0, 100) : null;

  const row = [
    Math.floor(now.getTime() / 1000), now.toISOString().slice(0, 10),
    normalizePath(body.p), body.e,
    cf.country || "XX", cf.region || "", cf.city || "", cf.postalCode || "",
    num(cf.latitude), num(cf.longitude), cf.timezone || "", cf.metroCode || "",
    refHost(body.r),
    vTag, vid, sid, ipHash, device, os, browser, bl, vw, us, um, uc, camp, d, sc,
  ];
  const stmt = env.DB.prepare(
    "INSERT INTO hits(ts,day,path,event,country,region,city,postal,lat,lon,tz,metro,ref,visitor,vid,sid,ip_hash,device,os,browser,blang,vw,utm_source,utm_medium,utm_campaign,campaign,dur_ms,scroll) " +
    "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).bind(...row);
  // A swallowed rejection here silently kills the whole analytics pipeline
  // (the endpoint still answers 204, so nothing looks wrong). Log the failure
  // so it is visible in `wrangler tail`, but never log any payload field.
  const p = stmt.run().catch((e) => {
    console.error("hit_insert_failed", (e && e.message) || String(e));
  });
  if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p;
  return noStore();
}

// ============================ /api/calc ============================
async function handleCalc(request, env) {
  if (isBot(request.headers.get("User-Agent") || "")) return noStore();
  let body; try { body = await readJson(request, 8192); } catch (e) { return new Response(null, { status: e.status }); }
  const tool = TOOLS.includes(body.tool) ? body.tool : "";
  const lang = (body.lang === "zh" || body.lang === "en") ? body.lang : "";
  const vid = isValidVid(body.vid) ? body.vid : "";
  const sid = isValidVid(body.sid) ? body.sid : "";
  if (!tool || !lang || !vid || !sid) return noStore(); // missing/invalid -> ignore
  const inputs = cleanInputs(body.inputs) || {};
  const result = cleanResult(body.result) || [];
  const cf = request.cf || {};
  const now = new Date();
  await env.DB.prepare("INSERT INTO calcs(ts,day,vid,sid,tool,lang,inputs,result,country,region,city) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
    .bind(Math.floor(now.getTime() / 1000), now.toISOString().slice(0, 10), vid, sid, tool, lang,
      JSON.stringify(inputs), JSON.stringify(result), cf.country || "XX", cf.region || "", cf.city || "").run();
  return noStore();
}

// ============================ /api/profile ============================
async function handleProfile(request, env) {
  if (isBot(request.headers.get("User-Agent") || "")) return noStore();
  let body; try { body = await readJson(request, 8192); } catch (e) { return new Response(null, { status: e.status }); }
  const vid = isValidVid(body.vid) ? body.vid : "";
  if (!vid) return new Response(null, { status: 400 });
  const lang = body.lang === "zh" ? "zh" : "en";
  const has = (k) => k in (body || {});
  const age = cleanEnum(body.age_band, AGE_BANDS);
  const asset = cleanEnum(body.asset_band, ASSET_BANDS);
  const goal = cleanEnum(body.goal, GOALS);
  const markets = cleanMulti(body.markets, MARKETS).join(",");
  const follows = cleanMulti(body.follows, FOLLOWS).join(",");
  const lev = cleanEnum(body.leverage_exp, LEVERAGE);
  const cf = request.cf || {};
  const now = Math.floor(Date.now() / 1000);

  const existing = await env.DB.prepare("SELECT * FROM profiles WHERE vid=?").bind(vid).first();
  const country = cf.country || (existing && existing.country) || "";
  // cleanEnum returns null (not undefined) for a value outside the whitelist, so
  // these must be tested against null: comparing to `undefined` was always true
  // and let a rejected value reach the column as SQL NULL, violating NOT NULL
  // and turning "silently drop the bad field" into a 500 for the whole request.
  const base = existing || { age_band: "", asset_band: "", goal: "", markets: "", follows: "", leverage_exp: "", country: "" };
  const keep = (raw, cleaned) => (has(raw) && cleaned !== null ? cleaned : undefined);
  const rec = {
    lang,
    age_band: keep("age_band", age) ?? base.age_band,
    asset_band: keep("asset_band", asset) ?? base.asset_band,
    goal: keep("goal", goal) ?? base.goal,
    markets: has("markets") ? markets : base.markets,
    follows: has("follows") ? follows : base.follows,
    leverage_exp: keep("leverage_exp", lev) ?? base.leverage_exp,
    country,
  };
  await env.DB.prepare(
    "INSERT INTO profiles(vid,created_ts,updated_ts,lang,age_band,asset_band,goal,markets,follows,leverage_exp,country) VALUES(?,?,?,?,?,?,?,?,?,?,?) " +
    "ON CONFLICT(vid) DO UPDATE SET updated_ts=excluded.updated_ts, lang=excluded.lang, age_band=excluded.age_band, asset_band=excluded.asset_band, goal=excluded.goal, markets=excluded.markets, follows=excluded.follows, leverage_exp=excluded.leverage_exp, country=excluded.country"
  ).bind(vid, existing ? existing.created_ts : now, now, rec.lang, rec.age_band, rec.asset_band, rec.goal, rec.markets, rec.follows, rec.leverage_exp, rec.country).run();
  return noStore();
}

// ============================ /api/feedback ============================
async function handleFeedback(request, env) {
  if (isBot(request.headers.get("User-Agent") || "")) return noStore();
  if (await limited(request, env)) return json({ error: "rate_limited" }, 429);
  let body; try { body = await readJson(request, 8192); } catch (e) { return new Response(null, { status: e.status }); }
  if (body.website && String(body.website).trim() !== "") return noStore(); // honeypot -> silent
  if (body.t === undefined || body.t === null || Number(body.t) < 1500) return noStore(); // form time -> silent
  const msg = String(body.message == null ? "" : body.message).trim();
  if (msg.length < 3 || msg.length > 1000) return new Response(null, { status: 400 });
  const rn = Number(body.rating);
  const rating = Number.isInteger(rn) && rn >= 1 && rn <= 5 ? rn : null;
  const contact = String(body.contact == null ? "" : body.contact).replace(/\s+/g, " ").slice(0, 120);
  const wtp = cleanMulti(body.wtp, WTP).join(",");
  const tool = typeof body.tool === "string" ? body.tool.slice(0, 40) : "";
  const lang = body.lang === "zh" ? "zh" : "en";
  const vid = isValidVid(body.vid) ? body.vid : "";
  const cf = request.cf || {};
  await env.DB.prepare("INSERT INTO feedback(ts,tool,lang,vid,rating,message,contact,wtp,country) VALUES(?,?,?,?,?,?,?,?,?)")
    .bind(Math.floor(Date.now() / 1000), tool, lang, vid, rating, msg, contact, wtp, cf.country || "XX").run();
  return noStore();
}

// ============================ /api/subscribe ============================
function utcDayStartSec() {
  const n = new Date();
  return Math.floor(n.getTime() / 1000) - (n.getUTCHours() * 3600 + n.getUTCMinutes() * 60 + n.getUTCSeconds());
}
async function handleSubscribe(request, env) {
  if (isBot(request.headers.get("User-Agent") || "")) return noStore();
  if (await limited(request, env)) return json({ error: "rate_limited" }, 429);
  let body; try { body = await readJson(request, 8192); } catch (e) { return new Response(null, { status: e.status }); }
  if (body.website && String(body.website).trim() !== "") return noStore(); // honeypot -> silent
  if (body.t === undefined || body.t === null || Number(body.t) < 1500) return noStore(); // form time -> silent
  const email = String(body.email == null ? "" : body.email).trim().toLowerCase();
  if (!isValidEmail(email)) return new Response(null, { status: 400 });
  if (!env.BREVO_API_KEY) return json({ error: "mail_not_configured" }, 503);

  const lang = body.lang === "zh" ? "zh" : "en";
  const source = typeof body.source === "string" ? body.source.slice(0, 40) : "";
  const vid = isValidVid(body.vid) ? body.vid : "";
  const now = Math.floor(Date.now() / 1000);

  const existing = await env.DB.prepare("SELECT * FROM subscribers WHERE email=?").bind(email).first();
  if (existing && existing.status === "confirmed") return noStore(); // 204, no resend
  if (existing && existing.status === "pending" && existing.last_confirm_sent_ts && (now - existing.last_confirm_sent_ts) < 600) {
    return noStore(); // pending & sent <10 min ago -> 204 no resend
  }
  const sentToday = (await env.DB.prepare("SELECT COUNT(*) n FROM subscribers WHERE last_confirm_sent_ts>=?").bind(utcDayStartSec()).first()).n;
  if (sentToday >= 150) {
    if (!existing) await env.DB.prepare("INSERT INTO subscribers(email,vid,lang,source,status,token,created_ts) VALUES(?,?,?,?,?,?,?)").bind(email, vid, lang, source, "pending", randomTokenHex(32), now).run();
    return noStore(); // over daily cap: record pending, do not send
  }

  const token = existing && existing.token ? existing.token : randomTokenHex(32);
  if (!existing) {
    await env.DB.prepare("INSERT INTO subscribers(email,vid,lang,source,status,token,created_ts,last_confirm_sent_ts) VALUES(?,?,?,?,?,?,?,?)").bind(email, vid, lang, source, "pending", token, now, now).run();
  } else {
    await env.DB.prepare("UPDATE subscribers SET status='pending', lang=?, source=?, last_confirm_sent_ts=? WHERE email=?").bind(lang, source, now, email).run();
  }
  const confirmUrl = "https://www.alpha-wealth-lab.com/api/confirm?t=" + token;
  try {
    await sendMail(env, { to: email, ...confirmEmail(lang, confirmUrl), unsubUrl: unsubUrlFor(token) });
  } catch (e) {
    if (e.code === "mail_not_configured") return json({ error: "mail_not_configured" }, 503);
    // Mail send failed: keep the pending row; the client shows a generic message.
    // Log the STATUS ONLY — never the address or the token.
    console.warn("brevo_failed", e.status || 0);
  }
  return noStore();
}

// ============================ confirm / unsubscribe ============================
async function handleConfirm(request, env, url) {
  const t = url.searchParams.get("t") || "";
  const row = t ? await env.DB.prepare("SELECT * FROM subscribers WHERE token=?").bind(t).first() : null;
  if (row && row.status !== "unsubscribed") {
    await env.DB.prepare("UPDATE subscribers SET status='confirmed', confirmed_ts=? WHERE token=?").bind(Math.floor(Date.now() / 1000), t).run();
    return redirect("/planner/subscribed/?ok=1");
  }
  return redirect("/planner/subscribed/?ok=0");
}
async function handleUnsubscribe(request, env, url) {
  const t = url.searchParams.get("t") || "";
  if (t) await env.DB.prepare("UPDATE subscribers SET status='unsubscribed' WHERE token=?").bind(t).run();
  return redirect("/planner/subscribed/?unsub=1");
}
// ============================ admin ============================
function countOptions(rows, col) {
  const c = {};
  for (const r of rows) { const v = (r[col] || ""); for (const x of v.split(",")) { const k = x.trim(); if (k) c[k] = (c[k] || 0) + 1; } }
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
function round2(x) { return Number.isFinite(x) ? Math.round(x * 100) / 100 : null; }
function round4(x) { return Number.isFinite(x) ? Math.round(x * 10000) / 10000 : null; }

async function adminSubscribers(request, env, url) {
  const status = url.searchParams.get("status");
  const counts = { pending: 0, confirmed: 0, unsubscribed: 0 };
  const rows = await env.DB.prepare("SELECT status, COUNT(*) n FROM subscribers GROUP BY status").all();
  for (const r of rows.results) counts[r.status] = (counts[r.status] || 0) + r.n;
  const has = status && ["pending", "confirmed", "unsubscribed"].includes(status);
  // Bind only when the WHERE clause is actually present: D1 rejects a bind()
  // whose arity exceeds the statement's placeholder count, which made the
  // unfiltered listing (no ?status=) fail with a 500.
  const recentStmt = env.DB.prepare(
    "SELECT email, status, source, lang, created_ts, confirmed_ts FROM subscribers" + (has ? " WHERE status=?" : "") + " ORDER BY created_ts DESC LIMIT 50"
  );
  const recentRows = await (has ? recentStmt.bind(status) : recentStmt).all();
  const recent = recentRows.results.map((r) => ({ email: maskEmail(r.email), status: r.status, source: r.source, lang: r.lang, created: r.created_ts, confirmed: r.confirmed_ts }));
  return json({ counts, recent });
}

async function sendReminder(env, { dry = false, limit = 250 } = {}) {
  const year = new Date().getUTCFullYear();
  const rows = await env.DB.prepare(
    "SELECT email, lang, token FROM subscribers WHERE status='confirmed' AND (last_sent_year IS NULL OR last_sent_year<?) ORDER BY created_ts ASC LIMIT ?"
  ).bind(year, limit).all();
  const list = rows.results;
  if (dry) return { count: list.length, year };
  let sent = 0, failed = 0;
  for (const s of list) {
    try {
      await sendMail(env, { to: s.email, ...reminderEmail(s.lang === "zh" ? "zh" : "en", s.token), unsubUrl: unsubUrlFor(s.token) });
      await env.DB.prepare("UPDATE subscribers SET last_sent_year=? WHERE email=?").bind(year, s.email).run();
      sent++;
    } catch (e) { failed++; }
  }
  return { sent, failed, year };
}
async function adminSendReminder(request, env, url) {
  const dry = url.searchParams.get("dry") === "1";
  const r = await sendReminder(env, { dry, limit: 250 });
  return dry ? json({ count: r.count, year: r.year }) : json({ sent: r.sent, failed: r.failed, year: r.year });
}

async function adminExport(request, env, url) {
  const table = url.searchParams.get("table");
  const allowed = {
    calcs: { sql: "SELECT id,ts,day,vid,sid,tool,lang,inputs,result,country,region,city FROM calcs WHERE day>=? ORDER BY ts ASC LIMIT 50000", date: false },
    profiles: { sql: "SELECT vid,created_ts,updated_ts,lang,age_band,asset_band,goal,markets,follows,leverage_exp,country FROM profiles WHERE updated_ts>=? ORDER BY updated_ts ASC LIMIT 50000", date: false },
    feedback: { sql: "SELECT id,ts,tool,lang,vid,rating,message,contact,wtp,country FROM feedback WHERE ts>=? ORDER BY ts ASC LIMIT 50000", date: false },
    subscribers: { sql: "SELECT email,vid,lang,source,status,created_ts,confirmed_ts,last_confirm_sent_ts,last_sent_year FROM subscribers WHERE created_ts>=? ORDER BY created_ts ASC LIMIT 50000", date: false },
    hits: { sql: "SELECT id,ts,day,path,event,country,region,city,postal,lat,lon,tz,metro,ref,visitor,vid,sid,ip_hash,device,os,browser,blang,vw,utm_source,utm_medium,utm_campaign,campaign,dur_ms,scroll FROM hits WHERE day>=? ORDER BY ts ASC LIMIT 50000", date: true },
  };
  if (!allowed[table]) return json({ error: "bad_table" }, 400);
  let days = parseInt(url.searchParams.get("days") || "90", 10);
  if (!Number.isFinite(days)) days = 90;
  days = Math.min(730, Math.max(1, days));
  const cutoffSec = Math.floor(Date.now() / 1000) - (days - 1) * 86400;
  const cutoffDay = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const rows = await env.DB.prepare(allowed[table].sql).bind(allowed[table].date ? cutoffDay : cutoffSec).all();
  const keys = Object.keys(rows.results[0] || { x: 1 });
  return csv(keys, rows.results.map((r) => keys.map((k) => r[k])), table + "-" + new Date().toISOString().slice(0, 10) + ".csv");
}

async function adminDelete(request, env) {
  let body; try { body = await readJson(request, 8192); } catch (e) { return new Response(null, { status: e.status }); }
  const vid = isValidVid(body.vid) ? body.vid : "";
  if (!vid) return json({ error: "bad_vid" }, 400);
  const out = {};
  for (const t of ["hits", "calcs", "profiles", "feedback", "subscribers"]) {
    const r = await env.DB.prepare("DELETE FROM " + t + " WHERE vid=?").bind(vid).run();
    out[t] = (r && r.meta && (r.meta.changes !== undefined ? r.meta.changes : r.meta.rowsDeleted)) || 0;
  }
  return json(out);
}

// ============================ stats (extended) ============================
function summarizeInputs(rows) {
  const numeric = {}, categorical = {};
  for (const r of rows) {
    let obj; try { obj = JSON.parse(r.inputs); } catch { continue; }
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === "number" && isFinite(v)) { (numeric[k] = numeric[k] || []).push(v); }
      else if (typeof v === "string" || typeof v === "boolean") { (categorical[k] = categorical[k] || {})[String(v)] = (categorical[k][String(v)] || 0) + 1; }
    }
  }
  const nout = {}; for (const k of Object.keys(numeric)) { const a = numeric[k].sort((x, y) => x - y); nout[k] = { p25: round2(percentile(a, .25)), med: round2(percentile(a, .5)), p75: round2(percentile(a, .75)), n: a.length }; }
  const cout = {}; for (const k of Object.keys(categorical)) { cout[k] = Object.entries(categorical[k]).sort((a, b) => b[1] - a[1]).slice(0, 12); }
  return { numeric: nout, categorical: cout };
}

async function handleStats(request, env, url) {
  if (!authed(request, env)) return json({ error: "unauthorized" }, 401);
  let days = parseInt(url.searchParams.get("days") || "30", 10);
  if (!Number.isFinite(days)) days = 30;
  days = Math.min(400, Math.max(1, days));
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  const f = from.toISOString().slice(0, 10);
  const today = to.toISOString().slice(0, 10);
  const q = (sql, ...args) => env.DB.prepare(sql).bind(...args).all().then((r) => r.results);
  const one = (sql, ...args) => q(sql, ...args).then((r) => r[0] || {});

  const batch1 = await Promise.all([
    q(`SELECT path, SUM(event='view') view, SUM(event='calc') calc, SUM(event='share') share FROM hits WHERE day >= ? GROUP BY path ORDER BY view DESC`, f),
    q("SELECT day, path, event, COUNT(*) n FROM hits WHERE day >= ? GROUP BY day, path, event ORDER BY day", f),
    q("SELECT ref, COUNT(*) n FROM hits WHERE day >= ? AND event='view' GROUP BY ref ORDER BY n DESC LIMIT 30", f),
    q(`SELECT country, region, city, postal, tz, ROUND(AVG(lat),2) lat, ROUND(AVG(lon),2) lon, COUNT(*) n FROM hits WHERE day >= ? AND event='view' GROUP BY country, region, city, postal ORDER BY n DESC LIMIT 100`, f),
    one("SELECT SUM(event='view') views, SUM(event='calc') calcs FROM hits WHERE day >= ?", f),
    q("SELECT ts, path, event, country, region, city, postal, ref FROM hits ORDER BY id DESC LIMIT 100"),
    one("SELECT COUNT(DISTINCT vid) n FROM hits WHERE day >= ? AND vid <> ''", f),
    one("SELECT COUNT(DISTINCT ip_hash) n FROM hits WHERE day >= ? AND ip_hash <> ''", f),
    one("SELECT COUNT(DISTINCT sid) n FROM hits WHERE day >= ? AND sid <> ''", f),
    one("SELECT COUNT(DISTINCT vid) n FROM hits WHERE day=? AND vid<>'' AND vid NOT IN (SELECT vid FROM hits WHERE day<? AND vid<>'')", today, today),
    one("SELECT COUNT(DISTINCT vid) n FROM hits WHERE day=? AND vid<>'' AND vid IN (SELECT vid FROM hits WHERE day<? AND vid<>'')", today, today),
    q("SELECT path, COUNT(*) n, ROUND(AVG(dur_ms)/1000.0,1) avg_s, ROUND(AVG(scroll),1) avg_scroll FROM hits WHERE day >= ? AND event='leave' AND (dur_ms IS NOT NULL OR scroll IS NOT NULL) GROUP BY path ORDER BY n DESC LIMIT 50", f),
    q("SELECT device, COUNT(*) n FROM hits WHERE day >= ? AND device <> '' GROUP BY device ORDER BY n DESC", f),
    q("SELECT os, COUNT(*) n FROM hits WHERE day >= ? AND os <> '' GROUP BY os ORDER BY n DESC", f),
    q("SELECT browser, COUNT(*) n FROM hits WHERE day >= ? AND browser <> '' GROUP BY browser ORDER BY n DESC", f),
    one("SELECT COUNT(*) n FROM hits WHERE day >= ? AND browser='wechat'", f),
    one("SELECT COUNT(*) n FROM hits WHERE day >= ?", f),
    q("SELECT utm_source s, COUNT(*) n FROM hits WHERE day >= ? AND utm_source <> '' GROUP BY utm_source ORDER BY n DESC LIMIT 20", f),
    q("SELECT utm_medium s, COUNT(*) n FROM hits WHERE day >= ? AND utm_medium <> '' GROUP BY utm_medium ORDER BY n DESC LIMIT 20", f),
    q("SELECT utm_campaign s, COUNT(*) n FROM hits WHERE day >= ? AND utm_campaign <> '' GROUP BY utm_campaign ORDER BY n DESC LIMIT 20", f),
    q("SELECT campaign c, COUNT(*) n FROM hits WHERE day >= ? AND campaign <> '' GROUP BY campaign ORDER BY n DESC LIMIT 20", f),
    q("SELECT tool, COUNT(*) n FROM calcs WHERE day >= ? GROUP BY tool ORDER BY n DESC", f),
    q("SELECT event, COUNT(*) n FROM hits WHERE day >= ? GROUP BY event", f),
    q("SELECT event, path FROM hits WHERE day >= ? AND event IN ('share','save','load','join')", f),
  ]);
  const [totals, daily, refs, geo, summary, recent, uvids, uip, sessions, newV, retV, engagement, devices, osList, browsers, wechat, totalHits, utmS, utmM, utmC, campaigns, calcsByTool, events, toolEventsRaw] = batch1;

  const batch2 = await Promise.all([
    q("SELECT inputs FROM calcs ORDER BY ts DESC LIMIT 2000"),
    q("SELECT age_band v, COUNT(*) n FROM profiles WHERE age_band <> '' GROUP BY age_band ORDER BY n DESC"),
    q("SELECT asset_band v, COUNT(*) n FROM profiles WHERE asset_band <> '' GROUP BY asset_band ORDER BY n DESC"),
    q("SELECT goal v, COUNT(*) n FROM profiles WHERE goal <> '' GROUP BY goal ORDER BY n DESC"),
    q("SELECT markets FROM profiles WHERE markets <> ''"),
    q("SELECT follows FROM profiles WHERE follows <> ''"),
    q("SELECT leverage_exp v, COUNT(*) n FROM profiles WHERE leverage_exp <> '' GROUP BY leverage_exp ORDER BY n DESC"),
    q("SELECT wtp FROM feedback WHERE wtp <> ''"),
    q("SELECT status, COUNT(*) n FROM subscribers GROUP BY status"),
    q("SELECT tool, lang, rating, message, contact, wtp, ts FROM feedback ORDER BY ts DESC LIMIT 50"),
    q("SELECT source, COUNT(*) n FROM subscribers WHERE status='confirmed' GROUP BY source"),
  ]);
  const [last2000, pAge, pAsset, pGoal, pMarkets, pFollows, pLev, wtp, subsCounts, feedback50, confirmedBySource] = batch2;

  const evMap = {}; for (const r of events) evMap[r.event] = r.n;
  const confirmedCount = (subsCounts.find((s) => s.status === "confirmed") || {}).n || 0;
  const totalCalc = Number(summary.calcs) || 0;
  const retentionOverall = totalCalc > 0 ? round4(((evMap.share || 0) + (evMap.save || 0) + (evMap.load || 0) + (evMap.join || 0) + confirmedCount) / totalCalc) : null;

  const toolEvents = {};
  for (const r of toolEventsRaw) { const t = toolFromPath(r.path); if (!t) continue; toolEvents[t] = toolEvents[t] || { share: 0, save: 0, load: 0, join: 0 }; if (r.event in toolEvents[t]) toolEvents[t][r.event]++; }
  const retentionByTool = {};
  for (const ct of calcsByTool) { const te = toolEvents[ct.tool] || { share: 0, save: 0, load: 0, join: 0 }; const engaged = te.share + te.save + te.load + te.join + (confirmedBySource[ct.tool] || 0); retentionByTool[ct.tool] = { calc: ct.n, engaged, rate: ct.n > 0 ? round4(engaged / ct.n) : null }; }
  const eventsOut = { view: evMap.view || 0, calc: evMap.calc || 0, share: evMap.share || 0, save: evMap.save || 0, load: evMap.load || 0, join: evMap.join || 0, leave: evMap.leave || 0 };
  const eventsByTool = {};
  for (const t of TOOLS) eventsByTool[t] = toolEvents[t] || { share: 0, save: 0, load: 0, join: 0 };

  // cohorts D1/D7/D30 (exact day offsets, UTC), last 60 cohort-days
  const firstMap = await q("SELECT vid, MIN(day) fd FROM hits WHERE day >= ? AND vid <> '' GROUP BY vid", f);
  const activeRows = await q("SELECT DISTINCT vid, day FROM hits WHERE day >= ? AND vid <> ''", f);
  const act = {}; for (const r of activeRows) { (act[r.vid] = act[r.vid] || new Set()).add(r.day); }
  const cohorts = {};
  for (const r of firstMap) {
    const fd = r.fd;
    if (fd < addDaysUTC(today, -60) || fd > today) continue;
    const c = (cohorts[fd] = cohorts[fd] || { size: 0, d1: 0, d7: 0, d30: 0 });
    c.size++;
    const days = act[r.vid] || new Set();
    if (addDaysUTC(fd, 1) <= today && days.has(addDaysUTC(fd, 1))) c.d1++;
    if (addDaysUTC(fd, 7) <= today && days.has(addDaysUTC(fd, 7))) c.d7++;
    if (addDaysUTC(fd, 30) <= today && days.has(addDaysUTC(fd, 30))) c.d30++;
  }
  const cohortsOut = {};
  for (const d of Object.keys(cohorts).sort()) { const c = cohorts[d]; cohortsOut[d] = { cohort: c.size, d1: round4(c.d1 / c.size), d7: round4(c.d7 / c.size), d30: round4(c.d30 / c.size) }; }

  const wechatShare = Number(totalHits.n) > 0 ? round4((wechat.n || 0) / Number(totalHits.n)) : null;
  const subsOut = { pending: 0, confirmed: 0, unsubscribed: 0 };
  for (const s of subsCounts) subsOut[s.status] = (subsOut[s.status] || 0) + s.n;
  const feedbackOut = feedback50.map((r) => ({ tool: r.tool, lang: r.lang, rating: r.rating, message: String(r.message).slice(0, 1000), contact: r.contact, wtp: r.wtp, ts: r.ts }));

  return json({
    from: f, to: today,
    summary: summary,
    totals, daily, refs, referrers: refs, geo, recent,
    uniques: { vids: uvids.n || 0, ip_hashes: uip.n || 0 },
    sessions: sessions.n || 0,
    newVsReturning: { new: newV.n || 0, returning: retV.n || 0 },
    cohorts: cohortsOut,
    engagement,
    devices, os: osList, browsers,
    wechat: { count: wechat.n || 0, share: wechatShare },
    utm: { source: utmS, medium: utmM, campaign: utmC },
    campaigns,
    calcs: { byTool: calcsByTool, inputs: summarizeInputs(last2000) },
    profiles: { age_band: pAge, asset_band: pAsset, goal: pGoal, markets: countOptions(pMarkets, "markets"), follows: countOptions(pFollows, "follows"), leverage_exp: pLev },
    wtp: countOptions(wtp, "wtp"),
    subscribers: subsOut,
    feedback: feedbackOut,
    events: eventsOut,
    eventsByTool,
    retention: { overall: retentionOverall, byTool: retentionByTool },
  });
}

// ============================ dispatch ============================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const m = request.method;
    if (url.pathname === "/api/health") return new Response("ok");
    if (url.pathname === "/api/hit") return m === "POST" ? handleHit(request, env, ctx) : new Response(null, { status: 405 });
    if (url.pathname === "/api/calc") return m === "POST" ? handleCalc(request, env) : new Response(null, { status: 405 });
    if (url.pathname === "/api/profile") return m === "POST" ? handleProfile(request, env) : new Response(null, { status: 405 });
    if (url.pathname === "/api/feedback") return m === "POST" ? handleFeedback(request, env) : new Response(null, { status: 405 });
    if (url.pathname === "/api/subscribe") return m === "POST" ? handleSubscribe(request, env) : new Response(null, { status: 405 });
    if (url.pathname === "/api/confirm") return handleConfirm(request, env, url);
    if (url.pathname === "/api/unsubscribe") return handleUnsubscribe(request, env, url);
    if (url.pathname === "/api/stats") return m === "GET" ? handleStats(request, env, url) : new Response(null, { status: 405 });
    if (url.pathname === "/api/admin/subscribers") return authed(request, env) ? adminSubscribers(request, env, url) : json({ error: "unauthorized" }, 401);
    if (url.pathname === "/api/admin/send-reminder") return authed(request, env) ? (m === "POST" ? adminSendReminder(request, env, url) : new Response(null, { status: 405 })) : json({ error: "unauthorized" }, 401);
    if (url.pathname === "/api/admin/export") return authed(request, env) ? (m === "GET" ? adminExport(request, env, url) : new Response(null, { status: 405 })) : json({ error: "unauthorized" }, 401);
    if (url.pathname === "/api/admin/delete") return authed(request, env) ? (m === "POST" ? adminDelete(request, env) : new Response(null, { status: 405 })) : json({ error: "unauthorized" }, 401);
    return json({ error: "not_found" }, 404);
  },
  async scheduled(event, env, ctx) {
    try { await sendReminder(env, { dry: false, limit: 250 }); } catch (e) { /* best-effort annual reminder */ }
    return;
  },
};