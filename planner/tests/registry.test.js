// Spec 4.4 — planner/registry.js is the single source of truth for the tool
// list. The hub renders from it, the tool pages read their "方法论参考" from it,
// and its shape must stay in sync with the pages that actually exist.
module.exports = function (t) {
  const fs = require("fs"), path = require("path"), vm = require("vm");
  const ROOT = path.join(__dirname, "..");

  // Load registry.js the same way a browser would.
  const win = { console };
  win.window = win;
  vm.runInContext(fs.readFileSync(path.join(ROOT, "registry.js"), "utf8"), vm.createContext(win), { filename: "registry.js" });

  const TOOLS = win.AWL_TOOLS;
  const TAG_IDS = win.AWL_TOOL_TAGS;
  const TAG_COPY = win.AWL_TAG_COPY;
  const COPY = win.AWL_REGISTRY_COPY;

  t.ok(Array.isArray(TOOLS), "registry: AWL_TOOLS is an array");
  t.ok(TOOLS && TOOLS.length >= 9, `registry: has at least 9 entries (${TOOLS && TOOLS.length})`);
  t.ok(Array.isArray(TAG_IDS) && TAG_IDS.length > 0, "registry: tag ids declared");
  t.ok(!!TAG_COPY && !!TAG_COPY.zh && !!TAG_COPY.en, "registry: tag copy is bilingual");
  t.ok(!!COPY && !!COPY.zh && !!COPY.en, "registry: copy is bilingual");

  t.eq(TAG_COPY.zh.all, "全部", "registry: zh 'all' label");
  t.eq(TAG_COPY.en.all, "All", "registry: en 'all' label");
  t.ok(/方法论参考/.test(COPY.zh.sourcePrefix), "registry: zh source prefix");
  t.ok(/Method source/.test(COPY.en.sourcePrefix), "registry: en source prefix");

  // The 7 planner tools must all be present, with a page on disk.
  const PLANNER = ["fi", "allocation", "margin", "rebalance", "withdrawal", "mortgage", "social-security"];
  PLANNER.forEach((slug) => {
    const e = TOOLS.find((x) => x.slug === slug);
    t.ok(!!e, `registry: ${slug} present`);
    if (!e) return;
    t.eq(e.href, `/planner/${slug}/`, `registry: ${slug} href`);
    t.ok(Array.isArray(e.en) && e.en.length === 2 && e.en[0] && e.en[1], `registry: ${slug} en [title,desc]`);
    t.ok(Array.isArray(e.zh) && e.zh.length === 2 && e.zh[0] && e.zh[1], `registry: ${slug} zh [title,desc]`);
    t.ok(!!e.source && typeof e.source.name === "string" && e.source.name.length > 0, `registry: ${slug} has a method source`);
    t.ok(["book", "video", "author"].indexOf(e.source.kind) >= 0, `registry: ${slug} source.kind whitelisted`);
    t.ok(!/\.(png|jpe?g|webp|gif)$/i.test(e.source.url || ""), `registry: ${slug} source.url is not cover art`);
    t.ok(fs.existsSync(path.join(ROOT, slug, "index.html")), `registry: ${slug} page exists on disk`);
  });

  // Slugs, hrefs and dictionary shapes must be unique and well formed.
  const slugs = {}, hrefs = {};
  TOOLS.forEach((x) => {
    t.ok(!slugs[x.slug], `registry: slug "${x.slug}" unique`);
    slugs[x.slug] = 1;
    t.ok(!hrefs[x.href], `registry: href "${x.href}" unique`);
    hrefs[x.href] = 1;
    t.ok(/^\/[a-z0-9-]+\/([a-z0-9-]+\/)?$/.test(x.href), `registry: href shape ${x.href}`);
    t.ok(/^[a-z0-9-]+$/.test(x.slug), `registry: slug shape ${x.slug}`);
  });

  // Every tag used by a tool must be a known tag with copy in both languages.
  TOOLS.forEach((x) => {
    t.ok(Array.isArray(x.tags), `registry: ${x.slug} has a tags array`);
    (x.tags || []).forEach((g) => {
      t.ok(TAG_IDS.indexOf(g) >= 0, `registry: ${x.slug} tag "${g}" is a declared tag id`);
      t.ok(typeof TAG_COPY.zh[g] === "string" && TAG_COPY.zh[g].length > 0, `registry: tag "${g}" has zh copy`);
      t.ok(typeof TAG_COPY.en[g] === "string" && TAG_COPY.en[g].length > 0, `registry: tag "${g}" has en copy`);
    });
  });

  // The two non-planner cards must stay on the hub.
  ["calculator", "macro"].forEach((slug) => {
    const e = TOOLS.find((x) => x.slug === slug);
    t.ok(!!e, `registry: ${slug} card kept on the hub`);
    if (e) t.ok(!e.source, `registry: ${slug} has no book source`);
  });

  // ---- hub.js renders from the registry ---------------------------------
  {
    const nodes = [];
    const mk = (tag) => {
      const n = {
        tagName: tag.toUpperCase(), children: [], attrs: {}, _text: "",
        get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); },
        set textContent(v) { this._text = String(v); this.children = []; },
        set className(v) { this.attrs.cls = String(v); },
        get className() { return this.attrs.cls || ""; },
        setAttribute(k, v) { this.attrs[k] = String(v); },
        getAttribute(k) { return this.attrs[k] || null; },
        appendChild(c) { this.children.push(c); return c; },
        addEventListener() {},
      };
      return n;
    };
    const byId = {};
    const doc = {
      createElement: mk,
      getElementById: (id) => (byId[id] = byId[id] || mk("div")),
      querySelectorAll: () => [],
      title: "",
    };
    byId.pageTitle = mk("h1"); byId.pageSub = mk("p"); byId.disc = mk("p");
    byId.cards = mk("div"); byId.filters = mk("div");
    const w = {
      document: doc, console,
      SiteLang: { get: () => "zh", subscribe() {} },
      AWL_TOOLS: TOOLS, AWL_AUTHORS: win.AWL_AUTHORS, AWL_TOOL_TAGS: TAG_IDS, AWL_TAG_COPY: TAG_COPY, AWL_REGISTRY_COPY: COPY,
    };
    w.window = w;
    vm.runInContext(fs.readFileSync(path.join(ROOT, "hub.js"), "utf8"), vm.createContext(w), { filename: "hub.js" });

    // Cards now sit inside one <section.agroup> per author; count real tool cards
    // (the dashed "coming soon" placeholder is not a tool).
    const all = [];
    (function walk(n) { (n.children || []).forEach((c) => { all.push(c); walk(c); }); })(byId.cards);
    const hasCls = (n, k) => String(n.className || "").split(/\s+/).indexOf(k) >= 0;
    const cards = all.filter((n) => hasCls(n, "card") && !hasCls(n, "soon"));
    t.eq(cards.length, TOOLS.length, "hub: renders one card per registry entry");
    t.eq(all.filter((n) => hasCls(n, "agroup")).length, 4, "hub: 4 author groups (clec, silicon_valley, mine, beiban-soon)");
    t.eq(all.filter((n) => hasCls(n, "card") && hasCls(n, "soon")).length, 1, "hub: one coming-soon placeholder (beiban)");
    const text = byId.cards.textContent;
    PLANNER.forEach((slug) => {
      const e = TOOLS.find((x) => x.slug === slug);
      t.ok(text.indexOf(e.zh[0]) >= 0, `hub: card title for ${slug}`);
      t.ok(text.indexOf(e.source.name) >= 0, `hub: "${e.source.name}" shown on the ${slug} card`);
    });
    t.ok(/方法论参考/.test(text), "hub: attribution prefix rendered in zh");
    t.ok(/全部/.test(byId.filters.textContent), "hub: tag filter rendered");
  }

  // ---- author classification -------------------------------------------------
  const AUTHORS = win.AWL_AUTHORS;
  t.ok(Array.isArray(AUTHORS) && AUTHORS.length >= 4, "authors: AWL_AUTHORS declared");
  const aid = {};
  AUTHORS.forEach((a) => {
    t.ok(!aid[a.id], `authors: id "${a.id}" unique`); aid[a.id] = 1;
    t.ok(a.en && a.zh && a.descEn && a.descZh, `authors: ${a.id} has bilingual name + description`);
  });
  t.ok(AUTHORS.some((a) => a.id === "beiban" && a.soon), "authors: beiban is a coming-soon group");
  t.ok(AUTHORS.some((a) => a.id === "adam_khoo" && a.hidden), "authors: adam_khoo is reserved and hidden");
  TOOLS.forEach((x) => t.ok(!!aid[x.author], `authors: ${x.slug} has a known author (${x.author})`));
  // Attribution must match the book each method comes from.
  const EXPECT = { fi: "silicon_valley", mortgage: "silicon_valley", "social-security": "silicon_valley",
    allocation: "clec", margin: "clec", rebalance: "clec", withdrawal: "clec", calculator: "mine", macro: "mine" };
  Object.keys(EXPECT).forEach((slug) => {
    const e = TOOLS.find((x) => x.slug === slug);
    t.eq(e && e.author, EXPECT[slug], `authors: ${slug} belongs to ${EXPECT[slug]}`);
  });
  ["allocation", "margin", "rebalance", "withdrawal"].forEach((slug) => {
    const e = TOOLS.find((x) => x.slug === slug);
    t.ok(/CLEC/.test(e.source.name), `authors: ${slug} source names CLEC`);
  });
  ["fi", "mortgage", "social-security"].forEach((slug) => {
    const e = TOOLS.find((x) => x.slug === slug);
    t.ok(/硅谷居士|Wealth Shortcut/.test(e.source.name), `authors: ${slug} source names 硅谷居士`);
  });
};
