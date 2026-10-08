(function () {
  var $ = function (id) { return document.getElementById(id); };
  var KEY = "awl_stats_token";
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in (attrs || {})) { if (k === "text") e.textContent = attrs[k]; else if (k === "cls") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function table(head, rows, rowCls) {
    return h("div", { cls: "tablewrap" }, [h("table", null, [
      h("thead", null, [h("tr", null, head.map(function (x) { return h("th", { text: x }); }))]),
      h("tbody", null, rows.map(function (r, i) { return h("tr", { cls: (rowCls && rowCls[i]) || "" }, r.map(function (c) { return h("td", { text: String(c) }); })); }))
    ])]);
  }
  function panel(title, node) { return h("section", { cls: "panel" }, [h("h2", { text: title }), node]); }
  function ratio(v, c) { return v > 0 ? (c / v * 100).toFixed(1) + "%" : "—"; }
  function place(r) { return [r.country, r.region, r.city, r.postal].filter(Boolean).join(" / "); }

  function chart(daily, from, to) {
    var days = [], d = new Date(from + "T00:00:00Z"), end = new Date(to + "T00:00:00Z");
    while (d <= end) { days.push(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 86400000); }
    var m = {}; daily.forEach(function (r) { if (r.event === "view") m[r.day] = (m[r.day] || 0) + r.n; });
    var cv = h("canvas", { role: "img", "aria-label": "daily views" });
    var box = h("div", { cls: "chartbox" }, [cv]);
    setTimeout(function () {
      var dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect(); cv.width = r.width * dpr; cv.height = r.height * dpr;
      var c = cv.getContext("2d"); c.scale(dpr, dpr);
      var W = r.width, H = r.height, L = 40, R = 10, T = 10, B = 24, vals = days.map(function (x) { return m[x] || 0; }), max = Math.max.apply(null, vals.concat([1]));
      var X = function (i) { return L + (W - L - R) * (days.length > 1 ? i / (days.length - 1) : 0); }, Y = function (v) { return T + (H - T - B) * (1 - v / max); };
      c.font = "12px sans-serif"; c.fillStyle = "#5B6B69"; c.strokeStyle = "#E3E9E6";
      for (var i = 0; i <= 4; i++) { var v = max * i / 4; c.beginPath(); c.moveTo(L, Y(v)); c.lineTo(W - R, Y(v)); c.stroke(); c.textAlign = "right"; c.fillText(Math.round(v), L - 6, Y(v) + 4); }
      c.textAlign = "center"; var step = Math.ceil(days.length / 8);
      days.forEach(function (x, i) { if (i % step === 0) c.fillText(x.slice(5), X(i), H - 6); });
      c.strokeStyle = "#0F5C55"; c.lineWidth = 2; c.beginPath(); vals.forEach(function (v, i) { if (i) c.lineTo(X(i), Y(v)); else c.moveTo(X(i), Y(v)); }); c.stroke();
    }, 0);
    return box;
  }

  function show(d) {
    var out = $("out"); out.textContent = "";
    out.appendChild(panel("概览", h("p", { text: "区间 " + d.from + " ~ " + d.to + "；浏览 " + (d.summary.views || 0) + " 次；计算 " + (d.summary.calcs || 0) + " 次" })));
    var cls = d.totals.map(function (r) { var v = r.view, c = r.calc; return v > 0 && c / v >= 0.4 ? "good" : (v >= 20 && c / v < 0.15 ? "bad" : ""); });
    out.appendChild(panel("页面排行", table(["路径", "浏览", "计算", "转化率", "分享"], d.totals.map(function (r) { return [r.path, r.view, r.calc, ratio(r.view, r.calc), r.share]; }), cls)));
    out.appendChild(panel("每日浏览", chart(d.daily, d.from, d.to)));
    out.appendChild(panel("地区（国家 / 省 / 城市 / 邮编）", table(["地区", "经纬度", "时区", "浏览"], d.geo.map(function (r) { return [place(r) || "未知", r.lat === null ? "" : r.lat + ", " + r.lon, r.tz, r.n]; }))));
    out.appendChild(panel("来源域", table(["来源", "浏览"], d.refs.map(function (r) { return [r.ref === "" ? "直接访问" : (r.ref === "self" ? "站内跳转" : r.ref), r.n]; }))));
    out.appendChild(panel("最近 100 次访问", table(["时间 (UTC)", "路径", "事件", "地区", "来源"], d.recent.map(function (r) {
      return [new Date(r.ts * 1000).toISOString().replace("T", " ").slice(0, 19), r.path, r.event, place(r), r.ref];
    }))));
  }
  function load() {
    var tok = $("token").value.trim(); if (!tok) { $("msg").textContent = "请输入 token"; return; }
    try { sessionStorage.setItem(KEY, tok); } catch (e) { /* ignore */ }
    $("msg").textContent = "加载中…";
    fetch("/api/stats?days=" + encodeURIComponent($("days").value), { headers: { Authorization: "Bearer " + tok }, cache: "no-store" })
      .then(function (r) { if (r.status === 401) throw new Error("token 不正确"); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) { $("msg").textContent = ""; show(d); })
      .catch(function (e) { $("msg").textContent = e.message; });
  }
  $("load").addEventListener("click", load);
  $("clear").addEventListener("click", function () { try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } $("token").value = ""; $("out").textContent = ""; });
  try { var s = sessionStorage.getItem(KEY); if (s) { $("token").value = s; } } catch (e) { /* ignore */ }
})();
