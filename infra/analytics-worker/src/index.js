// Cloudflare Worker: visit counter for www.alpha-wealth-lab.com (same-origin /api/*).
//   POST /api/hit    body (text/plain JSON): {"p":"/planner/fi/","e":"view","r":"news.ycombinator.com"}
//   GET  /api/stats  Authorization: Bearer <STATS_TOKEN>   ?days=30
//   GET  /api/health

const EVENTS = ["view", "calc", "share"];
const BOT_RE = /bot|crawl|spider|slurp|headless|preview|monitor|curl|wget|python|httpclient|okhttp/i;
const SELF = ["www.alpha-wealth-lab.com", "alpha-wealth-lab.com"];
const EXACT = ["/", "/ebook", "/changelog", "/mcp"];
const PREFIX = ["/planner/", "/calculator/", "/macro/"];

// normalizePath examples:
//   "/planner/fi/index.html?x=1" -> "/planner/fi/"   "/planner/fi" -> "/planner/fi/"
//   "/ebook.html" -> "/ebook"    "/" -> "/"   "/wp-admin/" -> "/other"   "/PLANNER/FI/" -> "/planner/fi/"
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

function refHost(r) {
  const h = String(r || "").toLowerCase();
  if (!h) return "";
  if (h.length > 60 || !/^[a-z0-9.-]+$/.test(h)) return "";
  return SELF.includes(h) ? "self" : h;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function handleHit(request, env, ctx) {
  const text = await request.text();
  if (text.length > 1024) return new Response(null, { status: 413 });
  let body;
  try { body = JSON.parse(text); } catch { return new Response(null, { status: 400 }); }
  if (!body || !EVENTS.includes(body.e)) return new Response(null, { status: 400 });
  if (BOT_RE.test(request.headers.get("User-Agent") || "")) return new Response(null, { status: 204 });

  const now = new Date();
  const cf = request.cf || {};
  const row = [
    Math.floor(now.getTime() / 1000),
    now.toISOString().slice(0, 10),
    normalizePath(body.p),
    body.e,
    request.headers.get("CF-Connecting-IP") || "",
    cf.country || "XX",
    cf.region || "",
    cf.city || "",
    refHost(body.r),
  ];
  ctx.waitUntil(
    env.DB.prepare("INSERT INTO hits(ts,day,path,event,ip,country,region,city,ref) VALUES(?,?,?,?,?,?,?,?,?)")
      .bind(...row).run().catch(() => {})
  );
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

async function handleStats(request, env, url) {
  const auth = request.headers.get("Authorization") || "";
  const token = env.STATS_TOKEN || "";
  if (!token || !auth.startsWith("Bearer ") || !safeEqual(auth.slice(7), token)) return json({ error: "unauthorized" }, 401);

  let days = parseInt(url.searchParams.get("days") || "30", 10);
  if (!Number.isFinite(days)) days = 30;
  days = Math.min(400, Math.max(1, days));
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  const f = from.toISOString().slice(0, 10);
  const q = (sql, ...args) => env.DB.prepare(sql).bind(...args).all().then((r) => r.results);

  const [totals, daily, refs, geo, uniq, recent] = await Promise.all([
    q(`SELECT path,
         SUM(event='view') AS view, SUM(event='calc') AS calc, SUM(event='share') AS share,
         COUNT(DISTINCT ip) AS visitors
       FROM hits WHERE day >= ? GROUP BY path ORDER BY view DESC`, f),
    q("SELECT day, path, event, COUNT(*) AS n FROM hits WHERE day >= ? GROUP BY day, path, event ORDER BY day", f),
    q("SELECT ref, COUNT(*) AS n FROM hits WHERE day >= ? AND event='view' GROUP BY ref ORDER BY n DESC LIMIT 30", f),
    q(`SELECT country, region, city, COUNT(*) AS n, COUNT(DISTINCT ip) AS visitors
       FROM hits WHERE day >= ? AND event='view' GROUP BY country, region, city ORDER BY n DESC LIMIT 50`, f),
    q("SELECT COUNT(DISTINCT ip) AS visitors, SUM(event='view') AS views FROM hits WHERE day >= ?", f),
    q("SELECT ts, path, event, ip, country, region, city, ref FROM hits ORDER BY id DESC LIMIT 100"),
  ]);
  return json({ from: f, to: to.toISOString().slice(0, 10), summary: uniq[0], totals, daily, refs, geo, recent });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") return new Response("ok");
    if (url.pathname === "/api/hit") return request.method === "POST" ? handleHit(request, env, ctx) : new Response(null, { status: 405 });
    if (url.pathname === "/api/stats") return request.method === "GET" ? handleStats(request, env, url) : new Response(null, { status: 405 });
    return json({ error: "not_found" }, 404);
  },
};
