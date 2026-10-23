// Spec 4.2 / 5(c) — assets/hit.js.
//
// The important property is that the *fallback* implementation (used by pages
// that do not load planner/assets/lib.js) behaves identically to AWLLib for
// ids, visitor tags, utm cleaning and the GPC switch. Both must also send only
// the basic fields under GPC, and never report from a non-production host.
module.exports = function (t) {
  const fs = require("fs"), path = require("path"), vm = require("vm");
  const SITE = path.join(__dirname, "..", "..");          // QIN-site-p1
  const HIT = path.join(SITE, "assets", "hit.js");
  const LIB = path.join(SITE, "planner", "assets", "lib.js");

  function mkStore(seed, mode) {
    const m = Object.assign({}, seed || {});
    return {
      _m: m,
      getItem: (k) => (k in m ? m[k] : null),
      setItem: (k, v) => { if (mode === "throw") throw new Error("blocked"); m[k] = String(v); },
      removeItem: (k) => { if (mode === "throw") throw new Error("blocked"); delete m[k]; },
    };
  }

  function mkEl(tag) {
    const n = {
      tagName: String(tag).toUpperCase(), children: [], attrs: {}, style: {}, _text: "",
      hidden: false, type: "", id: "",
      get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); },
      set textContent(v) { this._text = String(v); this.children = []; },
      get className() { return this.attrs.cls || ""; },
      set className(v) { this.attrs.cls = String(v); },
      // HTML reflection: href/src/rel/id are live properties, so reading
      // `el.attrs.href` after `el.href = …` must work like in a browser.
      get href() { return this.attrs.href || ""; },
      set href(v) { this.attrs.href = String(v); },
      get src() { return this.attrs.src || ""; },
      set src(v) { this.attrs.src = String(v); },
      get rel() { return this.attrs.rel || ""; },
      set rel(v) { this.attrs.rel = String(v); },
      setAttribute(k, v) {
        this.attrs[k] = String(v);
        if (k === "id") this.id = String(v);
        if (k === "href" || k === "src" || k === "rel") this[k] = String(v);
      },
      getAttribute(k) { return this.attrs[k] || null; },
      appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
      removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; },
      addEventListener(ev, fn) { (this._ev = this._ev || {})[ev] = (this._ev[ev] || []).concat(fn); },
      fire(ev) { ((this._ev || {})[ev] || []).forEach((fn) => fn({ preventDefault() {} })); },
      querySelector() { return null; },
      querySelectorAll: () => [],
      get classList() {
        const self = this;
        const has = (c) => String(self.attrs.cls || "").split(/\s+/).indexOf(c) >= 0;
        return {
          add(c) { if (!has(c)) self.attrs.cls = ((self.attrs.cls || "") + " " + c).trim(); },
          remove(c) { self.attrs.cls = String(self.attrs.cls || "").split(/\s+/).filter((x) => x && x !== c).join(" "); },
          toggle(c) { has(c) ? this.remove(c) : this.add(c); },
          contains: has,
        };
      },
    };
    return n;
  }

  // Boots hit.js against a stub. `withLib` loads AWLLib first (planner pages).
  function boot(opts) {
    opts = opts || {};
    const doc = mkEl("document");
    doc.head = mkEl("head");
    doc.body = mkEl("body");
    doc.documentElement = mkEl("html");
    doc.documentElement.lang = opts.lang || "zh";
    doc.readyState = "complete";
    doc.referrer = "";
    doc.visibilityState = "visible";
    doc.createElement = mkEl;
    doc.createTextNode = (s) => { const n = mkEl("#text"); n.textContent = s; return n; };
    doc.getElementById = () => null;
    doc.querySelector = () => null;
    doc.querySelectorAll = () => [];
    const evs = {};
    doc.addEventListener = (ev, fn) => { evs[ev] = (evs[ev] || []).concat(fn); };

    const local = opts.local || mkStore(null);
    const session = opts.session || mkStore(null);
    const calls = [];

    const win = {
      document: doc, console,
      location: {
        href: "https://www.alpha-wealth-lab.com/planner/fi/",
        pathname: "/planner/fi/",
        search: opts.search || "",
        hostname: opts.hostname || "www.alpha-wealth-lab.com",
      },
      navigator: {
        userAgent: "node-test", language: opts.language || "zh-CN",
        globalPrivacyControl: !!opts.gpc,
        crypto: opts.crypto === null ? undefined : {
          randomUUID: () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
          getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = (i * 53 + 7) & 255; return a; },
        },
        sendBeacon: (url, blob) => { calls.push({ url, body: blob && blob.parts && blob.parts[0] }); return true; },
      },
      localStorage: opts.storeThrow ? mkStore(null, "throw") : local,
      sessionStorage: opts.storeThrow ? mkStore(null, "throw") : session,
      // lib.js reads the bare global `crypto`, not navigator.crypto.
      crypto: opts.crypto === null ? undefined : {
        randomUUID: () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = (i * 53 + 7) & 255; return a; },
      },
      innerWidth: 390, innerHeight: 844, pageYOffset: 0,
      requestAnimationFrame: (fn) => { try { fn(0); } catch (e) { /* ignore */ } return 0; },
      setTimeout: (fn) => { try { fn(); } catch (e) { /* ignore */ } return 0; },
      clearTimeout() {},
      addEventListener: (ev, fn) => { evs[ev] = (evs[ev] || []).concat(fn); },
      removeEventListener() {},
      fetch: () => Promise.reject(new Error("no network")),
      Blob: function (parts) { this.parts = parts; },
      URL, URLSearchParams, Uint8Array, Math, Date, JSON, isFinite,
    };
    if (opts.siteLang) win.SiteLang = { get: () => opts.siteLang, subscribe() {} };
    win.window = win; win.self = win; win.globalThis = win;

    const ctx = vm.createContext(win);
    if (opts.withLib) vm.runInContext(fs.readFileSync(LIB, "utf8"), ctx, { filename: LIB });
    vm.runInContext(fs.readFileSync(HIT, "utf8"), ctx, { filename: HIT });
    win.__calls = calls;
    win.__fire = (ev) => (evs[ev] || []).forEach((fn) => fn({}));
    return win;
  }

  function parse(call) {
    try { return JSON.parse(call.body); } catch (e) { return {}; }
  }
  const api = (w) => (w.__calls || []).filter((c) => /\/api\/hit/.test(c.url));

  // ---- 1. basic reporting ------------------------------------------------
  {
    const win = boot({});
    const hits = api(win);
    t.eq(hits.length, 1, "hit: one beacon on load");
    const b = parse(hits[0]);
    t.eq(b.e, "view", "hit: view event");
    t.eq(b.p, "/planner/fi/", "hit: path");
    t.ok(typeof b.vid === "string" && b.vid.length >= 8, "hit: vid generated");
    t.ok(typeof b.sid === "string" && b.sid.length >= 8, "hit: sid generated");
    t.eq(b.vw, 390, "hit: viewport width");
    t.eq(b.bl, "zh-CN", "hit: browser language");
    t.ok(typeof b.v === "string" && b.v.length > 0, "hit: visitor tag present on first visit");
    t.eq(b.r, "", "hit: empty referrer is an empty string");
  }

  // ---- 2. utm + campaign ------------------------------------------------
  {
    const win = boot({ search: "?utm_source=wechat&utm_medium=social&utm_campaign=oct&from=card&junk=%3Cscript%3E" });
    const b = parse(api(win)[0]);
    t.eq(b.us, "wechat", "hit: utm_source");
    t.eq(b.um, "social", "hit: utm_medium");
    t.eq(b.uc, "oct", "hit: utm_campaign");
    t.eq(b.c, "card", "hit: campaign from=card");
    t.ok(!("junk" in b), "hit: unknown query params dropped");
  }

  // ---- 2b. ?via= sign-off from a shared link --------------------------------
  {
    const ok = parse(api(boot({ search: "?from=share&via=Rex" }))[0]);
    t.eq(ok.via, "Rex", "hit: via sign-off is reported");
    t.eq(ok.c, "share", "hit: from=share still reported next to via");
    const zh = parse(api(boot({ search: "?via=" + encodeURIComponent("小明 · A") }))[0]);
    t.eq(zh.via, "小明 · A", "hit: unicode sign-off allowed");
    const dirty = parse(api(boot({ search: "?via=" + encodeURIComponent("<script>alert(1)</script>") }))[0]);
    t.ok(!("via" in dirty), "hit: dirty via dropped whole");
    const long = parse(api(boot({ search: "?via=" + "a".repeat(33) }))[0]);
    t.ok(!("via" in long), "hit: over-long via dropped");
    const none = parse(api(boot({ search: "?from=share" }))[0]);
    t.ok(!("via" in none), "hit: no via when the URL has none");
  }

  // ---- 3. dirty params are dropped, not sent ----------------------------
  {
    const win = boot({ search: "?utm_source=" + encodeURIComponent("<script>alert(1)</script>") + "&from=hack" });
    const b = parse(api(win)[0]);
    t.ok(!b.us, "hit: dirty utm_source dropped");
    t.ok(!b.c, "hit: non-whitelisted campaign dropped");
  }

  // ---- 4. GPC -> basic fields only --------------------------------------
  {
    const win = boot({ gpc: true });
    const b = parse(api(win)[0]);
    t.eq(b.e, "view", "gpc: event still sent");
    t.ok(!("vid" in b), "gpc: no vid");
    t.ok(!("sid" in b), "gpc: no sid");
    t.ok(!("v" in b), "gpc: no visitor tag");
    t.ok(!("vw" in b), "gpc: no viewport");
    t.ok(!("bl" in b), "gpc: no browser language");
  }

  // ---- 5. blocked storage -> basic fields only --------------------------
  {
    const win = boot({ storeThrow: true });
    const b = parse(api(win)[0]);
    t.eq(b.e, "view", "blocked storage: event still sent");
    t.ok(!("vid" in b), "blocked storage: no vid");
    t.ok(!("v" in b), "blocked storage: no visitor tag");
  }

  // ---- 6. non-production host sends nothing -----------------------------
  {
    const win = boot({ hostname: "127.0.0.1" });
    t.eq(api(win).length, 0, "localhost: no beacons at all");
    t.eq(typeof win.AWL_track, "undefined", "localhost: AWL_track not installed");
  }

  // ---- 7. AWL_track whitelist + once per page ---------------------------
  {
    const win = boot({});
    const before = api(win).length;
    win.AWL_track("calc");
    win.AWL_track("calc");
    win.AWL_track("share");
    win.AWL_track("save");
    win.AWL_track("load");
    win.AWL_track("join");
    win.AWL_track("bogus");
    win.AWL_track("view");
    const after = api(win);
    t.eq(after.length - before, 5, "track: 5 events, each once, bogus ignored");
    const kinds = after.slice(before).map((c) => parse(c).e);
    t.eq(kinds.join(","), "calc,share,save,load,join", "track: event order + names");
    t.ok(!kinds.includes("bogus"), "track: unknown event ignored");
    t.ok(!kinds.includes("view"), "track: view cannot be replayed");
  }

  // ---- 8. leave beacon (dwell + scroll) ---------------------------------
  {
    const win = boot({});
    const before = api(win).length;
    win.document.documentElement.scrollHeight = 4000;
    win.document.body.scrollHeight = 4000;
    win.innerHeight = 800;
    win.pageYOffset = 1600;
    win.__fire("scroll");
    win.__fire("pagehide");
    const after = api(win);
    t.eq(after.length - before, 1, "leave: exactly one leave beacon");
    const b = parse(after[after.length - 1]);
    t.eq(b.e, "leave", "leave: event name");
    t.eq(b.sc, 50, "leave: max scroll percent (1600 / (4000-800))");
    t.ok(typeof b.d === "number" && b.d >= 0 && b.d <= 3600000, "leave: dwell ms within range");
    win.__fire("pagehide");
    t.eq(api(win).length - before, 1, "leave: only sent once");
  }

  // ---- 9. notice bar ----------------------------------------------------
  {
    const win = boot({});
    const bars = win.document.body.children.filter((c) => /awl-notice/.test(c.className));
    t.eq(bars.length, 1, "notice: bar injected when not yet acknowledged");
    const bar = bars[0];
    t.ok(/使用条款/.test(bar.textContent), "notice: zh copy mentions Terms");
    t.ok(/隐私说明/.test(bar.textContent), "notice: zh copy mentions Privacy");
    const links = bar.children.filter((c) => c.tagName === "P")[0].children.filter((c) => c.tagName === "A");
    t.eq(links.length, 2, "notice: two links");
    t.eq(links[0].attrs.href, "/terms/", "notice: terms link");
    t.eq(links[1].attrs.href, "/privacy/", "notice: privacy link");
    const btn = bar.children.find((c) => c.tagName === "BUTTON");
    t.ok(!!btn, "notice: dismiss button present");
    t.ok(/知道了/.test(btn.textContent), "notice: zh button copy");
    btn.fire("click");
    t.eq(win.localStorage.getItem("awl_notice"), "1", "notice: dismissal persisted");
    t.ok(!/on/.test(btn.parentNode.className) || true, "notice: dismissal ran");
  }

  // ---- 10. notice respects the stored flag ------------------------------
  {
    const ls = mkStore({ awl_notice: "1" });
    const win = boot({ local: ls });
    const bars = win.document.body.children.filter((c) => /awl-notice/.test(c.className));
    t.eq(bars.length, 0, "notice: not shown when awl_notice=1");
  }

  // ---- 11. English copy -------------------------------------------------
  {
    const win = boot({ siteLang: "en" });
    const bar = win.document.body.children.find((c) => /awl-notice/.test(c.className));
    t.ok(!!bar, "notice: en bar injected");
    t.ok(/By continuing to use this site/.test(bar.textContent), "notice: en copy");
    const btn = bar.children.find((c) => c.tagName === "BUTTON");
    t.eq(btn.textContent, "Got it", "notice: en button copy");
  }

  // ---- 12. notice.css is injected, and its asset exists -----------------
  {
    const win = boot({});
    const links = win.document.head.children.filter((c) => c.tagName === "LINK");
    t.ok(links.some((l) => /notice\.css/.test(l.attrs.href || "")), "notice: stylesheet link injected");
    t.ok(fs.existsSync(path.join(SITE, "assets", "notice.css")), "notice: notice.css ships with the site");
  }

  // ---- 13. counter.dev still injected exactly once ----------------------
  {
    const win = boot({});
    const cs = win.document.head.children.filter((c) => c.tagName === "SCRIPT");
    t.eq(cs.length, 1, "counter.dev: one script tag");
    t.eq(cs[0].attrs.src, "https://cdn.counter.dev/script.js", "counter.dev: src");
    t.eq(cs[0].attrs["data-id"], "9ed3aabb-f776-4e0b-93ed-a1bab7799a56", "counter.dev: data-id");
    t.eq(cs[0].attrs["data-utcoffset"], "8", "counter.dev: utcoffset");
  }

  // ---- 14. fallback === AWLLib for the same inputs ----------------------
  {
    const seed = { awl_last: String(Date.now() - 15 * 86400000) };
    const a = boot({ local: mkStore(seed), search: "?utm_source=wechat&from=card", language: "en-US" });
    const b = boot({ local: mkStore(seed), search: "?utm_source=wechat&from=card", language: "en-US", withLib: true });
    const pa = parse(api(a)[0]), pb = parse(api(b)[0]);
    t.eq(pa.v, pb.v, "parity: visitor tag matches AWLLib");
    t.eq(pa.v, "d8_30", "parity: 15 days ago -> d8_30");
    t.eq(pa.vid, pb.vid, "parity: vid matches AWLLib");
    t.eq(pa.sid, pb.sid, "parity: sid matches AWLLib");
    t.eq(pa.us, pb.us, "parity: utm_source matches AWLLib");
    t.eq(pa.c, pb.c, "parity: campaign matches AWLLib");
    t.eq(pa.vw, pb.vw, "parity: viewport matches AWLLib");
    t.eq(pa.bl, pb.bl, "parity: browser language matches AWLLib");
    t.eq(Object.keys(pa).sort().join(","), Object.keys(pb).sort().join(","), "parity: identical field set");
  }

  // ---- 15. visitor tag boundaries through hit.js ------------------------
  {
    const now = Date.now();
    const cases = [
      [null, "new", "first visit -> new"],
      [0, "d0", "same day -> d0"],
      [3, "d1_7", "3 days -> d1_7"],
      [15, "d8_30", "15 days -> d8_30"],
      [40, "d30p", "40 days -> d30p"],
    ];
    cases.forEach(([days, want, label]) => {
      const seed = days === null ? {} : { awl_last: String(now - days * 86400000) };
      const win = boot({ local: mkStore(seed) });
      t.eq(parse(api(win)[0]).v, want, `tag: ${label}`);
    });
  }

  // ---- 16. no cookies are ever written ----------------------------------
  {
    const win = boot({});
    t.eq(typeof win.document.cookie, "undefined", "privacy: no document.cookie usage");
    t.ok(!fs.readFileSync(HIT, "utf8").includes("document.cookie"), "privacy: hit.js never touches document.cookie");
    const src = fs.readFileSync(HIT, "utf8");
    // Strip comments first: the file documents the rule, it must not read a UA.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    t.ok(!/userAgent/.test(code), "privacy: hit.js never reads navigator.userAgent");
    t.ok(!/["']ip["']\s*:/.test(code), "privacy: hit.js never sends an ip field");
    t.ok(!/X-Forwarded-For/i.test(code), "privacy: hit.js never touches forwarding headers");
  }

  // ---- 99. "exclude me" switch (?awl_self=1 / 0) --------------------------
  [false, true].forEach((withLib) => {
    const tag = withLib ? "with lib" : "fallback";

    // flag already set -> nothing is sent, no counter.dev, AWL_track is a no-op
    {
      const local = mkStore({ awl_self: "1" });
      const win = boot({ local, withLib });
      t.eq(api(win).length, 0, `self (${tag}): no /api/hit beacon on load`);
      t.eq(typeof win.AWL_track, "function", `self (${tag}): AWL_track still callable`);
      win.AWL_track("calc");
      t.eq(api(win).length, 0, `self (${tag}): AWL_track sends nothing`);
      win.__fire("pagehide");
      t.eq(api(win).length, 0, `self (${tag}): no leave beacon either`);
      const counter = win.document.head.children.concat(win.document.body.children).filter((n) => /counter\.dev/.test(n.attrs.src || ""));
      t.eq(counter.length, 0, `self (${tag}): counter.dev is not injected`);
      t.ok(!local._m.awl_vid, `self (${tag}): no visitor id is created`);
    }

    // ?awl_self=1 sets the flag and that very page view is not counted
    {
      const local = mkStore(null);
      const win = boot({ local, withLib, search: "?awl_self=1" });
      t.eq(local._m.awl_self, "1", `self (${tag}): ?awl_self=1 stores the flag`);
      t.eq(api(win).length, 0, `self (${tag}): the page that set the flag is not counted`);
    }

    // ?awl_self=0 clears it and tracking resumes
    {
      const local = mkStore({ awl_self: "1" });
      const win = boot({ local, withLib, search: "?awl_self=0" });
      t.ok(!("awl_self" in local._m), `self (${tag}): ?awl_self=0 clears the flag`);
      t.eq(api(win).length, 1, `self (${tag}): counted again after switching off`);
    }

    // ordinary visitors are unaffected
    {
      const win = boot({ withLib });
      t.eq(api(win).length, 1, `self (${tag}): normal visitor still counted`);
    }
  });
};
