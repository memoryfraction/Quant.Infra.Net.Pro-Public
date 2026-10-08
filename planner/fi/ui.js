(function () {
  var A = window.AWL, E = window.FIEngine, h = A.h, fmt = A.fmt, pct = A.pct;
  var I18N = {
    en: {
      title: "Financial Independence Calculator",
      subtitle: "How much you need, how much to invest each year, and how many years to go at your savings rate.",
      secA: "How much do I need?", secB: "How many more years of work?",
      mode: "When do you want to be free?", modeNow: "Right now", modeRetire: "At retirement",
      expenseNow: "Yearly spending today", rentNow: "Yearly rent / passive income today", other: "Pension / social security at retirement (that year's money)",
      years: "Years until retirement", inflation: "Inflation", replace: "Retirement spending as % of pre-retirement", swr: "Sustainable withdrawal rate",
      current: "Financial assets today", r: "Expected yearly investment return",
      s: "Savings rate", g: "Real return after inflation", w: "Withdrawal rate", a0: "Current assets (multiple of yearly income)",
      kF: "Target financial assets", kGrown: "Your assets grow to", kGap: "Gap to fill", kEnough: "Already enough", kY: "Invest each year", kInf: "Inflation factor", kDiff: "Difference vs. today's assets",
      kYears: "Years to work", over100: "> 100 years", safe: "Rule of thumb: return − inflation", multTitle: "Accumulation multiple P (invest 1 per year)", yrs: "Years", cols: "Savings rate vs. years",
      tYears: "Years", tSave: "Savings rate", tYr: "Years to FI",
      method: [
        "inflation factor = (1 + inflation) ^ years",
        "target F = ( spending × factor × ratio − rent × factor − pension ) / withdrawal rate",
        "gap D = F − assets × (1 + r) ^ years",
        "multiple P = ((1 + r) ^ (N + 1) − 1) / r      yearly investment Y = D / P",
        "years to FI = ln((T + s/g) / (a0 + s/g)) / ln(1 + g),  T = (1 − s) / w",
        "• Inflation makes future spending larger, so today's spending is first converted to the retirement year.",
        "• The 4% rule is a common assumption; a rough check is long-run return minus inflation (shown below the results).",
        "• P counts N + 1 yearly contributions at the start of each year."
      ]
    },
    zh: {
      title: "财务自由计算器",
      subtitle: "需要多少资产、每年要投多少、按现在的储蓄率还要工作几年。",
      secA: "我需要多少资产？", secB: "还要工作几年？",
      mode: "想在什么时候财务自由？", modeNow: "现在", modeRetire: "退休时",
      expenseNow: "今天的年开销", rentNow: "今天的年房租等被动收入", other: "退休时的养老金/社保（届时金额）",
      years: "距离退休年数", inflation: "通胀率", replace: "退休开销占退休前的比例", swr: "可持续提取率",
      current: "现有金融资产", r: "预期投资年化收益率",
      s: "储蓄率", g: "扣除通胀后的实际收益率", w: "提取率", a0: "现有资产（年收入的几倍）",
      kF: "目标金融资产", kGrown: "现有资产增长到", kGap: "还差", kEnough: "已经足够", kY: "每年需投入", kInf: "通胀因子", kDiff: "与现有资产的差额",
      kYears: "需要工作的年数", over100: "超过 100 年", safe: "经验法则：收益率 − 通胀率", multTitle: "累积投资倍数 P（每年投入 1）", yrs: "年数", cols: "储蓄率与所需年数",
      tYears: "年数", tSave: "储蓄率", tYr: "所需年数",
      method: [
        "通胀因子 = (1 + 通胀率) ^ 年数",
        "目标资产 F = (开销 × 通胀因子 × 比例 − 房租 × 通胀因子 − 养老金) / 提取率",
        "缺口 D = F − 现有资产 × (1 + r) ^ 年数",
        "累积倍数 P = ((1 + r) ^ (N + 1) − 1) / r      每年投入 Y = D / P",
        "所需年数 = ln((T + s/g) / (a0 + s/g)) / ln(1 + g)，T = (1 − s) / w",
        "• 通胀会让未来开销变大，所以先把今天的开销换算到退休那一年。",
        "• 4% 只是常用假设，粗略核对可用“长期收益率 − 通胀率”（显示在结果下方）。",
        "• P 按每年年初投入、共 N + 1 笔计算。"
      ]
    }
  };
  var fields = [
    { sec: "secA", id: "mode", type: "sel", def: "retire", lbl: "mode", opts: [["now", "modeNow"], ["retire", "modeRetire"]], wide: true },
    { id: "expenseNow", type: "num", def: 100000, lbl: "expenseNow" },
    { id: "rentNow", type: "num", def: 30000, lbl: "rentNow" },
    { id: "otherF", type: "num", def: 40000, lbl: "other", show: function (v) { return v.mode === "retire"; } },
    { id: "years", type: "num", def: 25, lbl: "years", show: function (v) { return v.mode === "retire"; } },
    { id: "inflation", type: "pct", def: 4, lbl: "inflation" },
    { id: "replace", type: "pct", def: 80, lbl: "replace", show: function (v) { return v.mode === "retire"; } },
    { id: "swr", type: "pct", def: 4, lbl: "swr" },
    { id: "current", type: "num", def: 100000, lbl: "current" },
    { id: "r", type: "pct", def: 10, lbl: "r" },
    { sec: "secB", id: "s", type: "pct", def: 50, lbl: "s" },
    { id: "g", type: "pct", def: 5, lbl: "g" },
    { id: "w", type: "pct", def: 4, lbl: "w" },
    { id: "a0", type: "num", def: 0, lbl: "a0" }
  ];

  function render(v, t) {
    var now = v.mode === "now";
    var years = now ? 0 : v.years, rep = now ? 1 : v.replace, other = now ? 0 : v.otherF;
    var ta = E.targetAssets({ expenseNow: v.expenseNow, inflation: v.inflation, years: years, replaceRatio: rep, rentNow: v.rentNow, otherPassiveFuture: other, swr: v.swr });
    if (!ta.ok || !isFinite(v.current) || !isFinite(v.r) || v.current < 0) return false;
    var gp = E.gap({ F: ta.F, current: v.current, r: v.r, years: years });
    var Y = now ? null : E.yearlyNeeded({ D: gp.D, r: v.r, years: years });
    var k = [[t.kF, fmt(ta.F)]];
    if (!now) k.push([t.kGrown, fmt(gp.grown)]);
    k.push(gp.D <= 0 ? [t.kEnough, "✓", "good"] : [now ? t.kDiff : t.kGap, fmt(gp.D), "warn"]);
    if (!now) k.push([t.kY, fmt(Y)]);
    k.push([t.kInf, fmt(ta.inf, 2)]);
    var A1 = [A.kpis(k), A.note(t.safe + " = " + pct(E.bookSafeRate(v.r, v.inflation), 1) + "  (vs. " + pct(v.swr, 1) + ")")];
    if (!now) {
      var rows = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map(function (n) { return [String(n), fmt(E.accumMultiple(v.r, n), 1), fmt(E.accumMultiple(0.10, n), 1), fmt(E.accumMultiple(0.15, n), 1)]; });
      A1.push(h("h2", { text: t.multTitle }));
      A1.push(A.table([t.yrs, "r = " + pct(v.r, 1), "10%", "15%"], rows));
    }
    var out = [A.panel(t.secA, A1)];

    var y = E.yearsToFI({ s: v.s, g: v.g, w: v.w, a0: v.a0 });
    if (!y.ok) { out.push(A.panel(t.secB, [h("p", { cls: "err", text: t.invalid })])); return out; }
    var rowsB = [], hl = -1;
    for (var s = 5; s <= 80; s += 5) {
      var yy = E.yearsToFI({ s: s / 100, g: v.g, w: v.w, a0: v.a0 });
      if (Math.abs(v.s * 100 - s) < 0.5) hl = rowsB.length;
      rowsB.push([s + "%", yy.ok ? (yy.years === null ? t.over100 : fmt(yy.years, 1)) : "—"]);
    }
    out.push(A.panel(t.secB, [A.kpis([[t.kYears, y.years === null ? t.over100 : fmt(y.years, 1)]]), A.table([t.tSave, t.tYr], rowsB, { hl: hl })]));
    return out;
  }
  A.mount({ I18N: I18N, fields: fields, render: render });
})();
