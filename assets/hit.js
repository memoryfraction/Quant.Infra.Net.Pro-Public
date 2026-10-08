/*
 * Site-wide visit tracking (loaded by every page).
 *   1) injects the counter.dev script (public dashboard at counter.dev)
 *   2) POSTs one anonymous-looking beacon to our own Worker (/api/hit); the Worker adds IP and geo server-side
 * window.AWL_track("calc" | "share") records an interaction once per page load.
 * Only runs on the production host, so local previews do not pollute the numbers.
 */
(function () {
  try {
    if (location.hostname !== "www.alpha-wealth-lab.com") return;

    var s = document.createElement("script");
    s.src = "https://cdn.counter.dev/script.js";
    s.async = true;
    s.setAttribute("data-id", "9ed3aabb-f776-4e0b-93ed-a1bab7799a56");
    s.setAttribute("data-utcoffset", "8");
    document.head.appendChild(s);

    var ref = function () {
      try { return document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) { return ""; }
    };
    var send = function (e) {
      try {
        var body = JSON.stringify({ p: location.pathname, e: e, r: ref() });
        if (navigator.sendBeacon && navigator.sendBeacon("/api/hit", new Blob([body], { type: "text/plain" }))) return;
        fetch("/api/hit", { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(function () {});
      } catch (err) { /* never break the page */ }
    };
    var sent = {};
    window.AWL_track = function (e) {
      if ((e === "calc" || e === "share") && !sent[e]) { sent[e] = true; send(e); }
    };
    send("view");
  } catch (err) { /* never break the page */ }
})();
