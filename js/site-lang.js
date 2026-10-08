/*
 * site-lang.js: the one language preference for www.alpha-wealth-lab.com.
 *
 * Same rules as js/app.js on the home page:
 *   - stored in localStorage["lang"] as "en" | "zh" (shared by every page on this origin)
 *   - no saved choice: first supported language in the browser's preference order, else English
 *
 * Stand-alone pages (/calculator/, /macro/) load this instead of keeping their own copy:
 *   SiteLang.get()          -> "en" | "zh"
 *   SiteLang.set("zh")      -> save, update <html lang> and #langSelect, notify subscribers
 *   SiteLang.subscribe(fn)  -> fn(lang) on every change, including changes made in another tab
 * A <select id="langSelect"> on the page is wired automatically.
 */
(function () {
  var KEY = "lang", SUPPORTED = ["en", "zh"], DEFAULT = "en";
  var listeners = [];

  function norm(v) {
    var c = String(v || "").toLowerCase().split(/[-_]/)[0];
    return SUPPORTED.indexOf(c) !== -1 ? c : null;
  }
  function saved() {
    try { return norm(localStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function detect() {
    var prefs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ""];
    for (var i = 0; i < prefs.length; i++) { var m = norm(prefs[i]); if (m) return m; }
    return DEFAULT;
  }

  var current = saved() || detect();

  function apply() {
    document.documentElement.lang = current === "zh" ? "zh-CN" : "en";
    var sel = document.getElementById("langSelect");
    if (sel) sel.value = current;
  }
  function set(lang, fromOtherTab) {
    var l = norm(lang);
    if (!l) return;
    current = l;
    if (!fromOtherTab) { try { localStorage.setItem(KEY, l); } catch (e) { /* storage unavailable */ } }
    apply();
    for (var i = 0; i < listeners.length; i++) listeners[i](l);
  }

  window.SiteLang = {
    get: function () { return current; },
    set: function (l) { set(l, false); },
    subscribe: function (fn) { listeners.push(fn); }
  };

  window.addEventListener("storage", function (e) {
    if (e.key !== KEY) return;
    var n = norm(e.newValue);
    if (n && n !== current) set(n, true);
  });

  function init() {
    var sel = document.getElementById("langSelect");
    if (sel) sel.addEventListener("change", function (e) { set(e.target.value, false); });
    try { localStorage.setItem(KEY, current); } catch (e) { /* storage unavailable */ }
    apply();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
