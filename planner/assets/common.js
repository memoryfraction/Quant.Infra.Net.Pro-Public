/*
 * Shared runtime for /planner/* tool pages. Depends on /js/site-lang.js (SiteLang) being loaded first.
 * No inline scripts/styles anywhere (site CSP: script-src 'self').
 *
 *   AWL.mount({ I18N:{zh,en}, fields:[...], render(v,t) -> Node[] | false })
 *
 * field: { id, type:"num"|"pct"|"chk"|"sel"|"text", def, lbl, hint?, step?, opts?:[[value,labelKeyOrText]], sec?, show?(v) }
 *   "pct" fields are typed as percentages and handed to render() as decimals (4 -> 0.04).
 */
(function () {
  "use strict";

  var COMMON = {
    en: {
      back: "Tools", home: "Home", inputs: "Inputs", results: "Results", method: "Method & formulas",
      invalid: "Please check the inputs (some values are empty or out of range).",
      disclaimer: "This tool simply turns the published methods in “Wealth Shortcut” (by 硅谷居士) and the “CLEC Handbook” into calculators, for my own use and for anyone who finds them helpful. Results are for learning only and are not investment, tax or legal advice; please make your own decisions. This site is not affiliated with or endorsed by the authors, CLEC or James."
    },
    zh: {
      back: "工具箱", home: "首页", inputs: "输入", results: "结果", method: "方法与公式",
      invalid: "请检查输入（有的值为空或超出范围）。",
      disclaimer: "本工具只是把《财富捷径》（硅谷居士）与《CLEC 宝典》中的公开方法论做成计算器，方便大家和我自己使用。计算结果仅供学习参考，不构成任何投资、税务或法律建议；请结合自身情况独立判断，盈亏自负。本站与原作者、CLEC 及 James 老师均无关联，也未获其背书。"
    }
  };

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "text") el.textContent = attrs[k];
      else if (k === "cls") el.className = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) el.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }

  var nf = {};
  function fmt(x, d) {
    if (x === null || x === undefined || !isFinite(x)) return "—";
    d = d === undefined ? 0 : d;
    nf[d] = nf[d] || new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
    return nf[d].format(x);
  }
  function pct(x, d) { return x === null || x === undefined || !isFinite(x) ? "—" : fmt(x * 100, d === undefined ? 1 : d) + "%"; }

  // ---- result building blocks ----
  function kpis(items) {
    return h("div", { cls: "kpis" }, items.map(function (i) {
      return h("div", { cls: "kpi" + (i[2] ? " " + i[2] : "") }, [h("div", { cls: "l", text: i[0] }), h("div", { cls: "v", text: i[1] })]);
    }));
  }
  function table(head, rows, opt) {
    opt = opt || {};
    var tb = h("tbody", null, rows.map(function (r, idx) {
      var cls = opt.hl === idx ? "hl" : (opt.rowCls && opt.rowCls[idx]) || "";
      return h("tr", { cls: cls }, r.map(function (c) {
        if (c && typeof c === "object" && c.nodeType) return h("td", null, [c]);
        if (c && typeof c === "object") return h("td", { cls: c.cls || "", text: c.t });
        return h("td", { text: String(c) });
      }));
    }));
    return h("div", { cls: "tablewrap" }, [h("table", null, [h("thead", null, [h("tr", null, head.map(function (x) { return h("th", { text: x }); }))]), tb])]);
  }
  function badge(text, cls) { return h("span", { cls: "badge " + (cls || "") , text: text }); }
  function note(text) { return h("p", { cls: "note", text: text }); }
  function panel(title, kids, hint) {
    var k = [];
    if (title) k.push(h("h2", { text: title }));
    if (hint) k.push(h("p", { cls: "hint", text: hint }));
    return h("section", { cls: "panel" }, k.concat(kids));
  }

  // Canvas multi-line chart. series: [{name,color,pts:[y...]}], opt: {xs:[labels], hlines:[{y,color,label}], fmtY}
  function drawLines(canvas, series, opt) {
    opt = opt || {};
    var dpr = window.devicePixelRatio || 1, r = canvas.getBoundingClientRect();
    if (!r.width) return;
    canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    var c = canvas.getContext("2d"); c.scale(dpr, dpr);
    var W = r.width, H = r.height, L = 56, R = 12, T = 10, B = 24;
    var all = []; series.forEach(function (s) { s.pts.forEach(function (y) { if (isFinite(y)) all.push(y); }); });
    (opt.hlines || []).forEach(function (l) { all.push(l.y); });
    var lo = Math.min.apply(null, all.concat([0])), hi = Math.max.apply(null, all);
    if (hi === lo) hi = lo + 1;
    var n = Math.max.apply(null, series.map(function (s) { return s.pts.length; }));
    var x = function (i) { return L + (W - L - R) * (n > 1 ? i / (n - 1) : 0); };
    var y = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };
    c.font = "12px IBM Plex Sans, Noto Sans SC, sans-serif"; c.fillStyle = "#5B6B69"; c.strokeStyle = "#E3E9E6"; c.lineWidth = 1;
    var f = opt.fmtY || function (v) { return fmt(v, 0); };
    for (var i = 0; i <= 4; i++) {
      var v = lo + (hi - lo) * i / 4, yy = y(v);
      c.beginPath(); c.moveTo(L, yy); c.lineTo(W - R, yy); c.stroke();
      c.textAlign = "right"; c.fillText(f(v), L - 6, yy + 4);
    }
    c.textAlign = "center";
    if (opt.xs) { var step = Math.max(1, Math.ceil(opt.xs.length / 8)); opt.xs.forEach(function (lb, i) { if (i % step === 0) c.fillText(lb, x(i), H - 6); }); }
    (opt.hlines || []).forEach(function (l) {
      c.save(); c.setLineDash([5, 4]); c.strokeStyle = l.color; c.beginPath(); c.moveTo(L, y(l.y)); c.lineTo(W - R, y(l.y)); c.stroke(); c.restore();
      if (l.label) { c.fillStyle = l.color; c.textAlign = "left"; c.fillText(l.label, L + 4, y(l.y) - 4); }
    });
    series.forEach(function (s) {
      c.strokeStyle = s.color; c.lineWidth = 2; c.beginPath(); var started = false;
      s.pts.forEach(function (v, i) { if (!isFinite(v)) return; if (!started) { c.moveTo(x(i), y(v)); started = true; } else c.lineTo(x(i), y(v)); });
      c.stroke();
    });
  }
  function chartBox(id, legend) {
    var kids = [h("div", { cls: "chartbox" }, [h("canvas", { id: id, role: "img" })])];
    if (legend) kids.push(h("div", { cls: "chartlegend" }, legend.map(function (l) { var s = h("span", { text: l[0] }); s.classList.add("lg-" + l[1].replace("#", "")); return s; })));
    return h("div", null, kids);
  }

  // ---- page runtime ----
  function mount(cfg) {
    var lang = window.SiteLang.get();
    var T = function () { var o = {}, c = COMMON[lang], t = cfg.I18N[lang]; for (var k in c) o[k] = c[k]; for (var j in t) o[j] = t[j]; return o; };
    var inputsEl = document.getElementById("inputs"), resultsEl = document.getElementById("results");
    var refs = {}, userTouched = false, tracked = false;

    // build inputs once
    var cur = null;
    cfg.fields.forEach(function (f) {
      if (f.sec) { cur = h("div", { cls: "fields" }); inputsEl.appendChild(h("h2", { "data-k": f.sec })); inputsEl.appendChild(cur); }
      if (!cur) { cur = h("div", { cls: "fields" }); inputsEl.appendChild(cur); }
      var ctl;
      if (f.type === "sel") {
        ctl = h("select", { id: f.id }, f.opts.map(function (o) { return h("option", { value: o[0] }); }));
        ctl.value = String(f.def);
      } else if (f.type === "chk") {
        ctl = h("input", { id: f.id, type: "checkbox" }); ctl.checked = !!f.def;
      } else if (f.type === "text") {
        ctl = h("input", { id: f.id, type: "text", value: f.def });
      } else {
        ctl = h("input", { id: f.id, type: "number", step: f.step || "any", value: f.def });
      }
      var lab = h("label", { "for": f.id });
      var hint = f.hint ? h("div", { cls: "fieldhint" }) : null;
      var box = h("div", { cls: f.type === "chk" ? "full chkrow" : (f.wide ? "full" : "") }, f.type === "chk" ? [ctl, lab] : [lab, ctl, hint]);
      if (f.type === "chk" && hint) box.appendChild(hint);
      cur.appendChild(box);
      refs[f.id] = { f: f, ctl: ctl, lab: lab, hint: hint, box: box };
    });

    function read() {
      var v = {};
      cfg.fields.forEach(function (f) {
        var c = refs[f.id].ctl;
        if (f.type === "chk") v[f.id] = c.checked;
        else if (f.type === "sel" || f.type === "text") v[f.id] = c.value;
        else { var s = c.value.trim(); var n = s === "" ? NaN : Number(s); v[f.id] = f.type === "pct" ? n / 100 : n; }
      });
      return v;
    }
    function labels() {
      var t = T();
      document.title = t.title + " | Alpha Wealth Lab";
      document.querySelectorAll("[data-k]").forEach(function (e) { e.textContent = t[e.getAttribute("data-k")] || ""; });
      cfg.fields.forEach(function (f) {
        var r = refs[f.id]; r.lab.textContent = (t[f.lbl] || f.lbl) + (f.type === "pct" ? " (%)" : "");
        if (r.hint) r.hint.textContent = t[f.hint] || "";
        if (f.type === "sel") Array.prototype.forEach.call(r.ctl.options, function (o, i) { o.textContent = t[f.opts[i][1]] || f.opts[i][1]; });
      });
    }
    function paint() {
      var t = T(), v = read(), ok = true;
      cfg.fields.forEach(function (f) { if (f.show) refs[f.id].box.hidden = !f.show(v); });
      var out;
      try { out = cfg.render(v, t); } catch (e) { out = false; if (window.console) console.warn(e); }
      resultsEl.textContent = "";
      if (!out) { ok = false; resultsEl.appendChild(h("p", { cls: "err", text: t.invalid })); }
      else out.forEach(function (n) { resultsEl.appendChild(n); });
      var m = document.getElementById("method");
      m.textContent = "";
      (t.method || []).forEach(function (l) { m.appendChild(l.charAt(0) === "•" ? h("p", { cls: "note", text: l.slice(1).trim() }) : h("div", { cls: "formula", text: l })); });
      if (ok && userTouched && !tracked) { tracked = true; if (window.AWL_track) window.AWL_track("calc"); }
      if (cfg.after) cfg.after(v, t);
      return ok;
    }
    function applyLang() {
      lang = window.SiteLang.get();
      var t = T();
      document.getElementById("pageTitle").textContent = t.title;
      document.getElementById("pageSub").textContent = t.subtitle;
      document.getElementById("disc").textContent = t.disclaimer;
      document.querySelectorAll("[data-c]").forEach(function (e) { e.textContent = t[e.getAttribute("data-c")]; });
      labels(); paint();
    }
    inputsEl.addEventListener("input", function () { userTouched = true; paint(); });
    inputsEl.addEventListener("change", function () { userTouched = true; paint(); });
    window.SiteLang.subscribe(applyLang);
    var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(paint, 150); });
    applyLang();
    return { read: read, set: function (id, val) { var c = refs[id].ctl; if (c.type === "checkbox") c.checked = !!val; else c.value = val; userTouched = true; paint(); } };
  }

  window.AWL = { mount: mount, h: h, fmt: fmt, pct: pct, kpis: kpis, table: table, badge: badge, note: note, panel: panel, drawLines: drawLines, chartBox: chartBox, COMMON: COMMON };
})();
