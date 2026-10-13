/*
 * /join/ — shows the WeChat group QR that the owner uploads with
 * infra/analytics-worker/scripts/set-join-qr.ps1 (stored in D1, served by GET /api/join).
 * The QR expires every ~7 days, so it is never committed to the repo. When there is no
 * valid QR (never set, expired, or the request failed) the page shows the email fallback.
 * No inline script/style (site CSP); the image is a data: URL (img-src allows data:).
 */
(function () {
  "use strict";

  // Pure: decides what to show from the /api/join payload. Exposed for tests.
  function decide(data) {
    var g = data && data.group;
    if (g && typeof g.img === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(g.img) &&
        typeof g.expires === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.expires)) {
      return { mode: "qr", img: g.img, expires: g.expires, name: typeof g.name === "string" ? g.name.slice(0, 40) : "" };
    }
    if (data && data.expired === true) return { mode: "expired" };
    return { mode: "none" };
  }

  var api = { decide: decide };
  if (typeof window !== "undefined") window.AWLJoin = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;

  function $(id) { return document.getElementById(id); }

  function show(state) {
    var box = $("qrBox"), none = $("qrNone"), img = $("qrImg");
    if (!box || !none) return;
    if (state.mode === "qr") {
      img.src = state.img;
      if ($("qrUntilEn")) $("qrUntilEn").textContent = state.expires;
      if ($("qrUntilZh")) $("qrUntilZh").textContent = state.expires;
      if ($("qrName") && state.name) $("qrName").textContent = state.name;
      box.hidden = false;
      none.hidden = true;
    } else {
      box.hidden = true;
      none.hidden = false;
      var exp = $("qrExpiredNote");
      if (exp) exp.hidden = state.mode !== "expired";
    }
  }

  function load() {
    fetch("/api/join", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (d) { show(decide(d)); })
      .catch(function () { show({ mode: "none" }); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
})();
