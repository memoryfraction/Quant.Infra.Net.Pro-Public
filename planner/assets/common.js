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
      back: "Tools", home: "Home", inputs: "Inputs", results: "Results", methodTitle: "Method & formulas",
      invalid: "Please check the inputs (some values are empty or out of range).",
      disclaimer: "This tool simply turns the published methods in “Wealth Shortcut” (by 硅谷居士) and the “CLEC Handbook” into calculators, for my own use and for anyone who finds them helpful. Results are for learning only and are not investment, tax or legal advice; please make your own decisions. This site is not affiliated with or endorsed by the authors, CLEC or James."
    },
    zh: {
      back: "工具箱", home: "首页", inputs: "输入", results: "结果", methodTitle: "方法与公式",
      invalid: "请检查输入（有的值为空或超出范围）。",
      disclaimer: "本工具只是把《财富捷径》（硅谷居士）与《CLEC 宝典》中的公开方法论做成计算器，方便大家和我自己使用。计算结果仅供学习参考，不构成任何投资、税务或法律建议；请结合自身情况独立判断，盈亏自负。本站与原作者、CLEC 及 James 老师均无关联，也未获其背书。"
    }
  };

  // ---- phase-1 feature copy (share / save / compare / profile / retention / feedback) ----
  var PHASE1 = {
    en: {
      nextTitle: "Next step",
      keepTitle: "Stay in touch",
      saveFail: "Could not save (browser storage is full or blocked)",
      shareCopy: "Copy link", shareCopied: "Link copied", shareFailed: "Could not copy — select and copy the link below",
      shareNative: "Share", shareLinkLabel: "Your link (select all and copy):",
      save: "Save on this device", saved: "Saved on this device",
      saveNote: "Saved in this browser only — to move devices, copy the link.",
      loadBanner: "You saved a plan on {date}.", loadBtn: "Load", dismiss: "Dismiss",
      loadBannerOld: "It has been almost a year — compare with last year's plan?",
      loadBtnOld: "Load and compare", compareTitle: "Compared with your saved plan",
      cLabel: "Item", cOld: "Saved", cNow: "Now", cSame: "—",
      profileTitle: "Help us know you better (optional, ~3 seconds)",
      profileAge: "Age", profileAsset: "Investable assets", profileGoal: "Main goal",
      profileMarkets: "Markets you invest in", profileFollows: "Whose method do you mainly follow?",
      profileLev: "Leverage experience", profileSubmit: "Submit", profileSkip: "Skip",
      profileThanks: "Thanks — this helps us build the right tools.", profileEdit: "Edit",
      following: "Following", followingNote: "Used only for confirmation and the annual reminder; unsubscribe anytime.",
      subTitle: "Remind me every Dec 1 to rebalance", subBtn: "Subscribe",
      subOk: "Please click the confirmation link in your email.", subErr: "Something went wrong — please try again later.",
      joinTitle: "Chinese readers: join the WeChat group", joinBtn: "Join the group",
      joinNote: "Or get the annual reminder by email", joinMailBtn: "Use email instead",
      fbTitle: "Does this match your situation?", fbStars: "How useful was this?",
      fbMsg: "Your comment (3–1000 characters)", fbContact: "Contact (WeChat or email, optional)",
      fbWtp: "If these existed, which would you pay for?", fbSend: "Send", fbThanks: "Thank you!",
      optSkip: "Prefer not to say",
      goal_fi: "Financial independence", goal_retire: "Retire comfortably", goal_growth: "Grow assets", goal_preserve: "Preserve capital", goal_learn: "Just learning",
      m_us: "US", m_cn: "China", m_hk: "Hong Kong, China", m_tw: "Taiwan, China", m_other: "Other",
      f_value: "Value investing", f_beiban: "Beiban", f_adam_khoo: "Adam Khoo", f_clec: "CLEC", f_silicon_valley: "硅谷居士", f_satoshi: "Satoshi", f_other: "Other", f_none: "None in particular",
      l_none: "None", l_etf: "Leveraged ETFs", l_margin: "Margin / pledge loan", l_options: "Options",
      w_multi_plans: "Save several plans", w_pdf_report: "PDF report", w_yoy_compare: "Compare with last year", w_more_authors: "More authors' methods", w_none: "None of these",
      a_under30: "Under 30", a_30_39: "30–39", a_40_49: "40–49", a_50_59: "50–59", a_60p: "60+",
      as_lt100k: "Under 100k", as_100k: "100k–300k", as_300k: "300k–1m", as_1m: "1m–3m", as_3m: "3m+"
    },
    zh: {
      nextTitle: "下一步",
      keepTitle: "保持联系",
      saveFail: "保存失败（浏览器存储已满或被禁用）",
      shareCopy: "复制链接", shareCopied: "链接已复制", shareFailed: "复制失败，请手动选择下面的链接复制",
      shareNative: "分享", shareLinkLabel: "你的链接（全选后复制）：",
      save: "保存到本机", saved: "已保存到本机",
      saveNote: "只保存在这台设备的浏览器里，换设备请复制链接。",
      loadBanner: "你在 {date} 保存过一份方案。", loadBtn: "载入", dismiss: "忽略",
      loadBannerOld: "已经快一年了，要对比去年的方案吗？",
      loadBtnOld: "载入并对比", compareTitle: "与保存时对比",
      cLabel: "项目", cOld: "保存时", cNow: "现在", cSame: "—",
      profileTitle: "帮我们更懂你（可选，约 3 秒）",
      profileAge: "年龄段", profileAsset: "资产区间", profileGoal: "主要目标",
      profileMarkets: "投资的市场", profileFollows: "你主要参考谁的方法",
      profileLev: "杠杆经验", profileSubmit: "提交", profileSkip: "跳过",
      profileThanks: "谢谢——这能帮我们做对工具。", profileEdit: "修改",
      following: "订阅", followingNote: "只用于确认和年度提醒，随时可退订。",
      subTitle: "每年 12 月 1 日提醒我做年度再平衡", subBtn: "订阅",
      subOk: "请到邮箱点击确认链接。", subErr: "出错了，请稍后再试。",
      joinTitle: "中文读者：进微信群一起讨论", joinBtn: "进微信群",
      joinNote: "也可以用邮箱接收年度提醒", joinMailBtn: "改用邮箱",
      fbTitle: "这个结果和你的情况符合吗？", fbStars: "这个结果对你有多大用？",
      fbMsg: "你的留言（3–1000 字）", fbContact: "联系方式（微信号或邮箱，可选）",
      fbWtp: "如果以后有这些功能，你愿意为哪个付费？", fbSend: "发送", fbThanks: "谢谢！",
      optSkip: "不便回答",
      goal_fi: "财务自由", goal_retire: "安心退休", goal_growth: "资产增值", goal_preserve: "保住本金", goal_learn: "只是想学习",
      m_us: "美国", m_cn: "中国内地", m_hk: "中国香港", m_tw: "中国台湾", m_other: "其他",
      f_value: "价值投资", f_beiban: "贝版", f_adam_khoo: "Adam Khoo", f_clec: "CLEC", f_silicon_valley: "硅谷居士", f_satoshi: "中本聪", f_other: "其他", f_none: "都不是",
      l_none: "无", l_etf: "杠杆 ETF", l_margin: "融资 / 质押借款", l_options: "期权",
      w_multi_plans: "保存多套方案", w_pdf_report: "PDF 报告", w_yoy_compare: "自动对比去年的方案", w_more_authors: "更多作者的方法论", w_none: "都不需要",
      a_under30: "30 岁以下", a_30_39: "30–39", a_40_49: "40–49", a_50_59: "50–59", a_60p: "60 岁以上",
      as_lt100k: "10 万以下", as_100k: "10–30 万", as_300k: "30–100 万", as_1m: "100–300 万", as_3m: "300 万以上"
    }
  };
  // Merge phase-1 copy into the shared dictionary (tool dictionaries still win).
  for (var _l in PHASE1) { for (var _k in PHASE1[_l]) if (!(_k in COMMON[_l])) COMMON[_l][_k] = PHASE1[_l][_k]; }

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

  // ---- phase-1 site runtime (share / save+load+compare / calc reporting /
  //      profile card / retention entry / feedback / next step) -------------
  //
  // Everything here is additive: no engine formula is touched, and every
  // network call is gated on the production hostname + a non-empty vid so a
  // GPC visitor or a local preview never reports anything.
  var L = (typeof window !== "undefined" && window.AWLLib) || null;

  var PROD_HOST = "www.alpha-wealth-lab.com";
  var CALC_MAX_PER_LOAD = 5, CALC_IDLE_MS = 3000, CALC_TEXT_MAX = 60;

  function slugOf() {
    var m = /^\/planner\/([a-z-]+)\//.exec(window.location.pathname || "");
    return m ? m[1] : "";
  }
  function mayReport() {
    return window.location.hostname === PROD_HOST;
  }

  // Access to storage that never throws (Safari private mode, blocked cookies,
  // quota exceeded). Returns null when unusable.
  function safeStore(kind) {
    try {
      var s = kind === "session" ? window.sessionStorage : window.localStorage;
      var probe = "__awl_probe__";
      s.setItem(probe, "1"); s.removeItem(probe);
      return s;
    } catch (e) { return null; }
  }

  // Minimal toast. role="status" so screen readers announce it.
  function toast(text) {
    var el = document.getElementById("awlToast");
    if (!el) {
      el = h("div", { id: "awlToast", cls: "awl-toast", role: "status", "aria-live": "polite" });
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add("on");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("on"); }, 2600);
  }

  function copyText(text, done, fail) {
    var nav = window.navigator;
    if (nav.clipboard && nav.clipboard.writeText) {
      nav.clipboard.writeText(text).then(done, function () { legacyCopy(text) ? done() : fail(); });
      return;
    }
    legacyCopy(text) ? done() : fail();
  }
  function legacyCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.top = "-1000px";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand && document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) { return false; }
  }

  // Beacon with a fetch(keepalive) fallback. Never throws.
  function send(url, payload) {
    var body = JSON.stringify(payload);
    try {
      if (window.navigator.sendBeacon) {
        var blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
        if (window.navigator.sendBeacon(url, blob)) return;
      }
    } catch (e) { /* fall through */ }
    try {
      window.fetch(url, { method: "POST", body: body, keepalive: true, headers: { "content-type": "text/plain;charset=UTF-8" } }).catch(function () {});
    } catch (e) { /* silent */ }
  }

  function track(event) {
    if (typeof window.AWL_track === "function") window.AWL_track(event);
  }

  // ---- result-area UI blocks ---------------------------------------------

  // (a) share + (b) save, rendered once under the results.
  function shareBlock(slug, v, t, cfg, state) {
    var wrap = h("div", { cls: "awl-actions" });

    var btnCopy = h("button", { type: "button", cls: "awl-btn primary", text: t.shareCopy });
    var linkBox = h("input", { type: "text", readonly: "", cls: "awl-linkbox", "aria-label": t.shareLinkLabel });
    linkBox.hidden = true;
    btnCopy.addEventListener("click", function () {
      var s = state.buildState(v, cfg);
      var url = state.shareUrl(s);
      copyText(url, function () {
        toast(t.shareCopied);
        linkBox.hidden = true;
        track("share");
      }, function () {
        linkBox.value = url;
        linkBox.hidden = false;
        linkBox.focus(); linkBox.select();
        toast(t.shareFailed);
        track("share");
      });
    });
    wrap.appendChild(btnCopy);

    if (window.navigator.share) {
      var btnShare = h("button", { type: "button", cls: "awl-btn", text: t.shareNative });
      btnShare.addEventListener("click", function () {
        var s = state.buildState(v, cfg);
        var url = state.shareUrl(s);
        try {
          window.navigator.share({ title: t.title, url: url }).then(function () { track("share"); }, function () {});
        } catch (e) { /* silent */ }
      });
      wrap.appendChild(btnShare);
    }

    var btnSave = h("button", { type: "button", cls: "awl-btn", text: t.save });
    var canSave = !!state.store;
    btnSave.hidden = !canSave;
    btnSave.addEventListener("click", function () {
      var rows = typeof cfg.summary === "function" ? cfg.summary(v, t) : [];
      var s = state.buildState(v, cfg);
      var ok = state.plans.put(slug, { s: s, ts: Date.now(), lang: state.lang(), rows: rows });
      toast(ok ? t.saved : t.saveFail);
      if (ok) track("save");
      if (ok) state.markSavedHint();
    });
    wrap.appendChild(btnSave);

    wrap.appendChild(linkBox);
    wrap.appendChild(h("p", { cls: "awl-hint", text: t.saveNote }));
    return wrap;
  }

  // (b) load banner + compare table
  function bannerBlock(slug, plan, t, state) {
    var old = L && L.olderThan(plan.ts, 330);
    var when = L ? L.fmtDate(plan.ts, state.lang()) : "";
    var box = h("div", { cls: "awl-banner" });
    box.appendChild(h("p", { text: (old ? t.loadBannerOld : t.loadBanner.replace("{date}", when)) }));
    var btn = h("button", { type: "button", cls: "awl-btn primary", text: old ? t.loadBtnOld : t.loadBtn });
    var dis = h("button", { type: "button", cls: "awl-btn ghost", text: t.dismiss });
    var row = h("div", { cls: "awl-actions" }, [btn, dis]);
    box.appendChild(row);

    dis.addEventListener("click", function () {
      box.hidden = true;
      // "Dismiss" is per page load only — the banner reappears next visit.
    });

    btn.addEventListener("click", function () {
      state.applyState(plan.s);
      box.hidden = true;
      track("load");
      var rows = typeof state.cfgRef.cfg.summary === "function" ? state.cfgRef.cfg.summary(state.lastV(), state.dict()) : [];
      var cmp = L ? L.comparePlan(plan.rows || [], rows) : [];
      if (cmp.length) box.parentNode.insertBefore(compareTable(cmp, t), box.nextSibling);
    });
    return box;
  }

  function compareTable(cmp, t) {
    var rows = cmp.map(function (c) {
      return h("tr", { cls: c.same ? "" : "hl" }, [
        h("td", { text: c.label }),
        h("td", { text: c.old || t.cSame }),
        h("td", { text: c.now || t.cSame })
      ]);
    });
    return h("section", { cls: "panel awl-cmp" }, [
      h("h2", { text: t.compareTitle }),
      h("div", { cls: "tablewrap" }, [h("table", null, [
        h("thead", null, [h("tr", null, [h("th", { text: t.cLabel }), h("th", { text: t.cOld }), h("th", { text: t.cNow })])]),
        h("tbody", null, rows)
      ])])
    ]);
  }

  // (d) profile card — shown once, after the first successful calc.
  // Option values double as the dictionary key suffix and as the lookup into
  // the server whitelist maps below.
  var AGE_OPTS = ["under30", "30_39", "40_49", "50_59", "60p"];
  var ASSET_OPTS = ["lt100k", "100k", "300k", "1m", "3m"];
  var GOAL_OPTS = ["fi", "retire", "growth", "preserve", "learn"];
  var MKT_OPTS = ["us", "cn", "hk", "tw", "other"];
  var FOL_OPTS = ["value", "beiban", "adam_khoo", "clec", "silicon_valley", "satoshi", "other", "none"];
  var LEV_OPTS = ["none", "etf", "margin", "options"];

  // The dictionary uses short prefixes that differ from the group name.
  var GROUP_KEY = { age: "a", asset: "as", goal: "goal", mkt: "m", fol: "f", lev: "l" };

  // UI option value -> server whitelist value (spec 3.3).
  var AGE_VALUE = { under30: "<30", "30_39": "30-39", "40_49": "40-49", "50_59": "50-59", "60p": "60+" };
  var ASSET_VALUE = { lt100k: "<100k", "100k": "100k-300k", "300k": "300k-1m", "1m": "1m-3m", "3m": "3m+" };

  // Each chip is `<span class="awl-chip"><input …><label …>Label</label></span>`.
  function pickGroup(labelKey, values, prefix, multi, t) {
    var box = h("div", { cls: "awl-pick" }, [h("div", { cls: "awl-picklbl", text: t[labelKey] })]);
    var row = h("div", { cls: "awl-chips" });
    var dictPfx = GROUP_KEY[prefix] || prefix;
    values.forEach(function (val) {
      var id = "awl_" + prefix + "_" + val;
      var input = h("input", { id: id, type: multi ? "checkbox" : "radio", name: "awl_" + prefix, value: val });
      var lab = h("label", { "for": id, text: t[dictPfx + "_" + val] || val });
      row.appendChild(h("span", { cls: "awl-chip" }, [input, lab]));
    });
    box.appendChild(row);
    return box;
  }

  function readGroup(box) {
    var out = [];
    box.querySelectorAll("input").forEach(function (i) { if (i.checked) out.push(i.value); });
    return out;
  }

  // (f) feedback box
  function feedbackBlock(slug, t, state) {
    var det = h("details", { cls: "awl-fb" });
    det.appendChild(h("summary", { text: t.fbTitle }));
    var body = h("div", { cls: "awl-fbbody" });

    body.appendChild(h("div", { cls: "awl-picklbl", text: t.fbStars }));
    var stars = h("div", { cls: "awl-chips" });
    for (var i = 1; i <= 5; i++) {
      var id = "awlStar" + i;
      var ri = h("input", { id: id, type: "radio", name: "awlRating", value: String(i) });
      stars.appendChild(h("span", { cls: "awl-chip" }, [ri, h("label", { "for": id, text: String(i) })]));
    }
    body.appendChild(stars);

    body.appendChild(h("div", { cls: "awl-picklbl", text: t.fbMsg }));
    var ta = h("textarea", { cls: "awl-ta", maxlength: "1000", rows: "4", "aria-label": t.fbMsg });
    body.appendChild(ta);

    var contact = h("input", { type: "text", cls: "awl-in", maxlength: "120", placeholder: t.fbContact, "aria-label": t.fbContact });
    body.appendChild(contact);

    var wtpBox = h("div", { cls: "awl-pick" }, [h("div", { cls: "awl-picklbl", text: t.fbWtp })]);
    var wtpRow = h("div", { cls: "awl-chips" });
    ["multi_plans", "pdf_report", "yoy_compare", "more_authors", "none"].forEach(function (w) {
      var id = "awlWtp_" + w;
      wtpRow.appendChild(h("span", { cls: "awl-chip" }, [
        h("input", { id: id, type: "checkbox", name: "awlWtp", value: w }),
        h("label", { "for": id, text: t["w_" + w] })
      ]));
    });
    wtpBox.appendChild(wtpRow);
    body.appendChild(wtpBox);

    // Honeypot: visually off-screen, NOT type=hidden (bots skip hidden fields).
    var honey = h("input", { type: "text", name: "website", tabindex: "-1", autocomplete: "off", "aria-hidden": "true", cls: "awl-hp" });
    body.appendChild(honey);

    var btn = h("button", { type: "button", cls: "awl-btn primary", text: t.fbSend });
    var out = h("p", { cls: "awl-hint" });
    body.appendChild(h("div", { cls: "awl-actions" }, [btn]));
    body.appendChild(out);
    det.appendChild(body);

    var opened = 0;
    det.addEventListener("toggle", function () { if (det.open && !opened) opened = Date.now(); });

    // "none" clears every other wtp choice.
    wtpRow.addEventListener("change", function (e) {
      var tgt = e.target;
      if (tgt.value === "none" && tgt.checked) {
        wtpRow.querySelectorAll("input").forEach(function (i) { if (i !== tgt) i.checked = false; });
      } else if (tgt.checked) {
        wtpRow.querySelectorAll('input[value="none"]').forEach(function (i) { i.checked = false; });
      }
    });

    btn.addEventListener("click", function () {
      var msg = (ta.value || "").trim();
      if (msg.length < 3) { out.textContent = t.fbMsg; return; }
      if (honey.value) { out.textContent = t.fbThanks; det.open = false; return; }  // silent
      var rating = 0;
      stars.querySelectorAll("input").forEach(function (i) { if (i.checked) rating = Number(i.value); });
      var wtp = readGroup(wtpRow).join(",");
      btn.disabled = true;
      out.textContent = "";
      var payload = {
        tool: slug, lang: state.lang(), vid: state.vid(), rating: rating,
        message: msg, contact: (contact.value || "").trim(), wtp: wtp,
        website: "", t: Date.now() - (opened || Date.now())
      };
      postJSON("/api/feedback", payload, function (ok) {
        btn.disabled = false;
        if (ok) { out.textContent = t.fbThanks; ta.value = ""; contact.value = ""; }
        else out.textContent = t.subErr;
      });
    });
    return det;
  }

  function postJSON(url, payload, cb) {
    try {
      window.fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r) { cb(r.ok || r.status === 204); }, function () { cb(false); });
    } catch (e) { cb(false); }
  }

  // (e) retention entry — Chinese leads with /join/, English with email.
  function retentionBlock(slug, t, state) {
    var isZh = state.lang() === "zh";
    var wrap = h("section", { cls: "panel awl-keep" });
    wrap.appendChild(h("h2", { text: t.keepTitle }));

    if (isZh) {
      var a = h("a", { cls: "awl-btn primary", href: "/join/" });
      a.textContent = t.joinBtn;
      a.addEventListener("click", function () { track("join"); });
      wrap.appendChild(h("div", { cls: "awl-actions" }, [a]));
      wrap.appendChild(h("p", { cls: "awl-hint", text: t.joinNote }));
    }

    var mailWrap = h("div", { cls: isZh ? "awl-secondary" : "" });
    if (isZh) {
      var tog = h("button", { type: "button", cls: "awl-link" , text: t.joinMailBtn });
      tog.addEventListener("click", function () { mailWrap.hidden = !mailWrap.hidden; });
      wrap.appendChild(tog);
      mailWrap.hidden = true;
    }
    mailWrap.appendChild(subForm(slug, t, state, isZh));
    wrap.appendChild(mailWrap);
    return wrap;
  }

  function subForm(slug, t, state, zh) {
    var form = h("form", { cls: "awl-sub", novalidate: "" });
    form.appendChild(h("div", { cls: "awl-picklbl", text: t.subTitle }));
    var email = h("input", { type: "email", name: "email", required: "", maxlength: "120", autocomplete: "email", cls: "awl-in", placeholder: "you@example.com", "aria-label": "Email" });
    var honey = h("input", { type: "text", name: "website", tabindex: "-1", autocomplete: "off", "aria-hidden": "true", cls: "awl-hp" });
    var btn = h("button", { type: "submit", cls: "awl-btn primary", text: t.subBtn });
    var out = h("p", { cls: "awl-hint" });
    form.appendChild(email);
    form.appendChild(honey);
    form.appendChild(h("div", { cls: "awl-actions" }, [btn]));
    form.appendChild(out);

    var priv = h("a", { href: "/privacy/", text: zh ? "隐私说明" : "Privacy" });
    form.appendChild(h("p", { cls: "awl-hint" }, [h("span", { text: t.followingNote + " " }), priv]));

    var focusT = 0;
    email.addEventListener("focus", function () { if (!focusT) focusT = Date.now(); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var value = (email.value || "").trim();
      if (honey.value) { out.textContent = t.subOk; form.reset(); return; }  // silent
      if (!value) { out.textContent = t.subErr; return; }
      btn.disabled = true; out.textContent = "";
      postJSON("/api/subscribe", {
        email: value, vid: state.vid(), lang: state.lang(), source: slug,
        website: "", t: Date.now() - (focusT || Date.now())
      }, function (ok) {
        btn.disabled = false;
        out.textContent = ok ? t.subOk : t.subErr;
        if (ok) form.reset();
      });
    });
    return form;
  }

  // (g) next step
  function nextBlock(cfg, t) {
    if (!cfg.next || !cfg.next.length) return null;
    var wrap = h("section", { cls: "panel awl-next" }, [h("h2", { text: t.nextTitle })]);
    var row = h("div", { cls: "awl-actions" });
    cfg.next.forEach(function (n) {
      row.appendChild(h("a", { cls: "awl-btn", href: n.href, text: t[n.key] || n.key }));
    });
    wrap.appendChild(row);
    return wrap;
  }

  // ---- calc reporting (c) -------------------------------------------------
  function makeReporter(slug, cfg, state) {
    var sent = 0, timer = null, firstDone = false;

    function rawInputs() {
      var out = {};
      var n = 0;
      cfg.fields.forEach(function (f) {
        if (n >= 40) return;
        var ctl = document.getElementById(f.id);
        if (!ctl) return;
        if (f.type === "chk") out[f.id] = !!ctl.checked;
        else if (f.type === "num" || f.type === "pct") {
          var num = Number(String(ctl.value).trim());
          if (isFinite(num)) out[f.id] = num;
        } else if (f.type === "sel") out[f.id] = String(ctl.value);
        else {
          var s = String(ctl.value == null ? "" : ctl.value);
          if (s.length && s.length <= CALC_TEXT_MAX) out[f.id] = s;
        }
        n++;
      });
      return out;
    }

    function fire(v, t) {
      if (sent >= CALC_MAX_PER_LOAD) return;
      if (!mayReport() || !state.vid()) return;
      var rows = typeof cfg.summary === "function" ? cfg.summary(v, t) : [];
      if (!rows.length) return;
      sent++;
      send("/api/calc", {
        tool: slug, lang: state.lang(), vid: state.vid(), sid: state.sid(),
        inputs: rawInputs(), result: rows
      });
    }

    return {
      // Called on every successful paint.
      onPaint: function (v, t) {
        if (!firstDone) { firstDone = true; fire(v, t); }
        clearTimeout(timer);
        timer = setTimeout(function () { fire(v, t); }, CALC_IDLE_MS);
      }
    };
  }

  // ---- save (c) share-state helper ---------------------------------------
  function buildState(v, cfg) {
    return L ? L.encodeState(v, cfg.fields) : "";
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

    // ---- phase-1 state ---------------------------------------------------
    var slug = slugOf();
    var localStore = safeStore("local"), sessStore = safeStore("session");
    var state = {
      store: localStore,
      plans: localStore && L ? L.planStore(localStore) : { get: function () { return null; }, put: function () { return false; }, remove: function () {} },
      lang: function () { return lang; },
      vid: function () { return L ? L.getVid(localStore) : ""; },
      sid: function () { return L ? L.getSid(sessStore) : ""; },
      buildState: buildState,
      shareUrl: function (s) {
        var base = window.location.origin + window.location.pathname;
        return s ? base + "?s=" + s + "&from=share" : base + "?from=share";
      },
      applyState: function (s) { applyState(s); },
      lastV: function () { return lastV; },
      dict: function () { return T(); },
      markSavedHint: function () { if (bannerEl) bannerEl.hidden = true; },
      cfgRef: { cfg: cfg }
    };
    var lastV = null;
    var reporter = makeReporter(slug, cfg, state);
    var keepEl = null, zhCache = null, profileShown = false;
    var bannerEl = null;

    function isZhNow() { return lang === "zh"; }
    function refreshKeep(t) { keepEl = retentionBlock(slug, t, state); zhCache = isZhNow(); }

    // Restore inputs from ?s=<base64url>
    function applyState(s) {
      var vals = L ? L.decodeState(s, cfg.fields) : {};
      var any = false;
      for (var k in vals) {
        if (!refs[k]) continue;
        var f = refs[k].f, c = refs[k].ctl, val = vals[k];
        if (f.type === "chk") c.checked = !!val;
        else if (f.type === "pct") c.value = String(Math.round(val * 1e6) / 1e4);
        else c.value = String(val);
        any = true;
      }
      return any;
    }

    // (d) profile card — first successful calc only, once per device.
    function maybeProfile(t) {
      if (profileShown || !localStore || !L || !state.vid()) return;
      var done = null;
      try { done = localStore.getItem("awl_profile_done"); } catch (e) { done = null; }
      if (done) return;
      profileShown = true;
      resultsEl.appendChild(profileCard(t));
    }

    function profileCard(t) {
      var det = h("details", { cls: "awl-prof" });
      det.appendChild(h("summary", { text: t.profileTitle }));
      var body = h("div", { cls: "awl-fbbody" });
      var groups = [
        pickGroup("profileAge", AGE_OPTS, "age", false, t),
        pickGroup("profileAsset", ASSET_OPTS, "asset", false, t),
        pickGroup("profileGoal", GOAL_OPTS, "goal", false, t),
        pickGroup("profileMarkets", MKT_OPTS, "mkt", true, t),
        pickGroup("profileFollows", FOL_OPTS, "fol", true, t),
        pickGroup("profileLev", LEV_OPTS, "lev", false, t)
      ];
      groups.forEach(function (g) { body.appendChild(g); });
      var out = h("p", { cls: "awl-hint" });
      var send2 = h("button", { type: "button", cls: "awl-btn primary", text: t.profileSubmit });
      var skip = h("button", { type: "button", cls: "awl-btn ghost", text: t.profileSkip });
      body.appendChild(h("div", { cls: "awl-actions" }, [send2, skip]));
      body.appendChild(out);
      det.appendChild(body);

      skip.addEventListener("click", function () { det.open = false; });
      send2.addEventListener("click", function () {
        var age = readGroup(groups[0])[0], asset = readGroup(groups[1])[0], goal = readGroup(groups[2])[0];
        var mkts = readGroup(groups[3]), fols = readGroup(groups[4]), lev = readGroup(groups[5])[0];
        var payload = { vid: state.vid(), lang: lang };
        if (age && AGE_VALUE[age]) payload.age_band = AGE_VALUE[age];
        if (asset && ASSET_VALUE[asset]) payload.asset_band = ASSET_VALUE[asset];
        if (goal && GOAL_OPTS.indexOf(goal) >= 0) payload.goal = goal;
        if (mkts.length) payload.markets = mkts.join(",");
        if (fols.length) payload.follows = fols.join(",");
        if (lev && LEV_OPTS.indexOf(lev) >= 0) payload.leverage_exp = lev;
        send2.disabled = true;
        postJSON("/api/profile", payload, function (ok) {
          send2.disabled = false;
          if (ok) {
            try { localStore.setItem("awl_profile_done", String(Date.now())); } catch (e) { /* ignore */ }
            out.textContent = t.profileThanks;
            det.open = false;
          } else out.textContent = t.subErr;
        });
      });
      return det;
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

      // phase-1 blocks under the results (rebuilt on every paint, cheap)
      lastV = v;
      if (ok) {
        resultsEl.appendChild(shareBlock(slug, v, t, cfg, state));
        resultsEl.appendChild(feedbackBlock(slug, t, state));
        var nx = nextBlock(cfg, t);
        if (nx) resultsEl.appendChild(nx);
        resultsEl.appendChild(keepEl);
        maybeProfile(t);
      }
      reporter.onPaint(v, t);
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
      renderSource();
      labels();
      if (!keepEl || zhCache !== isZhNow()) refreshKeep(t);
      paint();
    }

    // "方法论参考：xxx" under the Method & formulas panel (spec 4.4).
    function renderSource() {
      var box = document.getElementById("srcRef");
      if (!box) return;
      var reg = window.AWL_TOOLS || [];
      var me = null;
      for (var i = 0; i < reg.length; i++) if (reg[i].slug === slug) { me = reg[i]; break; }
      box.textContent = "";
      if (!me || !me.source || !me.source.name) { box.hidden = true; return; }
      var copy = (window.AWL_REGISTRY_COPY || {})[lang] || { sourcePrefix: "Method source: " };
      box.hidden = false;
      box.appendChild(h("span", { text: copy.sourcePrefix }));
      if (me.source.url) box.appendChild(h("a", { href: me.source.url, text: me.source.name }));
      else box.appendChild(h("span", { text: me.source.name }));
    }
    inputsEl.addEventListener("input", function () { userTouched = true; paint(); });
    inputsEl.addEventListener("change", function () { userTouched = true; paint(); });
    window.SiteLang.subscribe(applyLang);
    var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(paint, 150); });

    // Shared link (?s=) wins over any saved plan, per spec 4.1(a)/(b).
    var saved = state.plans.get(slug);
    var preset = (function () {
      var m = /[?&]s=([^&]+)/.exec(window.location.search || "");
      return m ? decodeURIComponent(m[1]) : "";
    })();
    if (preset) {
      applyState(preset);
    } else if (saved) {
      bannerEl = bannerBlock(slug, saved, T(), state);
      var host = inputsEl.parentNode;
      if (host) host.insertBefore(bannerEl, inputsEl);
      else inputsEl.insertBefore(bannerEl, inputsEl.firstChild);
    }
    applyLang();
    // Expose the live config so tests and the phase-1 runtime can reuse the same
    // defaults / summary() the page itself uses. Never used for rendering.
    mount.last = cfg;
    return { read: read, set: function (id, val) { var c = refs[id].ctl; if (c.type === "checkbox") c.checked = !!val; else c.value = val; userTouched = true; paint(); } };
  }

  window.AWL = { mount: mount, h: h, fmt: fmt, pct: pct, kpis: kpis, table: table, badge: badge, note: note, panel: panel, drawLines: drawLines, chartBox: chartBox, COMMON: COMMON };
})();
