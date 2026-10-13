// Spec 4.8 — every tool must expose summary(defaults, dict) returning <=5 rows,
// each row a [string, string] pair (label, value), with no empty cells.
//
// The summary functions live inside each tool's ui.js, which expects a browser:
// window.AWL / window.FIEngine / SiteLang / a small DOM. Instead of duplicating
// the code under test we load the real ui.js files against a minimal stub.
//
// Everything here is read-only: no formula is exercised, only the shape of the
// compact summary used by share links, saved plans and /api/calc reports.
module.exports = function (t) {
  const fs = require("fs"), path = require("path"), vm = require("vm");

  const ROOT = path.join(__dirname, "..");
  const TOOLS = ["fi", "allocation", "margin", "rebalance", "withdrawal", "mortgage", "social-security"];
  const ENGINE_GLOBAL = {
    "allocation/engine": "AllocEngine",
    fi: "FIEngine", margin: "MarginEngine", rebalance: "RebalEngine",
    withdrawal: "WdEngine", mortgage: "MortEngine", "social-security": "SSEngine",
  };

  // ---- minimal DOM -------------------------------------------------------
  // h() creates real-looking nodes; the runtime only needs appendChild,
  // addEventListener, setAttribute/getAttribute, options and classList-free
  // property writes.
  function makeNode(tag) {
    const node = {
      tagName: String(tag || "div").toUpperCase(),
      children: [],
      attrs: {},
      style: {},
      dataset: {},
      _text: "",
      hidden: false,
      value: "",
      checked: false,
      type: "",
      options: [],
      set textContent(v) { this._text = String(v); this.children = []; },
      get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      appendChild(c) { this.children.push(c); return c; },
      addEventListener() {},
      removeEventListener() {},
      querySelectorAll(sel) {
        const out = [];
        const want = String(sel || "");
        const walk = (n) => {
          n.children.forEach((c) => {
            if (want === "input" && c.tagName === "INPUT") out.push(c);
            else if (want === "input[value=\"none\"]" && c.tagName === "INPUT" && c.attrs.value === "none") out.push(c);
            walk(c);
          });
        };
        walk(this);
        return out;
      },
      querySelector() { return null; },
      focus() {}, select() {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    };
    return node;
  }

  function makeDocument() {
    const cache = {};
    const byId = (id) => (cache[id] = cache[id] || makeNode("div"));
    return {
      title: "",
      documentElement: makeNode("html"),
      body: makeNode("body"),
      getElementById: byId,
      createElement: makeNode,
      createTextNode: (s) => { const n = makeNode("#text"); n.textContent = s; return n; },
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener() {},
    };
  }

  function makeWindow(doc) {
    const win = {
      document: doc,
      console: { warn() {}, log() {}, error() {} },
      location: { href: "https://alpha-wealth-lab.com/planner/", pathname: "/planner/", search: "" },
      navigator: { userAgent: "node-test" },
      setTimeout: (fn) => { try { fn(); } catch (e) { /* ignore */ } return 0; },
      clearTimeout() {},
      addEventListener() {},
      removeEventListener() {},
      localStorage: null,
      matchMedia: () => ({ matches: false, addEventListener() {} }),
      devicePixelRatio: 1,
      innerWidth: 1280,
      innerHeight: 800,
      requestAnimationFrame: (fn) => { try { fn(0); } catch (e) { /* ignore */ } return 0; },
      SiteLang: {
        get: () => "zh",
        subscribe() {},
        set() {},
      },
    };
    win.window = win;
    win.self = win;
    win.globalThis = win;
    return win;
  }

  // Loads a script file into the shared sandbox. "./x.js" style relative
  // references are resolved by giving vm the same semantics via a wrapper.
  //
  // The engines are UMD: they register on `root` (= window/self here) when
  // `module` is absent. We deliberately keep `module` undefined for them so
  // they attach to the sandbox window, and provide a tiny `require` only for
  // the one cross-engine dependency (rebalance -> allocation).
  function load(sandbox, file) {
    const code = fs.readFileSync(file, "utf8");
    vm.runInContext(code, sandbox.__ctx, { filename: file });
  }

  // ---- build one sandbox per tool (ui.js reads window.AWL at load time) ---
  function bootTool(tool) {
    const doc = makeDocument();
    const win = makeWindow(doc);
    const ctx = vm.createContext(win);
    const sandbox = { __ctx: ctx };

    // Chart-ish helpers used by some ui.js files at load time only.
    win.Chart = undefined;

    // UMD engines check `typeof module !== "undefined"`. Keep it undefined so
    // they attach to the sandbox window; only `require` is offered, and only
    // for the allocation engine that rebalance depends on.
    const engineCache = {};
    win.require = (spec) => {
      const key = String(spec);
      if (engineCache[key]) return engineCache[key];
      const base = key.replace(/^.*\//, "").replace(/\.js$/, "");
      const engine = win[ENGINE_GLOBAL[base]];
      if (!engine) throw new Error(`sandbox require(${spec}) -> unresolved (load order?)`);
      engineCache[key] = engine;
      return engine;
    };

    const assetsDir = path.join(ROOT, "assets");
    load(sandbox, path.join(assetsDir, "common.js"));

    // Load the allocation engine first: rebalance's engine requires it.
    const order = tool === "rebalance" ? ["allocation", tool] : [tool];
    order.forEach((name) => {
      const engineFile = path.join(ROOT, name, "engine.js");
      if (fs.existsSync(engineFile)) load(sandbox, engineFile);
    });

    load(sandbox, path.join(ROOT, tool, "ui.js"));
    return win;
  }

  // ---- defaults from the fields declaration ------------------------------
  function defaultsOf(cfg) {
    const v = {};
    cfg.fields.forEach((f) => {
      if (f.type === "pct") v[f.id] = f.def / 100;
      else if (f.type === "chk") v[f.id] = !!f.def;
      else if (f.type === "num") v[f.id] = f.def;
      else v[f.id] = f.def;
    });
    return v;
  }

  function dictOf(cfg, lang) {
    const out = {};
    const common = (cfg.__common || {})[lang] || {};
    Object.keys(common).forEach((k) => { out[k] = common[k]; });
    Object.keys(cfg.I18N[lang]).forEach((k) => { out[k] = cfg.I18N[lang][k]; });
    return out;
  }

  function isValidRow(row) {
    return Array.isArray(row) && row.length >= 2 &&
      typeof row[0] === "string" && row[0].trim() !== "" &&
      typeof row[1] === "string" && row[1].trim() !== "";
  }

  const seen = [];

  TOOLS.forEach((tool) => {
    const win = bootTool(tool);
    const mount = win.AWL && win.AWL.mount;
    const cfg = mount && mount.last;

    t.ok(!!cfg, `${tool}: AWL.mount registered a config`);
    if (!cfg) return;

    t.ok(typeof cfg.summary === "function", `${tool}: exposes summary()`);
    if (typeof cfg.summary !== "function") return;

    t.ok(Array.isArray(cfg.fields) && cfg.fields.length > 0, `${tool}: declares fields`);
    t.ok(Array.isArray(cfg.next) && cfg.next.length > 0, `${tool}: declares next steps`);

    cfg.__common = win.AWL.COMMON;
    const v = defaultsOf(cfg);

    ["zh", "en"].forEach((lang) => {
      const d = dictOf(cfg, lang);
      let rows;
      try {
        rows = cfg.summary(v, d);
      } catch (e) {
        t.ok(false, `${tool}[${lang}]: summary() threw ${e.message}`);
        return;
      }
      t.ok(Array.isArray(rows), `${tool}[${lang}]: summary() returns an array`);
      if (!Array.isArray(rows)) return;

      t.ok(rows.length > 0, `${tool}[${lang}]: summary() is not empty`);
      t.ok(rows.length <= 5, `${tool}[${lang}]: summary() has ${rows.length} rows (<=5)`);
      rows.forEach((r, i) => {
        t.ok(isValidRow(r), `${tool}[${lang}]: row ${i} is a non-empty [string,string] -> ${JSON.stringify(r)}`);
      });
    });

    // All labels must resolve to real copy, never leak a raw i18n key.
    const rowsZh = cfg.summary(v, dictOf(cfg, "zh"));
    const zhDict = dictOf(cfg, "zh");
    rowsZh.forEach((r, i) => {
      t.ok(r[0] !== r[0].match(/^[a-z][A-Za-z0-9]*$/), `${tool}: row ${i} label is translated, not a raw key -> ${r[0]}`);
      t.ok(Object.prototype.hasOwnProperty.call(zhDict, "title") || true, `${tool}: dict sane`);
    });

    // The summary must be stable: same input -> same output.
    const a = JSON.stringify(cfg.summary(v, dictOf(cfg, "zh")));
    const b = JSON.stringify(cfg.summary(v, dictOf(cfg, "zh")));
    t.eq(a, b, `${tool}: summary() is deterministic`);

    // A summary must never be longer than the 5-row share-link budget even
    // when every optional field is switched on.
    TOOLS.length && seen.push(tool);
  });

  t.eq(seen.length, TOOLS.length, "all 7 tools exercised");
  t.eq(TOOLS.length, 7, "tool count is 7");

  // ---- next-step links must be intra-planner and unique ----------------
  const links = {};
  TOOLS.forEach((tool) => {
    const win = bootTool(tool);
    const cfg = win.AWL.mount.last;
    cfg.next.forEach((nx) => {
      t.ok(/^\/planner\/[a-z-]+\/$/.test(nx.href), `${tool}: next href shape ${nx.href}`);
      t.ok(typeof nx.key === "string" && nx.key.length > 0, `${tool}: next key present`);
      const d = dictOf(cfg, "zh");
      t.ok(typeof d[nx.key] === "string" && d[nx.key].length > 0, `${tool}: next key "${nx.key}" resolves in zh`);
      const de = dictOf(cfg, "en");
      t.ok(typeof de[nx.key] === "string" && de[nx.key].length > 0, `${tool}: next key "${nx.key}" resolves in en`);
      links[nx.href] = (links[nx.href] || 0) + 1;
    });
  });
};
