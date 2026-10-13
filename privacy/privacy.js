/*
 * privacy.js — the "your identifier" control on /privacy/.
 *
 * Shows the anonymous visitor identifier this browser has actually been sending, lets the user
 * copy it (for a deletion request) and reset it. Everything is read/written through AWLLib so
 * the identifier shown here is byte-for-byte the one the tracker uses — never a re-derivation.
 * No inline script / no cookies (site CSP + the site's own no-cookie rule).
 */
(function () {
  "use strict";

  var L = window.AWLLib;
  var VID_KEY = "awl_vid";
  var SID_KEY = "awl_sid";
  var COPY_MS = 1600;

  // Localised strings for the two language blocks. Kept here (not in the shared dict) because
  // this page does not load planner/assets/common.js.
  var T = {
    en: {
      empty: "No identifier yet — nothing has been stored in this browser.",
      cantStore: "This browser blocks local storage, so no identifier can be created or read.",
      copied: "Copied. Paste it into your email to us.",
      copyFail: "Copy failed — select the text above and copy it manually.",
      resetMsg: "Identifier reset. A new one will be created only on your next tool visit.",
      resetNothing: "There was no identifier to reset.",
      gpc: "Your browser sends Global Privacy Control, so this site does not create or use any identifier.",
      cannotReset: "This browser blocks local storage, so there is nothing to reset."
    },
    zh: {
      empty: "还没有标识——本浏览器中没有保存任何标识。",
      cantStore: "本浏览器禁止使用本地存储，因此无法创建或读取标识。",
      copied: "已复制，请粘贴到发给我们的邮件里。",
      copyFail: "复制失败——请手动选中上方文本复制。",
      resetMsg: "标识已重置。下次你打开工具页时才会生成新的标识。",
      resetNothing: "当前没有标识需要重置。",
      gpc: "你的浏览器发送了全局隐私控制信号，因此本站不会创建或使用任何标识。",
      cannotReset: "本浏览器禁止使用本地存储，因此没有可重置的内容。"
    }
  };

  function lang() {
    if (window.SiteLang && typeof window.SiteLang.get === "function") {
      var l = window.SiteLang.get();
      if (l === "zh" || l === "en") return l;
    }
    var attr = document.documentElement && document.documentElement.lang;
    return String(attr || "").toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
  }
  function t(key) { var d = T[lang()] || T.en; return d[key] || T.en[key] || ""; }

  function gpcOn() {
    try { return !!(window.navigator && window.navigator.globalPrivacyControl === true); } catch (e) { return false; }
  }

  // Each language block has its own controls; wire whichever ones exist.
  var PANES = [
    { out: "vidOut", copy: "vidCopy", reset: "vidReset", msg: "vidMsg" },
    { out: "vidOutZh", copy: "vidCopyZh", reset: "vidResetZh", msg: "vidMsgZh" }
  ];

  function storeOk() {
    // AWLLib returns "" when storage is unavailable *or* under GPC. Probe storage directly so we
    // can tell the two apart and show the right message.
    try {
      var k = "awl_probe_v1";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return !!window.localStorage;
    } catch (e) { return false; }
  }

  function currentVid() {
    if (!L || typeof L.getVid !== "function") return "";
    try { return L.getVid(window.localStorage) || ""; } catch (e) { return ""; }
  }

  function render(keepMsg) {
    var canStore = storeOk();
    var isGpc = gpcOn();
    var vid = isGpc ? "" : currentVid();

    for (var i = 0; i < PANES.length; i++) {
      var p = PANES[i];
      var out = document.getElementById(p.out);
      var msg = document.getElementById(p.msg);
      var copyBtn = document.getElementById(p.copy);
      var resetBtn = document.getElementById(p.reset);
      if (out) out.value = vid;
      if (copyBtn) copyBtn.disabled = !vid;
      if (resetBtn) resetBtn.disabled = !canStore;
      // Callers that just wrote a message (copy / reset) pass keepMsg so render() does not wipe it.
      if (msg && !keepMsg) {
        if (isGpc) msg.textContent = t("gpc");
        else if (!canStore) msg.textContent = t("cantStore");
        else if (!vid) msg.textContent = t("empty");
        else msg.textContent = "";
      }
    }
  }

  // Copy without navigator.clipboard (which needs a secure context and can be flaky in-app).
  function copy(text, msgEl) {
    var done = false;
    try {
      if (window.navigator && window.navigator.clipboard && window.navigator.clipboard.writeText) {
        var pr = window.navigator.clipboard.writeText(text);
        if (pr && typeof pr.then === "function") {
          pr.then(function () { say(msgEl, t("copied"), true); },
                  function () { fallback(text, msgEl); });
          return;
        }
        done = true;
      }
    } catch (e) { done = false; }
    if (!done) fallback(text, msgEl);
  }
  function fallback(text, msgEl) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.className = "copy-src";
    document.body.appendChild(ta);
    var ok = false;
    try {
      ta.select();
      ok = document.execCommand && document.execCommand("copy");
    } catch (e) { ok = false; }
    document.body.removeChild(ta);
    say(msgEl, ok ? t("copied") : t("copyFail"), ok);
  }
  var msgTimer = null;
  function say(msgEl, text, ok) {
    if (!msgEl) return;
    msgEl.textContent = text;
    if (msgTimer) { window.clearTimeout(msgTimer); msgTimer = null; }
    if (ok) {
      msgTimer = window.setTimeout(function () {
        msgTimer = null;
        // Put the steady-state message back.
        render();
      }, COPY_MS);
    }
  }

  function reset(msgEl) {
    var had = false;
    try {
      if (L && typeof L.getVid === "function") had = !!L.getVid(window.localStorage);
    } catch (e) { had = false; }
    try {
      window.localStorage.removeItem(VID_KEY);
      window.localStorage.removeItem(SID_KEY);
      window.localStorage.removeItem("awl_last");
    } catch (e) { /* blocked: nothing to reset */ }
    // Also clear the per-tab session id so the two do not disagree until the tab closes.
    try { window.sessionStorage.removeItem(SID_KEY); } catch (e) { /* ignore */ }
    say(msgEl, had ? t("resetMsg") : t("resetNothing"), false);
    render(true);   // keep the confirmation on screen; the fields still refresh
  }

  function wire() {
    for (var i = 0; i < PANES.length; i++) {
      (function (p) {
        var copyBtn = document.getElementById(p.copy);
        var resetBtn = document.getElementById(p.reset);
        var msgEl = document.getElementById(p.msg);
        if (copyBtn) copyBtn.addEventListener("click", function () {
          var v = currentVid();
          if (!v) { say(msgEl, t("empty"), false); return; }
          copy(v, msgEl);
        });
        if (resetBtn) resetBtn.addEventListener("click", function () { reset(msgEl); });
      })(PANES[i]);
    }
    render();
  }

  if (window.SiteLang && typeof window.SiteLang.subscribe === "function") {
    window.SiteLang.subscribe(function () { render(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
