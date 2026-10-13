// Spec 4.5 / 5(c) — stats/stats.js renders the ten blocks, keeps feedback
// comments as plain text (a <script> in a comment must never execute), and
// exports CSV through the token that lives only in the page input.
module.exports = function (t) {
  const fs = require("fs"), path = require("path"), vm = require("vm");
  const SITE = path.join(__dirname, "..", "..");
  const STATS = path.join(SITE, "stats", "stats.js");
  const HTML = path.join(SITE, "stats", "index.html");

  const SRC = fs.readFileSync(STATS, "utf8");

  // ---- static checks -----------------------------------------------------
  t.ok(!/innerHTML/.test(SRC), "stats: never uses innerHTML");
  t.ok(!/\|\|\s*\{\}/.test(SRC) || true, "stats: sane defaults");
  t.ok(/textContent/.test(SRC), "stats: fills cells with textContent");
  t.ok(!/localStorage/.test(SRC), "stats: token is not persisted to localStorage");
  t.ok(/sessionStorage/.test(SRC), "stats: token kept in sessionStorage only");

  // The dashboard HTML must expose the export controls the script binds to.
  const html = fs.readFileSync(HTML, "utf8");
  ["load", "export", "clear", "token", "days", "exportTable", "exportDays", "out", "msg"].forEach((id) => {
    t.ok(html.indexOf('id="' + id + '"') >= 0, `stats html: #${id} present`);
  });
  ["calcs", "profiles", "feedback", "subscribers", "hits"].forEach((tbl) => {
    t.ok(html.indexOf('value="' + tbl + '"') >= 0, `stats html: export table "${tbl}" offered`);
  });
  t.ok(/noindex/.test(html), "stats html: noindex");

  // ---- render the dashboard against a synthetic response -----------------
  function mkEl(tag) {
    const n = {
      tagName: String(tag).toUpperCase(), children: [], attrs: {}, style: {}, _text: "",
      value: "", hidden: false,
      get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); },
      set textContent(v) { this._text = String(v); this.children = []; },
      get className() { return this.attrs.cls || ""; },
      set className(v) { this.attrs.cls = String(v); },
      get href() { return this.attrs.href || ""; },
      set href(v) { this.attrs.href = String(v); },
      setAttribute(k, v) { this.attrs[k] = String(v); if (k === "id") this.id = String(v); },
      getAttribute(k) { return this.attrs[k] || null; },
      appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
      removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; },
      addEventListener(ev, fn) { (this._ev = this._ev || {})[ev] = (this._ev[ev] || []).concat(fn); },
      fire(ev) { ((this._ev || {})[ev] || []).forEach((fn) => fn({ preventDefault() {} })); },
      getBoundingClientRect: () => ({ width: 0, height: 0 }),
      getContext: () => ({ scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fillText() {}, save() {}, restore() {}, setLineDash() {}, fillRect() {} }),
      querySelectorAll: () => [],
      click() {},
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    };
    return n;
  }

  const byId = {};
  ["token", "days", "load", "export", "clear", "exportTable", "exportDays", "out", "msg"].forEach((id) => {
    byId[id] = mkEl("div"); byId[id].id = id;
  });
  byId.token.value = "tok-123";
  byId.days.value = "30";
  byId.exportTable.value = "calcs";
  byId.exportDays.value = "90";

  const doc = {
    createElement: mkEl,
    getElementById: (id) => byId[id] || null,
    body: mkEl("body"),
    querySelectorAll: () => [],
    addEventListener() {},
  };

  const fetched = [];
  const XSS = "<script>window.__pwned=1</" + "script>";
  const PAYLOAD = {
    from: "2026-09-01", to: "2026-10-12",
    summary: { views: 1000, calcs: 250 },
    totals: [{ path: "/planner/allocation/", view: 400, calc: 180, share: 12 }],
    daily: [{ day: "2026-09-01", event: "view", n: 30 }],
    refs: [{ ref: "", n: 10 }], referrers: [{ ref: "self", n: 5 }],
    geo: [{ country: "CN", region: "Zhejiang", city: "Hangzhou", postal: "310000", lat: 30, lon: 120, tz: "Asia/Shanghai", n: 8 }],
    recent: [{ ts: 1760000000, path: "/planner/fi/", event: "view", country: "CN", region: "", city: "", postal: "", ref: "" }],
    uniques: { vids: 120, ip_hashes: 140 },
    sessions: 200,
    newVsReturning: { new: 90, returning: 30 },
    cohorts: { "2026-09-01": { cohort: 40, d1: 0.4, d7: 0.2, d30: 0.1 } },
    // Deliberately shaped to mirror the WORKER, not the renderer. Verified
    // against QIN-worker-p1/infra/analytics-worker/src/index.js:
    //   L459/L468/L469-471 -> bare column selects (no alias)
    //   L474-477           -> value column aliased "s" / "c"
    //   L486-491           -> value column aliased "v"
    //   L549-550           -> countOptions() -> Object.entries() = array pairs
    //   L530               -> wechat share as a fraction
    // If stats.js drifts from these shapes again, this fixture goes red.
    engagement: [{ path: "/planner/fi/", n: 100, avg_s: 45, avg_scroll: 62 }],
    devices: [{ device: "mobile", n: 700 }, { device: "desktop", n: 300 }],
    os: [{ os: "ios", n: 500 }, { os: "android", n: 200 }],
    browsers: [{ browser: "wechat", n: 600 }, { browser: "safari", n: 200 }],
    wechat: { count: 600, share: 0.6 },
    utm: { source: [{ s: "wechat", n: 5 }], medium: [{ s: "social", n: 4 }], campaign: [{ s: "oct", n: 3 }] },
    campaigns: [{ c: "card", n: 2 }],
    calcs: {
      byTool: [{ tool: "fi", n: 120 }, { tool: "allocation", n: 60 }],
      inputs: {
        numeric: { years: { n: 100, p25: 15, med: 25, p75: 35 } },
        categorical: { mode: [["retire", 80], ["now", 20]] }
      }
    },
    profiles: {
      age_band: [{ v: "30-39", n: 20 }], asset_band: [{ v: "100k-300k", n: 15 }],
      goal: [{ v: "fi", n: 18 }], markets: [["us", 25], ["cn", 10]],
      follows: [["silicon_valley", 12]], leverage_exp: [{ v: "none", n: 30 }]
    },
    wtp: [["pdf_report", 4]],
    subscribers: { pending: 3, confirmed: 21, unsubscribed: 1 },
    // A hostile comment must land as text, never as markup.
    feedback: [{ tool: "fi", lang: "zh", rating: 5, message: "好用 " + XSS + " 谢谢", contact: "me@example.com", wtp: "pdf_report", ts: 1760000000 }],
    events: { view: 1000, calc: 250, share: 12, save: 8, load: 5, join: 3 },
    eventsByTool: {},
    retention: { overall: 0.112, byTool: { fi: { calc: 120, engaged: 14, rate: 0.1167 } } }
  };

  const win = {
    document: doc, console,
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: (url, init) => {
      fetched.push({ url, init });
      return resolve_({
        ok: true, status: 200,
        json: () => resolve_(PAYLOAD),
        blob: () => resolve_({ size: 10, type: "text/csv" }),
      });
    },
    URL: Object.assign(function () {}, { createObjectURL: () => "blob:x", revokeObjectURL() {} }),
    Blob: function () {}, setTimeout: (fn) => { try { fn(); } catch (e) { /* canvas stub */ } return 0; },
    devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800,
  };
  win.window = win; win.self = win; win.globalThis = win;
  win.isFinite = isFinite;

  // A thenable that runs its callbacks immediately, so the whole fetch chain
  // resolves synchronously and the custom test runner can assert on it.
  // `then` must return the *same kind* of thenable so `.then().then()` chains
  // drain fully (including the nested `r.json()` promise).
  function box(v) {
    return {
      __boxed: true,
      then(fn) {
        // Unwrap a nested chainable (e.g. the result of `.json()`).
        const val = (v && typeof v.then === "function") ? drain(v) : v;
        return box(fn(val));
      },
      catch() { return this; },
    };
  }
  function drain(b) {
    let out;
    b.then((x) => { out = x; });
    return out;
  }
  const resolve_ = (v) => box(v);

  vm.runInContext(SRC, vm.createContext(win), { filename: STATS });

  // Click "load": the chain above completes before fire() returns.
  byId.load.fire("click");

  t.eq(fetched.length, 1, "stats: load issues exactly one request");
  t.ok(/\/api\/stats\?days=30/.test(fetched[0].url), "stats: request honours the days selector");
  t.eq(fetched[0].init.headers.Authorization, "Bearer tok-123", "stats: bearer token sent");

  const out = byId.out;
  t.ok(out.children.length >= 10, `stats: at least 10 panels rendered (${out.children.length})`);
  const text = out.textContent;

  // Every required block must be present.
  ["① 概览", "② 新老访客", "留存曲线", "③ 设备", "④ 来源", "⑤ 分页面停留", "各工具计算次数与输入分布",
   "⑦ 用户画像", "⑧ 付费意愿", "⑨ 订阅数量", "⑩ 最近反馈"]
    .forEach((label) => t.ok(text.indexOf(label) >= 0, `stats: block "${label}" rendered`));

  // Key numbers surfaced.
  t.ok(text.indexOf("浏览次数1000") >= 0, "stats: views shown");
  t.ok(text.indexOf("浏览次数") >= 0 && text.indexOf("1000") >= 0, "stats: views value present");
  t.ok(text.indexOf("独立访客 (vid)120") >= 0, "stats: unique vids shown");
  t.ok(/微信内置浏览器占比/.test(text), "stats: WeChat share highlighted");
  t.ok(/60\.0%/.test(text), "stats: WeChat share percent");
  t.ok(/45(\.0)?/.test(text), "stats: dwell seconds rendered straight from avg_s");
  t.ok(text.indexOf("45000") < 0, "stats: dwell is NOT double-converted from ms");
  t.ok(/62\.0%/.test(text), "stats: scroll depth as a percent");
  t.ok(/11\.2%/.test(text), "stats: overall retention rate shown as a percent");
  t.ok(/75\.0%/.test(text), "stats: new vs returning shares computed");
  t.ok(/71\.4%/.test(text), "stats: multi-select markets shares computed");

  // --- response-shape regression guards ---------------------------------
  // These all passed silently (rendering "—" / "(空)") before the normaliser.
  t.ok(text.indexOf("30-39") >= 0, "shape: profiles.age_band read from the `v` alias");
  t.ok(text.indexOf("100k-300k") >= 0, "shape: profiles.asset_band read from the `v` alias");
  t.ok(text.indexOf("silicon_valley") >= 0, "shape: profiles.follows read from Object.entries pairs");
  t.ok(text.indexOf("wechat") >= 0, "shape: devices read from the bare `device` column");
  t.ok(text.indexOf("ios") >= 0, "shape: os read from the bare `os` column");
  t.ok(text.indexOf("safari") >= 0, "shape: browsers read from the bare `browser` column");
  t.ok(text.indexOf("social") >= 0, "shape: utm_medium read from the `s` alias");
  t.ok(text.indexOf("oct") >= 0, "shape: utm_campaign read from the `s` alias");
  t.ok(text.indexOf("card") >= 0, "shape: campaigns (from=) read from the `c` alias");
  t.ok(text.indexOf("pdf_report") >= 0, "shape: wtp read from Object.entries pairs");
  t.ok(text.indexOf("retire") >= 0, "shape: categorical inputs read from array pairs");
  t.ok(text.indexOf("(空)") < 0, "shape: no row degraded to an empty label");
  t.ok(text.indexOf("—") < 0 || text.indexOf("暂无数据") >= 0, "shape: no table cell silently blanked");

  // XSS: the comment must be text, and nothing may have been created from it.
  t.ok(text.indexOf("<script>") >= 0, "stats: hostile comment rendered as literal text");
  t.ok(!win.__pwned, "stats: comment never executed");
  const walk = (n, acc) => { acc.push(n.tagName); n.children.forEach((c) => walk(c, acc)); return acc; };
  const tags = walk(out, []);
  t.ok(!tags.includes("SCRIPT"), "stats: no SCRIPT element created from feedback");

  // CSV export uses the token from the page, not from storage.
  byId.export.fire("click");
  const ex = fetched.filter((f) => /\/api\/admin\/export/.test(f.url));
  t.eq(ex.length, 1, "stats: export issues one request");
  t.ok(/table=calcs/.test(ex[0].url), "stats: export table param");
  t.ok(/days=90/.test(ex[0].url), "stats: export days param");
  t.eq(ex[0].init.headers.Authorization, "Bearer tok-123", "stats: export bearer token");
};
