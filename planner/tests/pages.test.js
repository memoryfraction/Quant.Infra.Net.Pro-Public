// Spec 4.6 — the four new pages: /planner/subscribed/, /join/, /terms/, /privacy/.
//
// Two kinds of assertion here:
//   * static  — the HTML/JS on disk says what the spec requires (copy, robots, links, no inline script)
//   * dynamic — the small scripts actually pick the right branch (subscribed.js) and the privacy
//               identifier control actually reads/writes through AWLLib (privacy.js)
module.exports = function (t) {
  const fs = require("fs"), path = require("path"), vm = require("vm");
  const ROOT = path.join(__dirname, "..", "..");
  const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

  // ------------------------------------------------------------------ files exist
  const PAGES = ["planner/subscribed/index.html", "join/index.html", "terms/index.html", "privacy/index.html"];
  PAGES.forEach((p) => t.ok(fs.existsSync(path.join(ROOT, p)), `page exists: ${p}`));
  ["assets/join/official.png", "assets/join/group.png", "assets/join/README.md",
   "planner/subscribed/subscribed.js", "privacy/privacy.js", "css/pages.css"].forEach((p) =>
    t.ok(fs.existsSync(path.join(ROOT, p)), `asset exists: ${p}`));

  // PNGs must be real PNGs (magic bytes), not empty placeholders.
  ["assets/join/official.png", "assets/join/group.png"].forEach((p) => {
    const b = fs.readFileSync(path.join(ROOT, p));
    t.eq(b.slice(0, 8).toString("hex"), "89504e470d0a1a0a", `${p} is a real PNG`);
    t.ok(b.length > 4000, `${p} has real content (${b.length} bytes)`);
  });

  // ------------------------------------------------------------------ /terms/
  const terms = read("terms/index.html");
  t.ok(/<html lang="en"/.test(terms), "terms: defaults to en");
  t.ok(/site-lang\.js/.test(terms), "terms: loads SiteLang");
  t.ok(/\/assets\/hit\.js/.test(terms), "terms: loads the site tracker");
  t.ok(/name="robots" content="index,follow"/.test(terms), "terms: indexable");
  // §④ is the legally important clause — its wording must survive verbatim.
  t.ok(/By using this site you agree that we may collect, use and analyse your usage data/.test(terms),
    "terms: en §4 consent wording");
  t.ok(/使用本站即表示你同意我们按/.test(terms), "terms: zh §4 consent wording");
  t.ok(/commercial partnerships/.test(terms) && /去标识化\/汇总后用于商业合作/.test(terms),
    "terms: §4 mentions aggregated commercial use in both languages");
  // §① no-advice, §② no-affiliation, §⑤ as-is, §⑥ changes, §⑦ contact
  t.ok(/not provide investment, tax, legal or accounting advice/.test(terms), "terms: en §1 not advice");
  t.ok(/不提供投资、税务、法律或会计建议/.test(terms), "terms: zh §1 not advice");
  t.ok(/not affiliated with, endorsed by/.test(terms), "terms: en §2 no affiliation");
  t.ok(/无关联、未获其背书/.test(terms), "terms: zh §2 no affiliation");
  t.ok(/"as is"/.test(terms) && /「现状」/.test(terms), "terms: as-is in both languages");
  t.ok(/do not scrape, crawl, bulk-download/i.test(terms) && /不得抓取、爬取、批量下载/.test(terms),
    "terms: §3 acceptable use in both languages");
  t.ok(/alphawealthlab@outlook\.com/.test(terms), "terms: contact email");
  // §⑦ jurisdiction must be LEFT BLANK on purpose (spec: do not assume).
  t.ok(/left blank pending review/.test(terms), "terms: en jurisdiction left blank for the owner/lawyer");
  t.ok(/有意留空/.test(terms), "terms: zh jurisdiction left blank");
  t.ok(!/governed by the laws of/i.test(terms), "terms: does NOT invent a governing law");
  // Language blocks must actually differ (not a copy-paste of one language).
  t.ok(/class="l-en"/.test(terms) && /class="l-zh"/.test(terms), "terms: has both language blocks");

  // ------------------------------------------------------------------ /privacy/
  const priv = read("privacy/index.html");
  t.ok(/name="robots" content="index,follow"/.test(priv), "privacy: indexable");
  t.ok(/<!-- ===================== 中文 ===================== -->/.test(priv) ||
       /我们收集什么/.test(priv), "privacy: has zh content");
  // Every spec-mandated disclosure.
  t.ok(/dwell time in milliseconds/.test(priv), "privacy: dwell time disclosed");
  t.ok(/maximum scroll depth/.test(priv), "privacy: scroll depth disclosed");
  t.ok(/utm_source/.test(priv) && /utm_medium/.test(priv) && /utm_campaign/.test(priv), "privacy: utm params disclosed");
  t.ok(/WeChat in-app browser/.test(priv), "privacy: wechat browser disclosed");
  t.ok(/We do not store your raw IP address/.test(priv), "privacy: raw IP not stored (en)");
  t.ok(/我们不保存你的原始 IP 地址/.test(priv), "privacy: raw IP not stored (zh)");
  t.ok(/HMAC-SHA256/.test(priv) && /salted hash/.test(priv), "privacy: explains the salted hash");
  t.ok(/random visitor identifier and a session identifier/.test(priv), "privacy: anonymous ids disclosed");
  t.ok(/We do <strong>not<\/strong> use cookies/.test(priv) || /不使用 cookie/.test(priv), "privacy: no cookies");
  ["Cloudflare", "GitHub Pages", "counter.dev", "Brevo"].forEach((v) =>
    t.ok(priv.indexOf(v) >= 0, `privacy: third party listed — ${v}`));
  t.ok(/de-identified or aggregated/.test(priv) && /去标识化或汇总后/.test(priv), "privacy: sharing is aggregated");
  t.ok(/not sell/.test(priv) && /不会出售/.test(priv), "privacy: no sale of identifiable info");
  t.ok(/24 months/.test(priv) && /30 days/.test(priv), "privacy: retention 24 months / 30 days");
  t.ok(/globalPrivacyControl/.test(priv), "privacy: GPC described");
  t.ok(/Global Privacy Control/.test(priv), "privacy: GPC named in en");
  t.ok(/全局隐私控制/.test(priv), "privacy: GPC named in zh");
  // The Settings block: show id + copy + reset (spec 4.6 final sentence).
  t.ok(/id="vidOut"/.test(priv), "privacy: identifier output control");
  t.ok(/id="vidCopy"/.test(priv) && /id="vidCopyZh"/.test(priv), "privacy: copy buttons");
  t.ok(/id="vidReset"/.test(priv) && /id="vidResetZh"/.test(priv), "privacy: reset buttons");
  t.ok(/readonly/.test(priv), "privacy: identifier field is readonly");
  t.ok(/aria-live="polite"/.test(priv), "privacy: status messages are announced");

  // ------------------------------------------------------------------ /join/
  const join = read("join/index.html");
  t.ok(/name="robots" content="noindex,nofollow"/.test(join), "join: noindex,nofollow");
  t.ok(/加 入 我 们/.test(join.replace(/<[^>]+>/g, "")) || /加入我们/.test(join), "join: zh title 加入我们");
  t.ok(/Join us/i.test(join), "join: en title");
  t.ok(/assets\/join\/official\.png/.test(join), "join: official account image");
  t.ok(/assets\/join\/group\.png/.test(join), "join: group image");
  t.ok(/关注公众号/.test(join), "join: zh 关注公众号 block");
  t.ok(/进微信群/.test(join), "join: zh 进微信群 block");
  // The expired-QR fallback the spec asks for, verbatim in meaning.
  t.ok(/二维码过期了？发邮件到/.test(join), "join: expired-QR fallback in zh");
  t.ok(/alphawealthlab@outlook\.com/.test(join), "join: fallback email present");
  t.ok(/href="\/terms\/"/.test(join) && /href="\/privacy\/"/.test(join), "join: links to terms + privacy");

  // ------------------------------------------------------------------ robots.txt + sitemap
  const robots = read("robots.txt");
  t.ok(/Disallow: \/join\//.test(robots), "robots: /join/ disallowed");
  t.ok(/Disallow: \/stats\//.test(robots), "robots: /stats/ still disallowed");
  const sitemap = read("sitemap.xml");
  t.ok(/alpha-wealth-lab\.com\/terms\//.test(sitemap), "sitemap: includes /terms/");
  t.ok(/alpha-wealth-lab\.com\/privacy\//.test(sitemap), "sitemap: includes /privacy/");
  t.ok(!/planner\/subscribed/.test(sitemap), "sitemap: excludes /planner/subscribed/");
  t.ok(!/com\/join\//.test(sitemap), "sitemap: excludes /join/");

  // ------------------------------------------------------------------ footers everywhere
  const FOOTERS = [
    "index.html", "ebook.html", "mcp.html", "changelog.html",
    "planner/index.html", "planner/fi/index.html", "planner/allocation/index.html",
    "planner/margin/index.html", "planner/rebalance/index.html", "planner/withdrawal/index.html",
    "planner/mortgage/index.html", "planner/social-security/index.html"
  ];
  FOOTERS.forEach((p) => {
    const s = read(p);
    t.ok(/href="(\.\/|\/)terms\/"/.test(s), `footer: ${p} links to /terms/`);
    t.ok(/href="(\.\/|\/)privacy\/"/.test(s), `footer: ${p} links to /privacy/`);
  });

  // ------------------------------------------------------------------ no inline script anywhere new
  [...PAGES].forEach((p) => {
    const s = read(p);
    t.ok(!/<script(?![^>]*\ssrc=)[^>]*>[\s\S]*?<\/script>/.test(s), `${p}: no inline <script> with a body`);
    t.ok(!/\son[a-z]+\s*=/i.test(s.replace(/<!--[\s\S]*?-->/g, "")), `${p}: no inline event attributes`);
    t.ok(!/\sstyle="/.test(s), `${p}: no style= attributes (CSP)`);
    t.ok(!/\beval\s*\(/.test(s), `${p}: no eval`);
  });

  // ==================================================================== dynamic: subscribed.js
  // Minimal DOM stub — only what subscribed.js touches.
  function makeDoc(ids) {
    const nodes = {};
    ids.forEach((id) => {
      nodes[id] = {
        id, attrs: {}, hidden: false, textContent: "",
        setAttribute(k, v) { this.attrs[k] = v; },
        removeAttribute(k) { delete this.attrs[k]; }
      };
    });
    const h1 = {
      querySelector: function (sel) {
        if (sel === ".l-en") return { textContent: "" };
        if (sel === ".l-zh") return { textContent: "" };
        return null;
      }
    };
    return {
      _nodes: nodes, _h1: h1,
      documentElement: { lang: "en" },
      title: "",
      readyState: "complete",
      getElementById: (id) => nodes[id] || null,
      querySelector: (sel) => (sel === "h1" ? h1 : null),
      addEventListener: () => {}
    };
  }
  function runSubscribed(search) {
    const CASES = ["caseOk", "caseBad", "caseUnsub", "caseNone"];
    const doc = makeDoc(CASES);
    // HTML starts every card with the `hidden` attribute; mirror that + the attribute API the
    // script uses (setAttribute/removeAttribute), and derive visibility from it.
    CASES.forEach((c) => { doc._nodes[c].attrs.hidden = ""; });
    const win = {
      console,
      document: doc,
      Location: { search: search },
      location: { search: search, hostname: "www.alpha-wealth-lab.com" },
      URLSearchParams: URLSearchParams,
      SiteLang: { get: () => "en", subscribe: () => {} },
      addEventListener: () => {}
    };
    win.window = win;
    const src = fs.readFileSync(path.join(ROOT, "planner", "subscribed", "subscribed.js"), "utf8");
    vm.runInContext(src, vm.createContext(win), { filename: "subscribed.js" });
    return CASES.filter((c) => !("hidden" in doc._nodes[c].attrs));
  }

  t.eq(runSubscribed("?ok=1").join(","), "caseOk", "subscribed: ?ok=1 -> confirmed");
  t.eq(runSubscribed("?ok=0").join(","), "caseBad", "subscribed: ?ok=0 -> invalid link");
  t.eq(runSubscribed("?unsub=1").join(","), "caseUnsub", "subscribed: ?unsub=1 -> unsubscribed");
  t.eq(runSubscribed("").join(","), "caseNone", "subscribed: no params -> neutral card");
  t.eq(runSubscribed("?foo=bar").join(","), "caseNone", "subscribed: unknown params -> neutral card");
  t.eq(runSubscribed("?ok=2").join(","), "caseNone", "subscribed: ?ok=2 (out of range) -> neutral card");
  t.eq(runSubscribed("?unsub=0").join(","), "caseNone", "subscribed: ?unsub=0 -> neutral card");
  // An unsubscribe must win over a stale ok=1 left in the URL by a mail client.
  t.eq(runSubscribed("?ok=1&unsub=1").join(","), "caseUnsub", "subscribed: unsub beats stale ok=1");
  t.eq(runSubscribed("?ok=0&unsub=1").join(","), "caseUnsub", "subscribed: unsub beats failed ok");
  // Never crash on a hostile query string.
  ["?ok=1&ok=0", "?unsub=%31", "?%", "?ok=1#frag"].forEach((q) => {
    let threw = null, res = null;
    try { res = runSubscribed(q); } catch (e) { threw = e; }
    t.ok(!threw, `subscribed: does not throw on "${q}"${threw ? " — " + threw.message : ""}`);
    if (res) t.eq(res.length, 1, `subscribed: exactly one card shown for "${q}"`);
  });

  // Exactly one card is visible for a valid case too.
  t.eq(runSubscribed("?ok=1").length, 1, "subscribed: exactly one card visible");

  // ==================================================================== dynamic: privacy.js
  function runPrivacy(setup) {
    const ids = ["vidOut", "vidCopy", "vidReset", "vidMsg", "vidOutZh", "vidCopyZh", "vidResetZh", "vidMsgZh"];
    const nodes = {};
    ids.forEach((id) => {
      nodes[id] = {
        id, value: "", textContent: "", hidden: false, disabled: false, _listeners: {},
        addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
        dispatch(ev) { (this._listeners[ev] || []).forEach((f) => f({ type: ev })); },
        setAttribute() {}, removeAttribute() {},
        querySelectorAll() { return []; }
      };
    });
    const doc = {
      _nodes: nodes,
      documentElement: { lang: "en" },
      readyState: "complete",
      getElementById: (id) => nodes[id] || null,
      createElement: () => ({ value: "", className: "", setAttribute() {}, removeAttribute() {}, select() {} }),
      body: { appendChild() {}, removeChild() {} },
      addEventListener: () => {}
    };
    const store = setup.store || {};
    const win = {
      console,
      document: doc,
      navigator: setup.navigator || {},
      localStorage: store,
      sessionStorage: setup.session || {},
      AWLLib: setup.lib,
      SiteLang: { get: () => "en", subscribe: () => {} },
      setTimeout: (fn) => { return 1; },   // never fire the "copied" auto-reset
      clearTimeout: () => {},
      addEventListener: () => {}
    };
    win.window = win;
    const src = fs.readFileSync(path.join(ROOT, "privacy", "privacy.js"), "utf8");
    vm.runInContext(src, vm.createContext(win), { filename: "privacy.js" });
    return { nodes, store, win };
  }

  // A tiny AWLLib stand-in that mirrors the real contract ("" when GPC or no storage).
  function libStub(opts) {
    return {
      getVid: function (s) {
        if (opts.gpc) return "";
        try { return s.getItem("awl_vid") || ""; } catch (e) { return ""; }
      },
      getSid: function (s) {
        if (opts.gpc) return "";
        try { return s.getItem("awl_sid") || ""; } catch (e) { return ""; }
      }
    };
  }
  function memStore(initial) {
    const m = Object.assign({}, initial);
    return {
      _m: m,
      getItem: (k) => (k in m ? m[k] : null),
      setItem: (k, v) => { m[k] = String(v); },
      removeItem: (k) => { delete m[k]; }
    };
  }

  // (a) a stored identifier is shown, not invented
  {
    const store = memStore({ awl_vid: "abcdefgh-1234-5678-90ab-cdef01234567" });
    const r = runPrivacy({ lib: libStub({}), store, navigator: {} });
    r.nodes.vidOut.value; // (touch)
    t.eq(r.nodes.vidOut.value, "abcdefgh-1234-5678-90ab-cdef01234567", "privacy: shows the stored vid");
    t.eq(r.nodes.vidCopy.disabled, false, "privacy: copy enabled when a vid exists");
    t.eq(r.nodes.vidReset.disabled, false, "privacy: reset enabled when storage works");
    t.eq(r.nodes.vidMsg.textContent, "", "privacy: no message in the normal case");
  }

  // (b) nothing stored -> empty field, copy disabled, explanatory message
  {
    const r = runPrivacy({ lib: libStub({}), store: memStore({}), navigator: {} });
    t.eq(r.nodes.vidOut.value, "", "privacy: empty when no vid yet");
    t.eq(r.nodes.vidCopy.disabled, true, "privacy: copy disabled with no vid");
    t.ok(/No identifier yet/.test(r.nodes.vidMsg.textContent), "privacy: explains there is no vid yet");
  }

  // (c) GPC -> no id shown at all, and the reason is spelled out
  {
    const r = runPrivacy({
      lib: libStub({ gpc: true }), store: memStore({ awl_vid: "shouldnotshow-0000-0000-0000-000000000000" }),
      navigator: { globalPrivacyControl: true }
    });
    t.eq(r.nodes.vidOut.value, "", "privacy: GPC -> no identifier displayed");
    t.eq(r.nodes.vidCopy.disabled, true, "privacy: GPC -> copy disabled");
    t.ok(/Global Privacy Control/.test(r.nodes.vidMsg.textContent), "privacy: GPC reason shown");
  }

  // (d) storage blocked -> says so, reset disabled
  {
    const blocked = {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("blocked"); },
      removeItem() { throw new Error("blocked"); }
    };
    const r = runPrivacy({ lib: libStub({}), store: blocked, navigator: {} });
    t.eq(r.nodes.vidOut.value, "", "privacy: blocked storage -> no value");
    t.eq(r.nodes.vidReset.disabled, true, "privacy: blocked storage -> reset disabled");
    t.ok(/blocks local storage/.test(r.nodes.vidMsg.textContent), "privacy: blocked-storage reason shown");
  }

  // (e) reset actually clears the keys the tracker uses
  {
    const store = memStore({
      awl_vid: "abcdefgh-1234-5678-90ab-cdef01234567",
      awl_sid: "sid-sid-sid-sid-sid-sid",
      awl_last: "1700000000000",
      keep: "untouched"
    });
    const sess = memStore({ awl_sid: "sid-sid-sid-sid-sid-sid" });
    const r = runPrivacy({ lib: libStub({}), store, session: sess, navigator: {} });
    r.nodes.vidReset.dispatch("click");
    t.eq(store.getItem("awl_vid"), null, "privacy: reset removes awl_vid");
    t.eq(store.getItem("awl_sid"), null, "privacy: reset removes awl_sid");
    t.eq(store.getItem("awl_last"), null, "privacy: reset removes awl_last");
    t.eq(sess.getItem("awl_sid"), null, "privacy: reset clears the session id too");
    t.eq(store.getItem("keep"), "untouched", "privacy: reset leaves unrelated keys alone");
    t.ok(/reset/i.test(r.nodes.vidMsg.textContent), "privacy: reset confirms to the user");
    t.eq(r.nodes.vidOut.value, "", "privacy: field cleared after reset");
  }

  // (f) reset when there was nothing -> honest message, no crash
  {
    const store = memStore({});
    const r = runPrivacy({ lib: libStub({}), store, navigator: {} });
    let threw = null;
    try { r.nodes.vidReset.dispatch("click"); } catch (e) { threw = e; }
    t.ok(!threw, "privacy: reset with nothing stored does not throw");
    t.ok(/no identifier/i.test(r.nodes.vidMsg.textContent), "privacy: says there was nothing to reset");
  }

  // (g) copy falls back to execCommand when the Clipboard API is missing, and copies the real value
  {
    const vid = "abcdefgh-1234-5678-90ab-cdef01234567";
    const store = memStore({ awl_vid: vid });
    const r = runPrivacy({ lib: libStub({}), store, navigator: {} });
    const win = r.win;
    let copied = null;
    win.document.createElement = () => ({
      value: "", className: "", setAttribute() {}, select() { copied = this.value; }
    });
    win.document.execCommand = () => true;
    r.nodes.vidCopy.dispatch("click");
    t.eq(copied, vid, "privacy: copy fallback copies the identifier verbatim");
    t.ok(/Copied/.test(r.nodes.vidMsg.textContent), "privacy: copy confirms");
  }
};
