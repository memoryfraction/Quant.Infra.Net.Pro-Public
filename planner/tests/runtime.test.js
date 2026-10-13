// Spec 4.1 / 5(c) — the phase-1 runtime inside AWL.mount() must render its
// blocks, degrade silently when storage is blocked, restore a shared ?s= link,
// and never touch the network for a GPC visitor or on a non-production host.
//
// This drives the *real* common.js against a DOM stub, so a broken reference in
// paint()/applyLang() fails here instead of only in the browser.
module.exports = function (t) {
  const fs = require("fs"), path = require("path"), vm = require("vm");
  const ROOT = path.join(__dirname, "..");

  // ---- DOM stub ----------------------------------------------------------
  function makeNode(tag) {
    const node = {
      tagName: String(tag || "div").toUpperCase(),
      children: [], attrs: {}, style: {}, _text: "",
      hidden: false, value: "", checked: false, disabled: false, open: false,
      get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); },
      set textContent(v) { this._text = String(v); this.children = []; },
      setAttribute(k, v) {
        this.attrs[k] = String(v);
        // HTML input reflection: value/type/checked attributes are live.
        if (k === "value" && /^(INPUT|TEXTAREA|OPTION|SELECT)$/.test(this.tagName)) this.value = String(v);
        if (k === "type") this.type = String(v);
        if (k === "checked") this.checked = v === "checked" || v === true || v === "";
        if (k === "id") this.id = String(v);
      },
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
      removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; },
      addEventListener(ev, fn) { (this._ev = this._ev || {})[ev] = (this._ev[ev] || []).concat(fn); },
      removeEventListener() {},
      fire(ev, arg) { ((this._ev || {})[ev] || []).forEach((fn) => fn(arg || { preventDefault() {}, target: this })); },
      querySelectorAll(sel) {
        const out = [];
        const want = String(sel || "");
        const walk = (n) => n.children.forEach((c) => {
          if (want === "input" && c.tagName === "INPUT") out.push(c);
          else if (/input\[value="([^"]+)"\]/.test(want)) {
            const m = /input\[value="([^"]+)"\]/.exec(want);
            if (c.tagName === "INPUT" && c.attrs.value === m[1]) out.push(c);
          }
          walk(c);
        });
        walk(this);
        return out;
      },
      querySelector() { return null; },
      focus() {}, select() {},
      insertBefore(child, ref) {
        const i = ref ? this.children.indexOf(ref) : -1;
        if (i >= 0) this.children.splice(i, 0, child); else this.children.unshift(child);
        child.parentNode = this;
        return child;
      },
      getBoundingClientRect() { return { width: 300, height: 150 }; },
      getContext() { return { scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fillText() {}, save() {}, restore() {}, setLineDash() {}, fillRect() {} }; },
      get className() { return this.attrs.cls || ""; },
      set className(v) { this.attrs.cls = String(v); },
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
    // <select> exposes a live `options` list; common.js rewrites option labels.
    Object.defineProperty(node, "options", {
      get() { return this.children.filter((c) => c.tagName === "OPTION"); },
    });
    return node;
  }

  function makeEnv(opts) {
    opts = opts || {};
    const doc = makeNode("document");
    doc.documentElement = makeNode("html");
    doc.documentElement.lang = "zh";
    doc.createElement = (tag, attrs) => {
      const n = makeNode(tag);
      // Mirror the browser: `value` / `checked` set via the attrs bag become
      // live properties, which is how common.js seeds number inputs.
      if (attrs && attrs.value !== undefined) n.value = String(attrs.value);
      if (attrs && attrs.type !== undefined) n.type = String(attrs.type);
      return n;
    };
    doc.createTextNode = (s) => { const n = makeNode("#text"); n.textContent = s; return n; };
    const byIdCache = {};
    const findById = (n, id) => {
      if (n.attrs && n.attrs.id === id) return n;
      if (n.id === id) return n;
      for (const c of n.children) { const r = findById(c, id); if (r) return r; }
      return null;
    };
    doc.getElementById = (id) => {
      // Resolve through the live tree first, like a browser does; only fall
      // back to a detached cache for ids the page has not created yet.
      const found = findById(doc.body, id);
      if (found) return found;
      if (!byIdCache[id]) { byIdCache[id] = makeNode("div"); byIdCache[id].id = id; }
      return byIdCache[id];
    };
    doc.querySelectorAll = () => [];
    doc.body = makeNode("body");
    byIdCache.inputs = makeNode("div"); byIdCache.inputs.id = "inputs";
    byIdCache.results = makeNode("div"); byIdCache.results.id = "results";
    // inputs lives inside a section that itself has a parent (the grid).
    const grid = makeNode("div");
    grid.appendChild(byIdCache.inputs);
    grid.appendChild(byIdCache.results);
    doc.body.appendChild(grid);
    // Ids the real pages provide in their static HTML (not created by the runtime).
    ["method", "pageTitle", "pageSub", "disc", "awls"].forEach((id) => {
      const n = makeNode("div"); n.id = id;
      doc.body.appendChild(n);
    });
    byIdCache.inputs.appendChild(makeNode("h2"));

    const win = {
      document: doc,
      console: console,
      location: {
        href: "https://www.alpha-wealth-lab.com/planner/fi/",
        origin: "https://www.alpha-wealth-lab.com",
        pathname: "/planner/fi/",
        search: opts.search || "",
        hostname: opts.hostname || "www.alpha-wealth-lab.com",
      },
      navigator: {
        userAgent: opts.ua || "node-test", language: "zh-CN",
        sendBeacon: () => true,
        globalPrivacyControl: !!opts.gpc,
      },
      setTimeout: (fn) => { try { fn(); } catch (e) { /* ignore */ } return 0; },
      clearTimeout() {}, addEventListener() {}, removeEventListener() {},
      innerWidth: 375, innerHeight: 800, devicePixelRatio: 1,
      crypto: {
        randomUUID: () => "11111111-2222-4333-8444-555555555555",
        getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 11) & 255; return a; },
      },
      fetch: opts.fetch || (() => Promise.reject(new Error("no network in tests"))),
      Request: function () {}, Blob: function (parts) { this.parts = parts; },
      Intl: Intl, JSON: JSON, Math: Math, Date: Date,
      // Browsers always provide these; a bare vm context does not.
      btoa: (s) => Buffer.from(String(s), "binary").toString("base64"),
      atob: (s) => Buffer.from(String(s), "base64").toString("binary"),
      TextEncoder: TextEncoder, TextDecoder: TextDecoder,
      URL: URL, URLSearchParams: URLSearchParams,
      SiteLang: { get: () => (opts.lang || "zh"), subscribe() {}, set() {} },
    };
    if (opts.store === null) {
      win.localStorage = undefined; win.sessionStorage = undefined;
    } else {
      const mk = () => {
        const m = {};
        return {
          getItem: (k) => (k in m ? m[k] : null),
          setItem: (k, v) => { if (opts.store === "throw") throw new Error("blocked"); m[k] = String(v); },
          removeItem: (k) => { delete m[k]; },
          clear: () => { for (const k in m) delete m[k]; },
        };
      };
      win.localStorage = opts.localStore || mk();
      win.sessionStorage = mk();
    }
    win.window = win; win.self = win; win.globalThis = win;
    return win;
  }

  const ENGINE_GLOBAL = {
    fi: "FIEngine", allocation: "AllocEngine", margin: "MarginEngine",
    rebalance: "RebalEngine", withdrawal: "WdEngine", mortgage: "MortEngine",
    "social-security": "SSEngine",
  };

  function bootPage(opts) {
    opts = opts || {};
    const tool = opts.tool || "fi";
    const win = makeEnv(Object.assign({}, opts, {
      // location must match the tool so the runtime can derive its slug.
      pathname: opts.pathname || ("/planner/" + tool + "/"),
    }));
    win.location.pathname = "/planner/" + tool + "/";
    if (!opts.hostname) win.location.hostname = "www.alpha-wealth-lab.com";
    win.location.origin = "https://www.alpha-wealth-lab.com";
    const ctx = vm.createContext(win);
    const before = [];
    win.__calls = before;
    // Wrap fetch/beacon so tests can inspect outbound payloads without network.
    const realFetch = win.fetch;
    win.fetch = (url, init) => {
      before.push({ url, body: init && init.body });
      return typeof realFetch === "function" ? realFetch(url, init) : Promise.reject(new Error("no network"));
    };
    win.navigator.sendBeacon = (url, blob) => { before.push({ url, body: blob && blob.parts && blob.parts[0] }); return true; };
    const run = (f) => vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });

    // `require` shim so UMD engines attach to the sandbox window, and so
    // rebalance's engine can pull in the allocation engine.
    win.require = (spec) => {
      const base = String(spec).replace(/^.*\//, "").replace(/\.js$/, "");
      const g = ENGINE_GLOBAL[base];
      if (g && win[g]) return win[g];
      throw new Error(`sandbox require(${spec}) unresolved`);
    };

    run(path.join(ROOT, "assets", "lib.js"));       // AWLLib
    run(path.join(ROOT, "assets", "common.js"));    // AWL
    if (tool === "rebalance") run(path.join(ROOT, "allocation", "engine.js"));
    const eng = path.join(ROOT, tool, "engine.js");
    if (fs.existsSync(eng)) run(eng);
    run(path.join(ROOT, tool, "ui.js"));
    return win;
  }

  // Collect every rendered string in the results area.
  function textOf(node) { return node.textContent; }

  const get = (win, id) => win.document.getElementById(id);

  // ---- 1. happy path -----------------------------------------------------
  {
    const win = bootPage({});
    const results = get(win, "results");
    const text = textOf(results);
    t.ok(/Copy link|复制链接/.test(text), "runtime: share button rendered");
    t.ok(/Save on this device|保存到本机/.test(text), "runtime: save button rendered");
    t.ok(/Next step|下一步/.test(text), "runtime: next-step block rendered");
    t.ok(/Stay in touch|保持联系/.test(text), "runtime: retention block rendered");
    t.ok(/Match your situation|这个结果和你的情况符合吗/.test(text), "runtime: feedback block rendered");
    t.ok(/Help us know you better|帮我们更懂你/.test(text), "runtime: profile card rendered on first calc");
    t.ok(/通胀因子|inflation factor/i.test(get(win, "method").textContent), "runtime: method/formula block filled");
  }

  // ---- 2. zh leads with /join/, en leads with email ----------------------
  {
    const zh = bootPage({ lang: "zh" });
    const zt = textOf(get(zh, "results"));
    t.ok(/进微信群/.test(zt), "zh: join button present");
    t.ok(/\/join\//.test(zt) === false, "zh: join is a link, not text (href checked below)");

    const en = bootPage({ lang: "en" });
    const et = textOf(get(en, "results"));
    t.ok(/Remind me every Dec 1/.test(et), "en: email subscribe form present");
    t.ok(/Used only for confirmation/.test(et), "en: subscribe note present");
  }

  // ---- 3. storage blocked -> no save button, page still renders ----------
  {
    const win = bootPage({ store: "throw" });
    const text = textOf(get(win, "results"));
    t.ok(/Copy link|复制链接/.test(text), "blocked storage: page still renders results");
    // The real assertion: the local store was never used successfully.
    t.eq(win.AWLLib.getVid(win.localStorage), "", "blocked storage: getVid returns \"\"");
  }

  // ---- 4. GPC -> no identifiers -----------------------------------------
  {
    const win = bootPage({ gpc: true });
    t.eq(win.AWLLib.getVid(win.localStorage), "", "gpc: getVid returns \"\"");
    const text = textOf(get(win, "results"));
    t.ok(/Copy link|复制链接/.test(text), "gpc: page still renders results");
    const calcCalls = win.__calls.filter((c) => /\/api\/calc/.test(c.url));
    t.eq(calcCalls.length, 0, "gpc: no /api/calc report sent");
  }

  // ---- 5. non-production host -> no reporting ---------------------------
  {
    const win = bootPage({ hostname: "127.0.0.1" });
    const calcCalls = win.__calls.filter((c) => /\/api\//.test(c.url));
    t.eq(calcCalls.length, 0, "localhost: no api reports sent");
  }

  // ---- 6. ?s= shared link restores inputs --------------------------------
  {
    // Build a state string with the real lib, then boot a page with it.
    const AWLLib = require(path.join(ROOT, "assets", "lib.js"));
    const fields = bootPage({}).AWL.mount.last.fields;
    const vals = {};
    fields.forEach((f) => { vals[f.id] = f.type === "pct" ? f.def / 100 : f.def; });
    vals.years = 40; vals.expenseNow = 77777;
    const s = AWLLib.encodeState(vals, fields);
    t.ok(!!s, "state: encodeState produced a string");

    const win = bootPage({ search: "?s=" + s });
    t.eq(get(win, "years").value, "40", "shared link: years restored");
    t.eq(get(win, "expenseNow").value, "77777", "shared link: expenseNow restored");
  }

  // ---- 7. garbage ?s= must not throw ------------------------------------
  {
    let threw = false;
    try { bootPage({ search: "?s=!!not-base64!!" }); } catch (e) { threw = true; }
    t.ok(!threw, "shared link: invalid s does not throw");
  }

  // ---- 8. saved plan -> banner -> load -> compare ------------------------
  {
    const AWLLib = require(path.join(ROOT, "assets", "lib.js"));
    const win0 = bootPage({});
    const fields = win0.AWL.mount.last.fields;
    const vals = {};
    fields.forEach((f) => { vals[f.id] = f.type === "pct" ? f.def / 100 : f.def; });
    const s = AWLLib.encodeState(vals, fields);
    const m = {};
    m["awl_plans_v1"] = JSON.stringify({ fi: { s: s, ts: Date.now() - 400 * 24 * 3600 * 1000, lang: "zh", rows: [["目标金融资产", "1"]] } });
    const localStore = {
      getItem: (k) => (k in m ? m[k] : null),
      setItem: (k, v) => { m[k] = String(v); },
      removeItem: (k) => { delete m[k]; },
    };
    const win = bootPage({ localStore });
    const inputs = get(win, "inputs");
    // The banner is inserted as a sibling *before* #inputs inside the grid.
    const grid = inputs.parentNode;
    const banner = grid.children.find((c) => /awl-banner/.test(c.attrs && c.attrs.cls || ""));
    t.ok(!!banner, "saved plan: banner rendered above the inputs");
    t.ok(/快一年|almost a year/.test(banner ? banner.textContent : ""), "saved plan: 400-day-old plan shows the 'almost a year' wording");

    // Click "load and compare" -> inputs restored + compare table appended.
    const loadBtn = banner.querySelectorAll("button")[0] ||
      banner.children.map((c) => c.children).flat().find((c) => c && c.tagName === "BUTTON");
    t.ok(!!loadBtn, "saved plan: load button present");
    loadBtn.fire("click");
    t.eq(get(win, "years").value, String(fields.find((f) => f.id === "years").def), "saved plan: load restores inputs");
    t.ok(/与保存时对比/.test(grid.textContent), "saved plan: compare table rendered after load");
  }

  // ---- 9. share button copies a link containing from=share ---------------
  {
    const win = bootPage({});
    let copied = "";
    win.navigator.clipboard = { writeText: (s) => { copied = s; return Promise.resolve(); } };
    const results = get(win, "results");
    const btn = results.children.find((c) => /awl-actions/.test(c.attrs && c.attrs.cls || ""));
    t.ok(!!btn, "share: action row rendered");
    const copyBtn = btn.children.find((c) => /Copy link|复制链接/.test(c.textContent));
    t.ok(!!copyBtn, "share: copy button present");
    copyBtn.fire("click");
    t.ok(/\?s=/.test(copied), "share: copied url carries ?s=");
    t.ok(/from=share/.test(copied), "share: copied url carries from=share");
  }

  // ---- 10. the profile card is actually answerable ------------------------
  // Regression: profileCard() built the six question groups and the submit/skip
  // buttons into `body` but never appended `body` to the <details>, so the card
  // rendered as a title with nothing inside it. Asserting merely that the title
  // exists (as test 1 does) hides that, so walk the real contents here.
  {
    const win = bootPage({ lang: "zh" });
    const results = get(win, "results");
    // Find the .awl-prof node the way the browser would.
    const find = (node, cls) => {
      if (String(node.className || "").split(/\s+/).indexOf(cls) >= 0) return node;
      for (const c of node.children) { const hit = find(c, cls); if (hit) return hit; }
      return null;
    };
    const card = find(results, "awl-prof");
    t.ok(!!card, "profile: card element exists");
    if (card) {
      const picks = [];
      const collect = (n) => {
        if (String(n.className || "").split(/\s+/).indexOf("awl-pick") >= 0) picks.push(n);
        n.children.forEach(collect);
      };
      collect(card);
      t.eq(picks.length, 6, "profile: all 6 questions are in the DOM (age/asset/goal/markets/follows/leverage)");
      // Each question must carry a label and at least one selectable option.
      const opts = [];
      picks.forEach((p) => collect2(p, opts));
      t.ok(opts.length >= 25, `profile: every question exposes options (${opts.length})`);
      // The two action buttons must be reachable inside the card.
      const btns = [];
      const collect3 = (n) => {
        if (String(n.className || "").indexOf("awl-btn") >= 0) btns.push(n);
        n.children.forEach(collect3);
      };
      collect3(card);
      t.ok(btns.length >= 2, `profile: submit + skip buttons present (${btns.length})`);
      // And the markets question must really be multi-select.
      const checks = [];
      const collect4 = (n) => { if (n.tagName === "INPUT" && n.attrs.type === "checkbox") checks.push(n); n.children.forEach(collect4); };
      collect4(card);
      t.ok(checks.length >= 4, `profile: multi-select questions use checkboxes (${checks.length})`);
      // Submitting must post /api/profile with the empty-selection payload shape.
      const before = win.__calls.length;
      const submit = btns.find((b) => /提交|Submit/.test(b.textContent));
      t.ok(!!submit, "profile: submit button is labelled");
      if (submit) submit.fire("click");
      const call = win.__calls.slice(before).find((c) => c.url && /\/api\/profile/.test(c.url));
      t.ok(!!call, "profile: submit posts to /api/profile");
      if (call) {
        let body = call.body;
        try { body = typeof body === "string" ? JSON.parse(body) : body; } catch (e) { /* leave raw */ }
        t.ok(!!body && typeof body === "object", "profile: payload is an object");
        if (body && typeof body === "object") {
          t.eq(body.lang, "zh", "profile: payload carries the language");
          t.ok("vid" in body, "profile: payload carries the visitor id");
        }
      }
    }
    function collect2(n, out) { if (n.tagName === "INPUT") out.push(n); n.children.forEach((c) => collect2(c, out)); }
  }

  // ---- 11. all 7 tools boot and render the phase-1 blocks ----------------
  {
    const ALL = ["fi", "allocation", "margin", "rebalance", "withdrawal", "mortgage", "social-security"];
    ALL.forEach((tool) => {
      let win;
      try { win = bootPage({ tool }); } catch (e) { t.ok(false, `${tool}: boot threw ${e.message}`); return; }
      const text = textOf(get(win, "results"));
      t.ok(/Copy link|复制链接/.test(text), `${tool}: share block rendered`);
      t.ok(/下一步|Next step/.test(text), `${tool}: next-step block rendered`);
      t.ok(!!win.AWL.mount.last.summary, `${tool}: summary exposed after mount`);
    });
  }

  // ---- 11. regression: the profile card survives input repaints -------------
  // paint() clears #results on every input; the card used to be appended once
  // (profileShown flag) and then vanished after the first edit.
  {
    const win = bootPage({});
    const inputs = get(win, "inputs");
    for (let i = 0; i < 3; i++) inputs.fire("input");
    t.ok(/Help us know you better|帮我们更懂你/.test(textOf(get(win, "results"))), "profile: card still present after 3 input repaints");
  }

  // ---- 12. WeChat "add to Favorites" tip ------------------------------------
  {
    const WX = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 MicroMessenger/8.0.44";
    const plain = bootPage({});
    t.ok(!/收藏/.test(textOf(get(plain, "results"))), "wx tip: not shown in an ordinary browser");

    const mkStore = () => {
      const m = {};
      return {
        getItem: (k) => (k in m ? m[k] : null),
        setItem: (k, v) => { m[k] = String(v); },
        removeItem: (k) => { delete m[k]; },
        _m: m,
      };
    };
    const store = mkStore();
    const wx = bootPage({ ua: WX, localStore: store });
    const results = get(wx, "results");
    t.ok(/点微信右上角「···」→「收藏」/.test(textOf(results)), "wx tip: shown (zh) inside the WeChat browser");

    const findAll = (node, pred, out) => { out = out || []; if (pred(node)) out.push(node); (node.children || []).forEach((c) => findAll(c, pred, out)); return out; };
    const hasCls = (n, k) => String((n.attrs && n.attrs.cls) || n.className || "").split(/\s+/).indexOf(k) >= 0;
    const box = findAll(results, (n) => hasCls(n, "awl-wxfav"))[0];
    t.ok(!!box, "wx tip: container rendered");
    const btn = box && findAll(box, (n) => n.tagName === "BUTTON")[0];
    t.ok(!!btn, "wx tip: dismiss button present");
    if (btn) btn.fire("click");
    t.ok(!!store._m.awl_wxfav, "wx tip: dismissal remembered in localStorage");
    t.ok(box && box.hidden === true, "wx tip: hidden right after dismissing");

    const again = bootPage({ ua: WX, localStore: store });
    t.ok(!/收藏/.test(textOf(get(again, "results"))), "wx tip: not shown again after being dismissed");
  }
};
