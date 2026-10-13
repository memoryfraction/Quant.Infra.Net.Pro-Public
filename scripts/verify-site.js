/*
 * verify-site.js — spec 5c browser verification for the static site.
 *
 * Serves the repo root on a local port and drives Chromium through the checks the spec lists:
 *   console errors / CSP violations, the consent notice bar, share-link round-trip, a malformed ?s=,
 *   save -> banner -> load -> compare, blocked storage, Global Privacy Control, the profile card,
 *   the zh-vs-en retention entry point, the stats dashboard treating a <script> in feedback as text,
 *   and 375px horizontal overflow.
 *
 * Local runs have no /api/ backend, so failed API requests are EXPECTED and are not counted as
 * failures — only uncaught exceptions and CSP violations are.
 *
 * Usage: node scripts/verify-site.js
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const PORT = 8899;
const BASE = `http://127.0.0.1:${PORT}`;

// The tracker and the whole phase-1 runtime deliberately no-op unless the host is the production
// one (spec 4.2 / 4.1c: "only when location.hostname === www.alpha-wealth-lab.com"). So the checks
// for anything behind that gate must browse AS that host. We map the production name onto the local
// server so no network access is needed and nothing is written to the real internet.
const PROD_ORIGIN = `http://www.alpha-wealth-lab.com:${PORT}`;
const HOST_MAP = { "www.alpha-wealth-lab.com": "127.0.0.1" };

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon"
};

let pass = 0, fail = 0;
const failures = [];
function check(cond, label, detail) {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; failures.push(label + (detail ? ` — ${detail}` : "")); console.log(`  FAIL ${label}${detail ? " — " + detail : ""}`); }
}
function head(s) { console.log(`\n=== ${s} ===`); }

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
      if (p.endsWith("/")) p += "index.html";
      const fp = path.join(ROOT, p.replace(/^\/+/, ""));
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        // Match GitHub Pages: serve 404.html with a 404 status.
        const nf = path.join(ROOT, "404.html");
        if (fs.existsSync(nf)) { res.writeHead(404, { "content-type": MIME[".html"] }); res.end(fs.readFileSync(nf)); }
        else { res.writeHead(404); res.end("not found"); }
        return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream" });
      res.end(fs.readFileSync(fp));
    });
    srv.listen(PORT, "127.0.0.1", () => resolve(srv));
  });
}

// Collect real page errors and CSP violations, ignoring the expected missing-/api/ noise.
function attach(page, bag) {
  page.on("pageerror", (e) => {
    // Keep the stack: some third-party scripts throw with a generic message (e.g. counter.dev
    // throws the *same* "storage blocked" text our own code would), so origin is the only
    // reliable way to tell whose bug it is.
    bag.errors.push(String(e.message || e));
    bag.stacks.push(String((e && e.stack) || ""));
  });
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const txt = m.text();
    if (/Failed to load resource|net::ERR|favicon|ERR_CONNECTION|api\//i.test(txt)) return;
    if (/Content Security Policy/i.test(txt)) { bag.csp.push(txt); return; }
    bag.console.push(`${m.type()}: ${txt}`);
  });
}
const newBag = () => ({ errors: [], stacks: [], csp: [], console: [] });
// Errors whose stack points at third-party origins, not our code.
const THIRD_PARTY = /counter\.dev|googletagmanager|google-analytics|clarity\.ms|hotjar|doubleclick/i;
const oursOnly = (bag) => bag.errors.filter((_, i) => !THIRD_PARTY.test(bag.stacks[i] || ""));

(async () => {
  const srv = await serve();
  const browser = await chromium.launch();
  console.log(`serving ${ROOT} at ${BASE}`);
  console.log(`production-mapped origin: ${PROD_ORIGIN}`);

  // Prod-mapped context: hostname is the real one, so every production-only code path runs.
  const prodCtx = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    ignoreHTTPSErrors: true
  });
  await prodCtx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "www.alpha-wealth-lab.com") {
      u.hostname = "127.0.0.1";
      return route.continue({ url: u.toString() });
    }
    return route.continue();
  });

  const ctx = prodCtx;

  // ---------------------------------------------------------------- 1. pages load clean
  head("1. console / CSP cleanliness");
  const PAGES = [
    "/planner/", "/planner/allocation/", "/planner/fi/", "/planner/rebalance/",
    "/join/", "/terms/", "/privacy/", "/stats/", "/planner/subscribed/?ok=1"
  ];
  for (const p of PAGES) {
    const bag = newBag();
    const page = await ctx.newPage();
    attach(page, bag);
    await page.goto(PROD_ORIGIN + p, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    const errs = oursOnly(bag);
    check(errs.length === 0, `${p} — no uncaught JS errors`, errs.join(" | "));
    check(bag.csp.length === 0, `${p} — no CSP violations`, bag.csp.join(" | "));
    await page.close();
  }

  // ---------------------------------------------------------------- 2. notice bar
  head("2. consent notice bar");
  {
    const page = await ctx.newPage();
    await page.goto(PROD_ORIGIN + "/planner/fi/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    const bar = page.locator(".awl-notice");
    check(await bar.count() > 0, "notice bar injected on /planner/fi/");
    if (await bar.count()) {
      check(await bar.isVisible(), "notice bar is visible");
      const hasTerms = await page.locator('.awl-notice a[href*="/terms/"]').count();
      const hasPriv = await page.locator('.awl-notice a[href*="/privacy/"]').count();
      check(hasTerms > 0 && hasPriv > 0, "notice bar links to /terms/ and /privacy/");
      // CSS actually loaded (not just an unstyled div).
      const pos = await bar.evaluate((el) => getComputedStyle(el).position);
      check(pos === "fixed", "notice.css applied (position:fixed)", pos);
      const btn = page.locator(".awl-notice-btn");
      if (await btn.count()) {
        await btn.first().click();
        await page.waitForTimeout(300);
        check(!(await bar.isVisible()), "clicking Got it hides the bar");
        const stored = await page.evaluate(() => { try { return localStorage.getItem("awl_notice"); } catch (e) { return "ERR"; } });
        check(stored === "1", "dismissal stored in localStorage", String(stored));
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(500);
        check(!(await bar.isVisible()), "bar stays hidden after reload");
      }
    }
    await page.close();
  }

  // ---------------------------------------------------------------- 3. share link round-trip
  head("3. share link round-trip");
  let shareUrl = null;
  {
    const page = await ctx.newPage();
    // Capture the URL the share button produces. Headless HTTP is not a secure context, so
    // navigator.clipboard is absent and the execCommand fallback runs: it puts the link in a
    // *transient* <textarea> that is selected then removed. Hooking
    // HTMLTextAreaElement.prototype.select is therefore the only reliable interception point
    // (wrapping execCommand is too late — the textarea is already gone by then).
    await page.addInitScript(() => {
      window.__copied = [];
      const sel = HTMLTextAreaElement.prototype.select;
      HTMLTextAreaElement.prototype.select = function () {
        window.__copied.push(this.value);
        return sel.apply(this, arguments);
      };
    });
    await page.goto(PROD_ORIGIN + "/planner/fi/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    // Change an input so the result is non-default.
    const input = page.locator("#inputs input[type='number']").first();
    if (await input.count()) {
      await input.fill("1234567");
      await input.dispatchEvent("input");
      await input.dispatchEvent("change");
      await page.waitForTimeout(900);
    }
    const before = await page.evaluate(() => {
      const el = document.querySelector("#results");
      return el ? el.textContent.replace(/\s+/g, " ").trim().slice(0, 400) : "";
    });
    const btn = page.locator(".awl-btn", { hasText: /复制链接|Copy link/ });
    check(await btn.count() > 0, "share button rendered");
    if (await btn.count()) {
      // Click through the DOM: the button is far below the fold and a synthetic click avoids
      // depending on scroll/overlay state for an assertion that is about link generation.
      await page.evaluate(() => {
        const b = [...document.querySelectorAll(".awl-btn")].find((x) => /复制链接|Copy link/.test(x.textContent));
        if (b) b.click();
      });
      await page.waitForTimeout(600);
      // Preference order: the intercepted execCommand copy, then the Clipboard API, then the visible
      // read-only fallback box. Any of the three is a valid way for the user to obtain the URL.
      shareUrl = await page.evaluate(() => (window.__copied && window.__copied.length) ? window.__copied[window.__copied.length - 1] : null);
      if (!shareUrl || !/[?&]s=/.test(shareUrl)) {
        const cl = await page.evaluate(async () => {
          try { return await navigator.clipboard.readText(); } catch (e) { return null; }
        }).catch(() => null);
        if (cl && /[?&]s=/.test(cl)) shareUrl = cl;
      }
      const box = page.locator(".awl-linkbox");
      if ((!shareUrl || !/[?&]s=/.test(shareUrl)) && await box.count()) {
        const v = await box.first().inputValue().catch(() => "");
        if (v) shareUrl = v;
      }
      check(!!shareUrl && /[?&]s=/.test(shareUrl || ""), "share URL contains ?s=", String(shareUrl).slice(0, 140));
      check(/[?&]from=share/.test(shareUrl || ""), "share URL carries from=share", String(shareUrl).slice(-40));
      // A toast must have confirmed the action either way.
      const toastTxt = await page.locator(".awl-toast").first().textContent().catch(() => "");
      check(!!toastTxt && toastTxt.trim().length > 0, "share shows a toast confirmation", String(toastTxt));

      if (shareUrl && /[?&]s=/.test(shareUrl)) {
        const rel = shareUrl.replace(/^https?:\/\/[^/]+/, "");
        const page2 = await ctx.newPage();
        const bag2 = newBag();
        attach(page2, bag2);
        await page2.goto(PROD_ORIGIN + rel, { waitUntil: "domcontentloaded" });
        await page2.waitForTimeout(900);
        const after = await page2.evaluate(() => {
          const el = document.querySelector("#results");
          return el ? el.textContent.replace(/\s+/g, " ").trim().slice(0, 400) : "";
        });
        const val = await page2.evaluate(() => {
          const i = document.querySelector("#inputs input[type='number']");
          return i ? i.value : "";
        });
        check(bag2.errors.length === 0, "restored page has no JS errors", bag2.errors.join(" | "));
        check(val === "1234567", "restored input value matches", val);
        check(after.length > 0 && after === before, "restored results match the source page");
        await page2.close();
      }
    }
    await page.close();
  }

  // ---------------------------------------------------------------- 4. malformed ?s=
  head("4. malformed ?s= does not throw");
  for (const bad of ["?s=%7Bbroken", "?s=!!!!", "?s=" + Buffer.from("{\"x\":1}").toString("base64url"), "?s=null"]) {
    const bag = newBag();
    const page = await ctx.newPage();
    attach(page, bag);
    await page.goto(PROD_ORIGIN + "/planner/fi/" + bad, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    check(bag.errors.length === 0, `?s=${bad.slice(3, 15)} — no JS error`, bag.errors.join(" | "));
    const hasResults = await page.locator("#results").count();
    check(hasResults === 1, `?s=${bad.slice(3, 15)} — page still renders`);
    await page.close();
  }

  // ---------------------------------------------------------------- 5. save -> banner -> load -> compare
  head("5. save then load then compare");
  {
    const page = await ctx.newPage();
    await page.goto(PROD_ORIGIN + "/planner/fi/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const saveBtn = page.locator(".awl-btn", { hasText: /保存到本机|Save on this device/ });
    check(await saveBtn.count() > 0, "save button rendered");
    if (await saveBtn.count()) {
      await saveBtn.first().click();
      await page.waitForTimeout(400);
      const keys = await page.evaluate(() => { try { return Object.keys(localStorage); } catch (e) { return []; } });
      check(keys.some((k) => k.indexOf("awl_plans") >= 0), "plan written to localStorage", keys.join(","));
      // Change an input, then reload: with no ?s=, the "you saved on ..." banner must appear.
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(900);
      const banner = page.locator(".awl-banner");
      check(await banner.count() > 0, "saved-plan banner shown after reload");
      if (await banner.count()) {
        const loadBtn = banner.locator(".awl-btn", { hasText: /载入|Load/ });
        const dismissBtn = banner.locator(".awl-btn", { hasText: /忽略|Dismiss/ });
        check(await loadBtn.count() > 0, "banner has a Load button");
        check(await dismissBtn.count() > 0, "banner has a Dismiss button");
        if (await loadBtn.count()) {
          await loadBtn.first().click();
          await page.waitForTimeout(700);
          const cmp = page.locator(".awl-cmp");
          check(await cmp.count() > 0, "compare table appears after Load");
        }
      }
    }
    await page.close();
  }

  // ---------------------------------------------------------------- 6. blocked storage
  head("6. blocked storage degrades silently");
  {
    const page = await ctx.newPage();
    // Overriding the localStorage getter on the window is not enough: the tracker keeps a captured
    // reference. Break the prototype methods instead, which is what a blocking browser (and the
    // "cookies blocked" setting) actually looks like.
    await page.addInitScript(() => {
      const boom = () => { throw new Error("storage blocked"); };
      try {
        for (const proto of [Storage.prototype]) {
          proto.getItem = boom; proto.setItem = boom; proto.removeItem = boom;
          proto.clear = boom; proto.key = boom;
        }
      } catch (e) { /* ignore */ }
    });
    const bag = newBag();
    attach(page, bag);
    await page.goto(PROD_ORIGIN + "/planner/fi/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    // Only OUR errors count: counter.dev is a third-party script with its own storage assumptions
    // and it throws with the same message text, so attribute by stack instead of by message.
    const ours = oursOnly(bag);
    check(ours.length === 0, "blocked storage — no JS error from our code", ours.join(" | "));
    const results = await page.locator("#results").count();
    check(results === 1, "blocked storage — page still usable");
    // The button is rendered but must be HIDDEN (hidden attribute, not merely absent).
    const saveVisible = await page.locator(".awl-btn", { hasText: /保存到本机|Save on this device/ })
      .first().isVisible().catch(() => false);
    check(saveVisible === false, "blocked storage — save button hidden", `visible=${saveVisible}`);
    // Calculations must still work with no storage at all.
    const hasNumbers = await page.evaluate(() => /[0-9]/.test(document.getElementById("results").textContent));
    check(hasNumbers, "blocked storage — results still computed");
    await page.close();
  }

  // ---------------------------------------------------------------- 7. Global Privacy Control
  head("7. Global Privacy Control");
  {
    // A fresh context: the shared one already holds a vid from earlier sections, and this check is
    // specifically about a first-time GPC visitor.
    const gc = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    await gc.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "www.alpha-wealth-lab.com") { u.hostname = "127.0.0.1"; return route.continue({ url: u.toString() }); }
      return route.continue();
    });
    await gc.addInitScript(() => {
      Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, get: () => true });
    });
    const page = await gc.newPage();
    const sent = [];
    await page.route("**/api/**", (route) => {
      sent.push(route.request().url() + " " + (route.request().postData() || ""));
      route.fulfill({ status: 204, body: "" });
    });
    await page.goto(PROD_ORIGIN + "/planner/fi/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const ids = await page.evaluate(() => {
      let ls = {};
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); } } catch (e) { ls = { ERR: 1 }; }
      return ls;
    });
    check(!("awl_vid" in ids), "GPC — no visitor id generated", JSON.stringify(ids).slice(0, 140));
    check(!("awl_sid" in ids), "GPC — no session id generated");
    const withIds = sent.filter((s) => /"vid"\s*:/.test(s));
    check(withIds.length === 0, "GPC — no request carried a vid", withIds.join(" | ").slice(0, 160));
    check(!("awl_plans_v1" in ids), "GPC — nothing written to this device either");
    await gc.close();
    // The identifier control on /privacy/ must explain GPC too. The message text is localised, so
    // accept either language (the context may have persisted a zh preference from an earlier check).
    const p2 = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    await p2.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "www.alpha-wealth-lab.com") { u.hostname = "127.0.0.1"; return route.continue({ url: u.toString() }); }
      return route.continue();
    });
    await p2.addInitScript(() => {
      Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, get: () => true });
    });
    const p2page = await p2.newPage();
    await p2page.goto(PROD_ORIGIN + "/privacy/", { waitUntil: "domcontentloaded" });
    await p2page.waitForTimeout(500);
    const msg = await p2page.locator("#vidMsg").textContent();
    const val = await p2page.locator("#vidOut").inputValue();
    check(val === "", "GPC — /privacy/ shows no identifier", val);
    check(/Global Privacy Control|全局隐私控制/i.test(msg || ""), "GPC — /privacy/ explains why", String(msg));
    await p2.close();
    await page.close();
  }

  // ---------------------------------------------------------------- 8. profile card
  head("8. profile card");
  {
    const page = await ctx.newPage();
    await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
    await page.goto(PROD_ORIGIN + "/planner/fi/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const prof = page.locator(".awl-prof");
    check(await prof.count() > 0, "profile card rendered after a successful calc");
    if (await prof.count()) {
      // The card is a collapsed <details>; open it before interacting.
      await prof.first().evaluate((el) => { el.open = true; });
      await page.waitForTimeout(300);
      const submit = prof.locator(".awl-btn.primary", { hasText: /提交|Submit/ });
      check(await submit.count() > 0, "profile card has a submit button");
      const skip = prof.locator(".awl-btn.ghost", { hasText: /跳过|Skip/ });
      check(await skip.count() > 0, "profile card has a skip button");
      // The six questions the spec lists.
      const groups = await prof.locator(".awl-pick").count();
      check(groups === 6, "profile card asks all 6 questions", String(groups));
      // Answer one question, then submit.
      const chipInput = prof.locator(".awl-chip input").first();
      if (await chipInput.count()) {
        await chipInput.check({ force: true }).catch(() => {});
      }
      if (await submit.count()) {
        await submit.first().click();
        await page.waitForTimeout(700);
        const done = await page.evaluate(() => { try { return localStorage.getItem("awl_profile_done"); } catch (e) { return null; } });
        check(!!done, "profile submission recorded on device", String(done));
      }
    }
    await page.close();
  }

  // ---------------------------------------------------------------- 9. zh vs en retention entry
  head("9. retention entry differs by language");
  {
    const page = await ctx.newPage();
    await page.goto(PROD_ORIGIN + "/planner/fi/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1100);
    // Force Chinese.
    await page.evaluate(() => { window.SiteLang.set("zh"); });
    await page.waitForTimeout(600);
    let primary = await page.evaluate(() => {
      const b = document.querySelector(".awl-keep .awl-btn.primary");
      return b ? (b.getAttribute("href") || "") + "|" + b.textContent : null;
    });
    check(!!primary && /\/join\//.test(primary), "zh — primary entry goes to /join/", String(primary));
    // Force English.
    await page.evaluate(() => { window.SiteLang.set("en"); });
    await page.waitForTimeout(600);
    primary = await page.evaluate(() => {
      const b = document.querySelector(".awl-keep .awl-btn.primary");
      return b ? (b.getAttribute("href") || "") + "|" + (b ? b.textContent : "") : null;
    });
    check(!!primary && !/\/join\//.test(primary), "en — primary entry is not /join/", String(primary));
    const emails = await page.locator(".awl-keep input[type='email'], .awl-keep input[type='text']").count();
    check(emails > 0, "en — email subscription form present", String(emails));
    await page.close();
  }

  // ---------------------------------------------------------------- 10. subscribe honeypot
  head("10. subscribe honeypot is off-screen, not type=hidden");
  {
    const page = await ctx.newPage();
    await page.goto(PROD_ORIGIN + "/planner/fi/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1100);
    await page.evaluate(() => { window.SiteLang.set("en"); });
    await page.waitForTimeout(500);
    const hp = page.locator(".awl-keep .awl-hp");
    if (await hp.count()) {
      const type = await hp.first().getAttribute("type");
      check(type !== "hidden", "honeypot is not type=hidden", String(type));
      const box = await hp.first().boundingBox();
      check(!box || box.x < 0 || box.width <= 2, "honeypot is moved off-screen", JSON.stringify(box));
    } else {
      check(false, "honeypot field present");
    }
    await page.close();
  }

  // ---------------------------------------------------------------- 11. stats treats <script> as text
  head("11. stats dashboard escapes feedback text");
  {
    const page = await ctx.newPage();
    const XSS = "<script>alert('xss')</script>";
    // Shaped exactly like the worker's handleStats() response (src/index.js
    // L535-556). Using a fictional payload here once hid a real crash.
    const payload = {
      from: "2026-09-13", to: "2026-10-13",
      summary: { views: 100, calcs: 20 },
      uniques: { vids: 30, ip_hashes: 28 },
      sessions: 44,
      newVsReturning: { new: 20, returning: 10 },
      cohorts: { "2026-10-01": { cohort: 3, d1: 0.33, d7: 0.33, d30: 0 } },
      devices: [{ device: "mobile", n: 70 }, { device: "desktop", n: 30 }],
      os: [{ os: "ios", n: 40 }],
      browsers: [{ browser: "wechat", n: 60 }, { browser: "chrome", n: 40 }],
      wechat: { count: 60, share: 0.6 },
      referrers: [{ ref: "weixin.qq.com", n: 60 }],
      utm: { source: [{ s: "wechat", n: 60 }], medium: [], campaign: [] },
      campaigns: [{ c: "share", n: 2 }],
      engagement: [{ path: "/planner/fi/", n: 5, avg_s: 45, avg_scroll: 62 }],
      calcs: { byTool: [{ tool: "fi", n: 2 }], inputs: { numeric: {}, categorical: {} } },
      profiles: { age_band: [{ v: "30-39", n: 4 }], asset_band: [], goal: [], markets: [["us", 3]], follows: [], leverage_exp: [] },
      wtp: [["pdf_report", 1]],
      subscribers: { pending: 1, confirmed: 2, unsubscribed: 0 },
      feedback: [{ ts: 1700000000, tool: "fi", lang: "zh", rating: 5, message: XSS, contact: "a@b.co", wtp: "pdf_report" }],
      events: { view: 100, calc: 20, share: 2, save: 1, load: 0, join: 0, leave: 5 },
      eventsByTool: {},
      retention: { overall: 0.25, byTool: {} }
    };
    await page.route("**/api/stats*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) }));
    await page.goto(PROD_ORIGIN + "/stats/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    await page.fill("#token", "test-token").catch(() => {});
    const load = page.locator("#load");
    if (await load.count()) {
      await load.click();
      await page.waitForTimeout(900);
      const scripts = await page.locator("#out script").count();
      check(scripts === 0, "no <script> element created from feedback text", String(scripts));
      const txt = await page.evaluate(() => document.getElementById("out").textContent);
      check(txt.indexOf(XSS) >= 0, "feedback text shown literally", txt.slice(0, 120));
      check(txt.indexOf("⑩") >= 0, "feedback block rendered");
      check(txt.indexOf("fi") >= 0 && txt.indexOf("zh") >= 0, "feedback row fields rendered");
      // Every one of the ten blocks must survive the worker's real shapes.
      ["① 概览", "② 新老访客", "留存曲线", "③ 设备", "④ 来源", "⑤ 分页面停留",
       "各工具计算次数与输入分布", "⑦ 用户画像", "⑧ 付费意愿", "⑨ 订阅数量", "⑩ 最近反馈"]
        .forEach((b) => check(txt.indexOf(b) >= 0, `block "${b}" rendered`));
      check(txt.indexOf("30") >= 0, "unique-vid count rendered", txt.slice(0, 60));
      check(txt.indexOf("ios") >= 0, "devices/os read from bare columns");
      check(txt.indexOf("wechat") >= 0, "utm_source read from the `s` alias");
      check(txt.indexOf("30-39") >= 0, "profile age_band read from the `v` alias");
      check(txt.indexOf("pdf_report") >= 0, "wtp read from Object.entries pairs");
      check(txt.indexOf("[object Object]") < 0, "no value rendered as [object Object]");
      check(txt.indexOf("(空)") < 0, "no row degraded to an empty label");
    } else {
      check(false, "#load button exists on /stats/");
    }
    await page.close();
  }

  // ---------------------------------------------------------------- 12. 375px no horizontal scroll
  head("12. 375px — no horizontal overflow");
  {
    const m = await browser.newContext({ viewport: { width: 375, height: 720 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await m.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "www.alpha-wealth-lab.com") { u.hostname = "127.0.0.1"; return route.continue({ url: u.toString() }); }
      return route.continue();
    });
    for (const p of ["/", "/planner/", "/planner/fi/", "/planner/allocation/", "/join/", "/terms/", "/privacy/", "/planner/subscribed/?ok=1", "/stats/", "/calculator/"]) {
      const page = await m.newPage();
      await page.goto(PROD_ORIGIN + p, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      const over = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth
      }));
      check(over.sw <= over.cw + 2, `${p} — no horizontal scroll at 375px`, `scrollWidth ${over.sw} > clientWidth ${over.cw}`);
      await page.close();
    }
    await m.close();
  }

  // ---------------------------------------------------------------- 13. new pages content
  head("13. new pages show the right language");
  {
    const page = await ctx.newPage();
    // Terms
    await page.goto(PROD_ORIGIN + "/terms/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    let visibleEn = await page.locator(".l-en").first().isVisible();
    let visibleZh = await page.locator(".l-zh").first().isVisible();
    check(visibleEn && !visibleZh, "terms: en visible / zh hidden by default", `en=${visibleEn} zh=${visibleZh}`);
    await page.evaluate(() => window.SiteLang.set("zh"));
    await page.waitForTimeout(400);
    visibleZh = await page.locator(".l-zh").first().isVisible();
    visibleEn = await page.locator(".l-en").first().isVisible();
    check(visibleZh && !visibleEn, "terms: switching to zh hides en", `en=${visibleEn} zh=${visibleZh}`);
    // Privacy
    await page.goto(PROD_ORIGIN + "/privacy/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    await page.evaluate(() => window.SiteLang.set("en"));
    await page.waitForTimeout(300);
    const vid = await page.locator("#vidOut").inputValue();
    check(/^[a-z0-9-]{8,64}$/.test(vid) || vid === "", "privacy: identifier is empty or well-formed", vid);
    // Join
    await page.goto(PROD_ORIGIN + "/join/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    const imgs = await page.locator(".qrbox img").count();
    check(imgs === 2, "join: two QR images", String(imgs));
    const loaded = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".qrbox img")).every((i) => i.complete && i.naturalWidth > 0));
    check(loaded, "join: both QR images actually load");
    // Subscribed
    for (const [q, sel] of [["?ok=1", "#caseOk"], ["?ok=0", "#caseBad"], ["?unsub=1", "#caseUnsub"], ["", "#caseNone"]]) {
      await page.goto(PROD_ORIGIN + "/planner/subscribed/" + q, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);
      const vis = await page.locator(sel).isVisible();
      const others = await page.locator(".statuscard:visible").count();
      check(vis && others === 1, `subscribed ${q || "(none)"} -> ${sel} only`, `visible=${vis} count=${others}`);
    }
    await page.close();
  }

  // ---------------------------------------------------------------- 14. notice bar on every page
  head("14. notice bar present site-wide");
  {
    // A FRESH context: section 2 already dismissed the bar (awl_notice=1), which is per-device by
    // design, so reusing that context would always come back empty here.
    const fresh = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    await fresh.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "www.alpha-wealth-lab.com") { u.hostname = "127.0.0.1"; return route.continue({ url: u.toString() }); }
      return route.continue();
    });
    for (const p of ["/", "/ebook", "/mcp", "/changelog", "/terms/", "/privacy/", "/join/", "/planner/allocation/"]) {
      const page = await fresh.newPage();
      const bag = newBag();
      attach(page, bag);
      await page.goto(PROD_ORIGIN + p, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      const n = await page.locator(".awl-notice").count();
      check(n > 0, `${p} — notice bar present`, String(n));
      check(bag.errors.length === 0, `${p} — no JS errors while injecting the bar`, bag.errors.join(" | "));
      if (n > 0) {
        const linkCount = await page.locator(".awl-notice a").count();
        check(linkCount >= 2, `${p} — notice bar has terms + privacy links`, String(linkCount));
      }
      await page.close();
    }
    await fresh.close();
  }

  await browser.close();
  srv.close();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log("\nFAILURES:");
    failures.forEach((f) => console.log("  - " + f));
  }
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("verify-site crashed:", e); process.exit(1); });
