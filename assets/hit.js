/*
 * assets/hit.js — site-wide visit tracking + the "continue = consent" notice bar.
 *
 * Loaded by every page (after /js/site-lang.js where that exists).
 *
 *   1) injects the counter.dev script
 *   2) shows a non-blocking bottom notice bar ("by continuing you agree"), once
 *      per device (localStorage awl_notice=1)
 *   3) POSTs one beacon per event to our own Worker (/api/hit). The Worker adds
 *      IP-derived geo server-side; we never send an IP or a raw User-Agent.
 *   4) window.AWL_track("calc"|"share"|"save"|"load"|"join") — once per page load
 *   5) a single `leave` beacon on pagehide/visibilitychange with dwell ms + max scroll %
 *
 * Privacy:
 *   - Only runs on the production host, so local previews never pollute numbers.
 *   - When Global Privacy Control is on, or no visitor id can be created, we send
 *     only the basic fields (path / event / referrer): no vid, sid, tag, utm, vw, bl.
 *   - planner/assets/lib.js is the preferred source of ids/utm/tag. Pages that do
 *     not load it (home, ebook, mcp, changelog, stats) fall back to the minimal
 *     implementation below. The two must agree — see planner/tests/hit.test.js.
 */
(function () {
  "use strict";

  var PROD_HOST = "www.alpha-wealth-lab.com";
  var KEEP = { vid: "awl_vid", sid: "awl_sid", last: "awl_last", notice: "awl_notice", self: "awl_self" };
  var DAY_MS = 86400000;
  var EVENTS = ["calc", "share", "save", "load", "join"];

  // ---- minimal fallback (must match planner/assets/lib.js) ---------------
  // Returns "" when storage is unusable, when GPC is on, or when the write
  // fails — the same contract as AWLLib.getVid/getSid.
  function gpcOn(nav) {
    try { return !!(nav && nav.globalPrivacyControl === true); } catch (e) { return false; }
  }
  function store(kind) {
    try {
      var s = kind === "session" ? window.sessionStorage : window.localStorage;
      var probe = "__awl_p__";
      s.setItem(probe, "1");
      s.removeItem(probe);
      return s;
    } catch (e) { return null; }
  }
  function uuid(nav) {
    try {
      if (nav && nav.crypto && nav.crypto.randomUUID) return nav.crypto.randomUUID();
    } catch (e) { /* fall through */ }
    try {
      var b = new Uint8Array(16);
      if (nav && nav.crypto && nav.crypto.getRandomValues) nav.crypto.getRandomValues(b);
      else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      var h = "";
      for (var j = 0; j < 16; j++) h += (b[j] + 0x100).toString(16).slice(1);
      return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
    } catch (e) { return ""; }
  }
  function readId(s, key, nav) {
    if (!s) return "";
    try {
      var v = s.getItem(key);
      if (v && /^[a-z0-9-]{8,64}$/.test(v)) return v;
      var nv = uuid(nav);
      if (!nv) return "";
      s.setItem(key, nv);
      return s.getItem(key) === nv ? nv : "";
    } catch (e) { return ""; }
  }
  function visitorTag(s, nowMs) {
    if (!s) return "";
    try {
      var raw = s.getItem(KEEP.last);
      var last = raw === null ? NaN : Number(raw);
      s.setItem(KEEP.last, String(nowMs));
      if (!isFinite(last) || last <= 0) return "new";
      var d = Math.floor((nowMs - last) / DAY_MS);
      if (d <= 0) return "d0";
      if (d <= 7) return "d1_7";
      if (d <= 30) return "d8_30";
      return "d30p";
    } catch (e) { return ""; }
  }
  function clean(s, max, allow) {
    if (typeof s !== "string") return "";
    return new RegExp("^[" + allow + "]{1," + max + "}$").test(s) ? s : "";
  }
  function utm(search) {
    var out = { us: "", um: "", uc: "" };
    try {
      var q = new URLSearchParams(search || "");
      out.us = clean(q.get("utm_source") || "", 40, "A-Za-z0-9_.-");
      out.um = clean(q.get("utm_medium") || "", 40, "A-Za-z0-9_.-");
      out.uc = clean(q.get("utm_campaign") || "", 40, "A-Za-z0-9_.-");
    } catch (e) { /* keep empties */ }
    return out;
  }
  function campaign(search) {
    try {
      var v = new URLSearchParams(search || "").get("from") || "";
      return ["card", "share", "wechat", "email", "join"].indexOf(v) >= 0 ? v : "";
    } catch (e) { return ""; }
  }
  function blang(nav) {
    return clean(String((nav && nav.language) || ""), 12, "A-Za-z0-9-");
  }

  // Prefer AWLLib when the page loaded it; otherwise use the fallback above.
  function helpers() {
    var L = window.AWLLib;
    if (L && typeof L.getVid === "function") {
      return {
        gpc: function () { return !!L.gpcOn(window.navigator); },
        vid: function () { return L.getVid(store("local")); },
        sid: function () { return L.getSid(store("session")); },
        tag: function () { return L.visitorTag(store("local"), Date.now()); },
        utm: function () { return L.utm(location.search); },
        campaign: function () { return L.campaign(location.search); }
      };
    }
    return {
      gpc: function () { return gpcOn(window.navigator); },
      // GPC short-circuits both ids: nothing is generated and nothing is stored.
      vid: function () { return gpcOn(window.navigator) ? "" : readId(store("local"), KEEP.vid, window.navigator); },
      sid: function () { return gpcOn(window.navigator) ? "" : readId(store("session"), KEEP.sid, window.navigator); },
      tag: function () { return gpcOn(window.navigator) ? "" : visitorTag(store("local"), Date.now()); },
      utm: function () { return utm(location.search); },
      campaign: function () { return campaign(location.search); }
    };
  }

  function ref() {
    try { return document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) { return ""; }
  }

  // ---- notice bar --------------------------------------------------------
  function injectCss() {
    try {
      if (document.getElementById("awlNoticeCss")) return;
      var l = document.createElement("link");
      l.id = "awlNoticeCss";
      l.rel = "stylesheet";
      l.href = "/assets/notice.css?v=20261013";
      document.head.appendChild(l);
    } catch (e) { /* never break the page */ }
  }

  function lang() {
    try {
      if (window.SiteLang && window.SiteLang.get) return window.SiteLang.get();
    } catch (e) { /* ignore */ }
    var h = document.documentElement && document.documentElement.lang;
    return h === "zh" ? "zh" : "en";
  }

  function notice() {
    var zh = lang() === "zh";
    var txt = zh
      ? { msg: "继续使用本站，即表示你已阅读并同意", terms: "《使用条款》", and: "和", priv: "《隐私说明》", ok: "知道了", end: "。" }
      : { msg: "By continuing to use this site you agree to our", terms: "Terms", and: "and", priv: "Privacy Notice", ok: "Got it", end: "." };

    var bar = document.createElement("div");
    bar.className = "awl-notice";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", zh ? "使用条款与隐私提示" : "Terms and privacy notice");

    var p = document.createElement("p");
    p.className = "awl-notice-txt";
    p.appendChild(document.createTextNode(txt.msg + " "));
    var a1 = document.createElement("a"); a1.href = "/terms/"; a1.textContent = txt.terms;
    var a2 = document.createElement("a"); a2.href = "/privacy/"; a2.textContent = txt.priv;
    p.appendChild(a1);
    p.appendChild(document.createTextNode(" " + txt.and + " "));
    p.appendChild(a2);
    p.appendChild(document.createTextNode(txt.end));
    bar.appendChild(p);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "awl-notice-btn";
    btn.textContent = txt.ok;
    btn.addEventListener("click", function () {
      try { store("local").setItem(KEEP.notice, "1"); } catch (e) { /* ignore */ }
      bar.classList.remove("on");
      setTimeout(function () { if (bar.parentNode) bar.parentNode.removeChild(bar); }, 250);
    });
    bar.appendChild(btn);
    document.body.appendChild(bar);
    // el.style only — the CSP forbids a style="" attribute.
    bar.style.transform = "translateY(120%)";
    requestAnimationFrame(function () { bar.classList.add("on"); });
  }

  // ---- main --------------------------------------------------------------
  try {
    if (location.hostname !== PROD_HOST) return;

    injectCss();

    // "Exclude me": ?awl_self=1 marks this browser as the owner's (no tracking at all),
    // ?awl_self=0 turns tracking back on. Mirrors AWLLib.applySelfParam / isSelf.
    var selfLs = store("local");
    try {
      var sv = new URLSearchParams(location.search || "").get("awl_self") || "";
      if (selfLs && (sv === "1" || sv === "on")) selfLs.setItem(KEEP.self, "1");
      else if (selfLs && (sv === "0" || sv === "off")) selfLs.removeItem(KEEP.self);
    } catch (e) { /* ignore */ }
    var excluded = false;
    try { excluded = !!selfLs && selfLs.getItem(KEEP.self) === "1"; } catch (e) { excluded = false; }
    if (excluded) {
      window.AWL_track = function () {};
      try { console.info("[awl] this browser is excluded from analytics. Open any page with ?awl_self=0 to count it again."); } catch (e) { /* ignore */ }
      return;
    }
    try {
      var ls = store("local");
      var seen = ls && ls.getItem(KEEP.notice) === "1";
      if (!seen && document.body) {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", notice);
        else notice();
      }
    } catch (e) { /* never break the page */ }

    // counter.dev (public dashboard)
    try {
      if (!document.querySelector('script[data-id="9ed3aabb-f776-4e0b-93ed-a1bab7799a56"]')) {
        var cs = document.createElement("script");
        cs.src = "https://cdn.counter.dev/script.js";
        cs.async = true;
        cs.setAttribute("data-id", "9ed3aabb-f776-4e0b-93ed-a1bab7799a56");
        cs.setAttribute("data-utcoffset", "8");
        document.head.appendChild(cs);
      }
    } catch (e) { /* ignore */ }

    var h = helpers();

    // Fields that identify the visitor — omitted entirely under GPC.
    function full(e, extra) {
      var b = { p: location.pathname, e: e, r: ref() };
      var vid = h.vid();
      if (!vid) return b;                       // GPC or unusable storage -> basic only
      b.vid = vid;
      var sid = h.sid(); if (sid) b.sid = sid;
      var tag = h.tag(); if (tag) b.v = tag;
      var u = h.utm();
      if (u.us) b.us = u.us;
      if (u.um) b.um = u.um;
      if (u.uc) b.uc = u.uc;
      var c = h.campaign(); if (c) b.c = c;
      var w = window.innerWidth;
      if (isFinite(w) && w >= 0 && w <= 10000) b.vw = Math.round(w);
      var bl = blang(window.navigator); if (bl) b.bl = bl;
      if (extra) for (var k in extra) b[k] = extra[k];
      return b;
    }

    function send(payload) {
      try {
        var body = JSON.stringify(payload);
        if (window.navigator.sendBeacon && window.navigator.sendBeacon("/api/hit", new Blob([body], { type: "text/plain" }))) return;
        window.fetch("/api/hit", { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(function () {});
      } catch (err) { /* never break the page */ }
    }

    var sent = {};
    window.AWL_track = function (e) {
      if (EVENTS.indexOf(e) < 0 || sent[e]) return;
      sent[e] = true;
      send(full(e));
    };

    send(full("view"));

    // Leave beacon: dwell time + max scroll depth, once per page load.
    var t0 = Date.now(), maxScroll = 0, left = false;
    function onScroll() {
      try {
        var d = document.documentElement, b = document.body;
        var hh = Math.max(d.scrollHeight, b ? b.scrollHeight : 0);
        var vh = window.innerHeight || d.clientHeight || 0;
        var max = Math.max(1, hh - vh);
        var y = window.pageYOffset || d.scrollTop || 0;
        var p = Math.round(Math.min(100, Math.max(0, (y / max) * 100)));
        if (p > maxScroll) maxScroll = p;
      } catch (e) { /* ignore */ }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    function leave() {
      if (left) return;
      left = true;
      var d = Date.now() - t0;
      if (!isFinite(d) || d < 0) d = 0;
      if (d > 3600000) d = 3600000;
      send(full("leave", { d: d, sc: maxScroll }));
    }
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") leave();
    });
  } catch (err) { /* never break the page */ }
})();
