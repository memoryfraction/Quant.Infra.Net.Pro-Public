/*
 * stats/stats.js — the private analytics dashboard.
 *
 * Renders the ten blocks required by the phase-1 spec from a single
 * GET /api/stats response, plus a CSV export dropdown that pulls from
 * /api/admin/export. Every value goes in via textContent (feedback comments
 * are plain text, never HTML) and the token lives in sessionStorage only.
 */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var KEY = "awl_stats_token";

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "cls") e.className = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(c); });
    return e;
  }
  function table(head, rows, rowCls) {
    return h("div", { cls: "tablewrap" }, [h("table", null, [
      h("thead", null, [h("tr", null, head.map(function (x) { return h("th", { text: x }); }))]),
      h("tbody", null, rows.map(function (r, i) {
        return h("tr", { cls: (rowCls && rowCls[i]) || "" }, r.map(function (c) {
          if (c && typeof c === "object" && c.node) return h("td", null, [c.node]);
          return h("td", { text: String(c == null ? "" : c) });
        }));
      }))
    ])]);
  }
  function panel(title, node, hint) {
    var k = [h("h2", { text: title })];
    if (hint) k.push(h("p", { cls: "hint", text: hint }));
    k.push(node);
    return h("section", { cls: "panel" }, k);
  }
  function pct1(x) { return (x === null || x === undefined || !isFinite(x)) ? "—" : (x * 100).toFixed(1) + "%"; }
  function ratio(v, c) { return v > 0 ? (c / v * 100).toFixed(1) + "%" : "—"; }
  function n0(x) { return (x === null || x === undefined) ? 0 : x; }
  function place(r) { return [r.country, r.region, r.city, r.postal].filter(Boolean).join(" / "); }
  function tsFmt(t) { return t ? new Date(t * 1000).toISOString().replace("T", " ").slice(0, 19) : ""; }

  // ---- generic "distribution" block -------------------------------------
  // The worker returns distributions in three different shapes, so normalise
  // instead of trusting the caller:
  //   {key, n}  -- profile card / new-vs-returning built locally
  //   {v, n}    -- bare "SELECT col v, COUNT(*) n" rows (age_band, goal, ...)
  //   ["值", n] -- countOptions() -> Object.entries(), i.e. an array pair
  // Anything else (undefined, an object, a scalar) degrades to an empty list
  // rather than throwing inside show() and killing every later block.
  function distList(rows, col) {
    if (!Array.isArray(rows)) return [];
    return rows.map(function (r) {
      if (Array.isArray(r)) return { key: r[0], n: r[1] };
      if (r && typeof r === "object") {
        // `col` covers rows selected without an alias, e.g. SELECT device, ...
        var k = r.key !== undefined ? r.key : (r.v !== undefined ? r.v : (col && r[col] !== undefined ? r[col] : (r.name !== undefined ? r.name : r.label)));
        return { key: k, n: r.n !== undefined ? r.n : r.count };
      }
      return { key: r, n: 0 };
    });
  }
  function distRows(rows, total, col) {
    var list = distList(rows, col);
    var t = total === undefined ? list.reduce(function (a, r) { return a + n0(r.n); }, 0) : total;
    return list.map(function (r) {
      return [r.key == null || r.key === "" ? "(空)" : r.key, n0(r.n), t > 0 ? pct1(n0(r.n) / t) : "—"];
    });
  }
  function distPanel(title, rows, keyHead, hint) {
    var list = distList(rows);
    if (!list.length) return panel(title, h("p", { cls: "hint", text: "暂无数据" }), hint);
    return panel(title, table([keyHead || "取值", "数量", "占比"], distRows(list)), hint);
  }

  // ---- daily views chart ------------------------------------------------
  function chart(daily, from, to) {
    var days = [], d = new Date(from + "T00:00:00Z"), end = new Date(to + "T00:00:00Z");
    while (d <= end) { days.push(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 86400000); }
    var m = {};
    (daily || []).forEach(function (r) { if (r.event === "view") m[r.day] = (m[r.day] || 0) + r.n; });
    var cv = h("canvas", { role: "img", "aria-label": "daily views" });
    var box = h("div", { cls: "chartbox" }, [cv]);
    setTimeout(function () {
      var dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
      if (!r.width) return;
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      var c = cv.getContext("2d"); c.scale(dpr, dpr);
      var W = r.width, H = r.height, L = 40, R = 10, T = 10, B = 24;
      var vals = days.map(function (x) { return m[x] || 0; });
      var max = Math.max.apply(null, vals.concat([1]));
      var X = function (i) { return L + (W - L - R) * (days.length > 1 ? i / (days.length - 1) : 0); };
      var Y = function (v) { return T + (H - T - B) * (1 - v / max); };
      c.font = "12px sans-serif"; c.fillStyle = "#5B6B69"; c.strokeStyle = "#E3E9E6";
      for (var i = 0; i <= 4; i++) {
        var v = max * i / 4;
        c.beginPath(); c.moveTo(L, Y(v)); c.lineTo(W - R, Y(v)); c.stroke();
        c.textAlign = "right"; c.fillText(String(Math.round(v)), L - 6, Y(v) + 4);
      }
      c.textAlign = "center";
      var step = Math.max(1, Math.ceil(days.length / 8));
      days.forEach(function (x, i) { if (i % step === 0) c.fillText(x.slice(5), X(i), H - 6); });
      c.strokeStyle = "#0F5C55"; c.lineWidth = 2; c.beginPath();
      vals.forEach(function (v, i) { if (i) c.lineTo(X(i), Y(v)); else c.moveTo(X(i), Y(v)); });
      c.stroke();
    }, 0);
    return box;
  }

  // ---- retention curve --------------------------------------------------
  function cohortPanel(cohorts) {
    var keys = Object.keys(cohorts || {}).sort();
    if (!keys.length) return panel("新老访客与留存曲线", h("p", { cls: "hint", text: "暂无数据" }));
    var rows = keys.map(function (k) {
      var c = cohorts[k];
      return [k, n0(c.cohort), pct1(c.d1), pct1(c.d7), pct1(c.d30)];
    });
    return panel("新老访客与留存曲线", table(["首见日期", "新增访客", "次日留存", "7 日留存", "30 日留存"], rows));
  }

  // ---- ⑥ per-tool inputs ------------------------------------------------
  // Worker shape (src/index.js summarizeInputs L429-442):
  //   { numeric: { k: {p25, med, p75, n} }, categorical: { k: [[值, n], ...] } }
  // Note "med", not "median"; and categoricals are array pairs, not objects.
  function inputsPanel(calcs) {
    var byTool = distList((calcs && calcs.byTool) || [], "tool");
    var kids = [table(["工具", "计算次数"], byTool.map(function (r) { return [r.key, n0(r.n)]; }))];
    var ins = (calcs && calcs.inputs) || {};
    var num = ins.numeric || {};
    var numKeys = Object.keys(num);
    if (numKeys.length) {
      kids.push(h("h3", { text: "数值输入的 P25 / 中位数 / P75" }));
      kids.push(table(["输入", "P25", "中位数", "P75", "样本"], numKeys.map(function (k) {
        var v = num[k] || {};
        var med = v.med !== undefined ? v.med : v.median;
        return [k, fmtNum(v.p25), fmtNum(med), fmtNum(v.p75), n0(v.n)];
      })));
    }
    var cat = ins.categorical || {};
    var catKeys = Object.keys(cat);
    if (catKeys.length) {
      kids.push(h("h3", { text: "选择型输入的取值分布" }));
      kids.push(table(["输入", "取值 (数量)"], catKeys.map(function (k) {
        var pairs = distList(cat[k]);
        return [k, pairs.map(function (o) { return o.key + " (" + n0(o.n) + ")"; }).join("，").slice(0, 120)];
      })));
    }
    // Back-compat: an older/synthetic payload may carry a flat `inputs` map.
    var flat = Object.keys(ins).filter(function (k) { return k !== "numeric" && k !== "categorical"; });
    if (!numKeys.length && !catKeys.length && flat.length) {
      kids.push(table(["输入", "P25", "中位数", "P75", "样本"], flat.map(function (k) {
        var v = ins[k] || {};
        return [k, fmtNum(v.p25), fmtNum(v.median), fmtNum(v.p75), n0(v.n)];
      })));
    }
    return panel("各工具计算次数与输入分布", h("div", null, kids));
  }
  function fmtNum(v) { return (v === null || v === undefined || !isFinite(v)) ? "—" : String(Math.round(v * 100) / 100); }

  function show(d) {
    var out = $("out");
    out.textContent = "";

    var s = d.summary || {};
    var uniq = d.uniques || {};

    // ① overview
    out.appendChild(panel("① 概览", h("div", null, [
      h("p", { cls: "hint", text: "区间 " + d.from + " ~ " + d.to }),
      table(["指标", "数值"], [
        ["浏览次数", n0(s.views)],
        ["独立访客 (vid)", n0(uniq.vids)],
        ["去重 IP 哈希", n0(uniq.ip_hashes)],
        ["会话 (sid)", n0(d.sessions)],
        ["计算次数", n0(s.calcs)],
        ["留存转化率 (share+save+load+join+订阅确认 / calc)", d.retention && d.retention.overall != null ? pct1(d.retention.overall) : "—"]
      ]),
      h("p", { cls: "hint", text: "转化率 = 计算次数 / 浏览次数，比浏览量更能说明工具是否真的有用。" })
    ])));

    // ② new vs returning + cohort retention
    var nv = d.newVsReturning || { new: 0, returning: 0 };
    out.appendChild(panel("② 新老访客", table(["类型", "数量", "占比"], distRows([
      { key: "新访客", n: nv.new }, { key: "回访", n: nv.returning }
    ]))));
    out.appendChild(cohortPanel(d.cohorts));

    // ③ devices / os / browsers (highlight WeChat)
    var wx = d.wechat || { count: 0, share: null };
    out.appendChild(panel("③ 设备 / 系统 / 浏览器", h("div", null, [
      h("p", { cls: "hint", text: "微信内置浏览器占比：" + pct1(wx.share) + "（" + n0(wx.count) + " 次）" }),
      h("h3", { text: "设备" }), table(["类型", "数量", "占比"], distRows(d.devices || [], undefined, "device")),
      h("h3", { text: "系统" }), table(["系统", "数量", "占比"], distRows(d.os || [], undefined, "os")),
      h("h3", { text: "浏览器" }), table(["浏览器", "数量", "占比"], distRows(d.browsers || [], undefined, "browser"))
    ])));

    // ④ referrers + utm
    var utm = d.utm || {};
    var refRows = (d.referrers || []).map(function (r) {
      return [r.ref === "" ? "直接访问" : (r.ref === "self" ? "站内跳转" : r.ref), n0(r.n)];
    });
    // The worker aliases these value columns as s / c (see worker src/index.js
    // L474-477), so pass the column hint rather than assuming `.key`/`.v`.
    var utmRows = function (rows, col) {
      return distRows(rows, undefined, col).map(function (r) { return [r[0] === "(空)" ? "—" : r[0], r[1]]; });
    };
    out.appendChild(panel("④ 来源与 UTM", h("div", null, [
      h("h3", { text: "来源域" }),
      table(["来源", "浏览"], refRows),
      h("h3", { text: "utm_source" }), table(["来源", "数量"], utmRows(utm.source || [], "s")),
      h("h3", { text: "utm_medium" }), table(["媒介", "数量"], utmRows(utm.medium || [], "s")),
      h("h3", { text: "utm_campaign" }), table(["活动", "数量"], utmRows(utm.campaign || [], "s")),
      h("h3", { text: "站内活动 (from=)" }), table(["活动", "数量"], utmRows(d.campaigns || [], "c"))
    ])));

    // ⑤ per-page dwell time + scroll depth
    // The worker already returns seconds (ROUND(AVG(dur_ms)/1000.0,1) avg_s,
    // worker L468), so do NOT divide by 1000 again here.
    out.appendChild(panel("⑤ 分页面停留时长与滚动深度", (d.engagement || []).length
      ? table(["页面", "浏览", "平均停留 (秒)", "平均滚动深度"], d.engagement.map(function (r) {
        var secs = r.avg_s !== undefined ? r.avg_s : (r.avg_dur_ms == null ? null : n0(r.avg_dur_ms) / 1000);
        return [r.path, n0(r.n), secs == null ? "—" : fmtNum(secs), pct1(r.avg_scroll == null ? null : r.avg_scroll / 100)];
      }))
      : h("p", { cls: "hint", text: "暂无数据" })));

    // ⑥ calcs
    out.appendChild(inputsPanel(d.calcs));

    // ⑦ profile
    var pr = d.profiles || {};
    out.appendChild(panel("⑦ 用户画像", h("div", null, [
      h("h3", { text: "年龄段" }), table(["取值", "数量", "占比"], distRows(pr.age_band || [])),
      h("h3", { text: "资产区间" }), table(["取值", "数量", "占比"], distRows(pr.asset_band || [])),
      h("h3", { text: "目标" }), table(["取值", "数量", "占比"], distRows(pr.goal || [])),
      h("h3", { text: "投资市场" }), table(["取值", "数量", "占比"], distRows(pr.markets || [])),
      h("h3", { text: "信谁的方法" }), table(["取值", "数量", "占比"], distRows(pr.follows || [])),
      h("h3", { text: "杠杆经验" }), table(["取值", "数量", "占比"], distRows(pr.leverage_exp || []))
    ])));

    // ⑧ wtp
    out.appendChild(panel("⑧ 付费意愿", (d.wtp || []).length
      ? table(["选项", "数量", "占比"], distRows(d.wtp))
      : h("p", { cls: "hint", text: "暂无数据" })));

    // ⑨ subscribers
    var sub = d.subscribers || {};
    out.appendChild(panel("⑨ 订阅数量", table(["状态", "数量"], [
      ["待确认 (pending)", n0(sub.pending)],
      ["已确认 (confirmed)", n0(sub.confirmed)],
      ["已退订 (unsubscribed)", n0(sub.unsubscribed)]
    ])));

    // ⑩ feedback (comments as plain text)
    var fb = d.feedback || [];
    out.appendChild(panel("⑩ 最近反馈", fb.length
      ? table(["时间 (UTC)", "工具", "语言", "评分", "付费意愿", "留言", "联系方式"], fb.map(function (r) {
        return [tsFmt(r.ts), r.tool, r.lang, n0(r.rating), r.wtp || "", String(r.message || ""), r.contact || ""];
      }))
      : h("p", { cls: "hint", text: "暂无反馈" })));
  }

  // ---- CSV export --------------------------------------------------------
  function exportCsv() {
    var tok = $("token").value.trim();
    if (!tok) { $("msg").textContent = "请先输入 token 再导出"; return; }
    var tbl = $("exportTable").value, days = $("exportDays").value;
    $("msg").textContent = "导出中…";
    fetch("/api/admin/export?table=" + encodeURIComponent(tbl) + "&days=" + encodeURIComponent(days), {
      headers: { Authorization: "Bearer " + tok }, cache: "no-store"
    }).then(function (r) {
      if (r.status === 401) throw new Error("token 不正确");
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.blob();
    }).then(function (blob) {
      $("msg").textContent = "";
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "awl-" + tbl + "-" + days + "d.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }).catch(function (e) { $("msg").textContent = e.message; });
  }

  function load() {
    var tok = $("token").value.trim();
    if (!tok) { $("msg").textContent = "请输入 token"; return; }
    try { sessionStorage.setItem(KEY, tok); } catch (e) { /* ignore */ }
    $("msg").textContent = "加载中…";
    fetch("/api/stats?days=" + encodeURIComponent($("days").value), {
      headers: { Authorization: "Bearer " + tok }, cache: "no-store"
    }).then(function (r) {
      if (r.status === 401) throw new Error("token 不正确");
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (d) { $("msg").textContent = ""; show(d); })
      .catch(function (e) { $("msg").textContent = e.message; });
  }

  $("load").addEventListener("click", load);
  $("export").addEventListener("click", exportCsv);
  $("clear").addEventListener("click", function () {
    try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    $("token").value = "";
    $("out").textContent = "";
    $("msg").textContent = "";
  });
  try { var s = sessionStorage.getItem(KEY); if (s) $("token").value = s; } catch (e) { /* ignore */ }
})();
