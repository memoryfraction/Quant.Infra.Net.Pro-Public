/*
 * subscribed.js — picks which status card to show on /planner/subscribed/.
 *
 * The Worker redirects here with one of:
 *   ?ok=1      confirmation succeeded
 *   ?ok=0      confirmation token invalid / already used
 *   ?unsub=1   unsubscribed
 * Anything else (including ?ok=0&unsub=1 style combinations) shows the neutral card.
 * Cases are ordered by importance: a successful unsubscribe is the most recent user intent, so it
 * wins over a stale ok=1 that some mail clients may have left in the URL.
 */
(function () {
  "use strict";

  var CASES = ["caseOk", "caseBad", "caseUnsub", "caseNone"];

  function params() {
    var out = {};
    try {
      var s = new URLSearchParams(window.location.search);
      out.ok = s.get("ok");
      out.unsub = s.get("unsub");
    } catch (e) {
      // No URLSearchParams (very old browser): best effort, neutral card.
    }
    return out;
  }

  function which(p) {
    if (p.unsub === "1") return "caseUnsub";
    if (p.ok === "1") return "caseOk";
    if (p.ok === "0") return "caseBad";
    return "caseNone";
  }

  function show() {
    var want = which(params());
    for (var i = 0; i < CASES.length; i++) {
      var el = document.getElementById(CASES[i]);
      if (!el) continue;
      if (CASES[i] === want) el.removeAttribute("hidden");
      else el.setAttribute("hidden", "");
    }
    // Title reflects the outcome rather than a generic "Subscription".
    var t = {
      caseOk: { en: "Subscription confirmed", zh: "订阅确认成功" },
      caseBad: { en: "Confirmation link invalid", zh: "确认链接无效" },
      caseUnsub: { en: "Unsubscribed", zh: "已退订" },
      caseNone: { en: "Subscription status", zh: "订阅状态" }
    }[want];
    var h1 = document.querySelector("h1");
    if (!h1 || !t) return;
    var l = window.SiteLang && window.SiteLang.get ? window.SiteLang.get() : "en";
    var en = h1.querySelector(".l-en"), zh = h1.querySelector(".l-zh");
    if (en) en.textContent = t.en;
    if (zh) zh.textContent = t.zh;
    void l;
    document.title = (l === "zh" ? t.zh : t.en) + " | Alpha Wealth Lab";
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", show);
  else show();
  if (window.SiteLang && window.SiteLang.subscribe) window.SiteLang.subscribe(function () { show(); });
})();
