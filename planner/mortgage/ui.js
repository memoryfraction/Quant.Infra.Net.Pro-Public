(function () {
  var A = window.AWL, E = window.MortEngine, h = A.h, fmt = A.fmt, pct = A.pct;
  var I18N = {
    en: {
      title: "Prepay the Mortgage or Invest?",
      subtitle: "See your real mortgage rate, compare both paths over decades, and the leveraged return on a down payment.",
      s1: "1 · Real mortgage rate", s2: "2 · Extra money each year", s3: "3 · A lump sum", s4: "4 · Leveraged home return",
      i: "Mortgage rate", t: "Marginal tax rate on interest relief", tHint: "Use 0 if you get no deduction.", pi: "Inflation", r: "Investment return (yearly)",
      X: "Extra money each year", Y: "Years", P: "Lump sum", cg: "Capital-gains tax on the gain",
      R: "Whole-home yearly return (rent + growth − costs)", D: "Loan rate", dp: "Down payment",
      kAfter: "After-tax mortgage rate", kReal: "Real rate (after inflation)", helps: "Inflation is paying down your loan",
      kInvest: "Invest the money", kPrepay: "Prepay the loan", kDiff: "Invest is ahead by", kSpread: "Rough spread-only estimate",
      kB: "Portfolio after the period", kAdv: "Advantage vs. paying off at the start", kTax: "Tax on the gain", kBook: "Rough estimate",
      kN: "Leverage N (loan ÷ down payment)", kRoi: "Return on the down payment", kLev: "From leverage", drag: "Leverage is dragging your return",
      tDown: "Down payment", sens: "Return on down payment (loan rate from above)",
      method: [
        "after-tax rate = i × (1 − t);   real rate = i × (1 − t) − inflation",
        "money put in at the start of each year: FV = X × ((1 + r)^Y − 1) / r × (1 + r)",
        "prepaying earns the after-tax mortgage rate with certainty; investing earns r with risk",
        "lump sum kept invested while paying only interest: B = P(1 + r)^Y − P·i'·((1 + r)^Y − 1)/r",
        "ROI = R + (R − D) × N,   N = loan / down payment",
        "• Prepaying is a risk-free but illiquid “investment”. Investing is not guaranteed: in bear markets it can fall below the mortgage rate, and you must be able to cover the payments.",
        "• Adjustable rates, refinancing costs and taxes beyond those entered are not modelled."
      ]
    },
    zh: {
      title: "房贷：提前还还是去投资",
      subtitle: "看清房贷的真实利率，比较两条路径几十年后的差别，以及杠杆买房的首付收益率。",
      s1: "1 · 房贷的真实利率", s2: "2 · 每年多出来的钱", s3: "3 · 手上一笔钱", s4: "4 · 杠杆买房收益",
      i: "房贷利率", t: "利息抵税的边际税率", tHint: "没有抵扣就填 0。", pi: "通胀率", r: "投资年化收益率",
      X: "每年多出的钱", Y: "年数", P: "一笔资金", cg: "收益的资本利得税",
      R: "全款买房的年收益率（租金+增值−成本）", D: "贷款利率", dp: "首付比例",
      kAfter: "税后房贷利率", kReal: "真实利率（扣通胀）", helps: "通胀在帮你还贷",
      kInvest: "拿去投资", kPrepay: "提前还贷", kDiff: "投资领先", kSpread: "只按利差的粗算",
      kB: "期末投资组合", kAdv: "比一开始就还清多出", kTax: "收益税", kBook: "粗算",
      kN: "杠杆 N（贷款÷首付）", kRoi: "首付的收益率", kLev: "杠杆贡献", drag: "杠杆在拖累收益",
      tDown: "首付", sens: "首付收益率（贷款利率取上面的值）",
      method: [
        "税后利率 = i × (1 − t)；真实利率 = i × (1 − t) − 通胀",
        "每年年初投入：终值 = X × ((1 + r)^Y − 1) / r × (1 + r)",
        "提前还贷是确定地赚到税后房贷利率；投资赚 r，但有风险",
        "一笔钱保留贷款只付利息：B = P(1 + r)^Y − P·i'·((1 + r)^Y − 1)/r",
        "ROI = R + (R − D) × N，N = 贷款 / 首付",
        "• 提前还贷是无风险但流动性差的“投资”；投资不保证收益，熊市里可能低于房贷利率，而且你要有能力持续还月供。",
        "• 浮动利率、重新贷款费用和其他税费没有计算。"
      ]
    }
  };
  var fields = [
    { sec: "s1", id: "i", type: "pct", def: 4, lbl: "i" },
    { id: "t", type: "pct", def: 0, lbl: "t", hint: "tHint" },
    { id: "pi", type: "pct", def: 3, lbl: "pi" },
    { id: "r", type: "pct", def: 10, lbl: "r" },
    { sec: "s2", id: "X", type: "num", def: 10000, lbl: "X" },
    { id: "Y", type: "num", def: 30, lbl: "Y" },
    { sec: "s3", id: "P", type: "num", def: 1000000, lbl: "P" },
    { id: "cg", type: "pct", def: 15, lbl: "cg" },
    { sec: "s4", id: "R", type: "pct", def: 6.5, lbl: "R" },
    { id: "D", type: "pct", def: 4, lbl: "D" },
    { id: "dp", type: "pct", def: 20, lbl: "dp" }
  ];
  function render(v, t) {
    if (![v.i, v.t, v.pi, v.r, v.X, v.Y, v.P, v.cg, v.R, v.D, v.dp].every(isFinite) || v.Y < 1 || v.Y > 80 || v.dp <= 0 || v.dp > 1) return false;
    var real = E.realRate(v.i, v.t, v.pi);
    var out = [A.panel(t.s1, [A.kpis([[t.kAfter, pct(E.afterTaxRate(v.i, v.t), 2)], [t.kReal, pct(real, 2), real < 0 ? "good" : ""]]), real < 0 ? A.badge(t.helps, "good") : null].filter(Boolean))];
    var y = E.yearlyExtra({ X: v.X, Y: v.Y, r: v.r, i: v.i, t: v.t });
    out.push(A.panel(t.s2, [A.kpis([[t.kInvest, fmt(y.invest)], [t.kPrepay, fmt(y.prepay)], [t.kDiff, fmt(y.diff), "good"], [t.kSpread, fmt(y.spreadApprox)]])]));
    var L = E.lumpSum({ P: v.P, Y: v.Y, r: v.r, i: v.i, t: v.t, cg: v.cg });
    out.push(A.panel(t.s3, [A.kpis([[t.kB, fmt(L.B)], [t.kAdv, fmt(L.advantage), "good"], [t.kTax, fmt(L.tax)], [t.kBook, fmt(L.bookApprox)]])]));
    var N = E.leverageFromDown(v.dp), roi = E.houseROI({ R: v.R, D: v.D, N: N });
    var p4 = [A.kpis([[t.kN, fmt(N, 2)], [t.kRoi, pct(roi, 1), roi < v.R ? "bad" : "good"], [t.kLev, pct((v.R - v.D) * N, 1)]])];
    if (v.R < v.D) p4.push(A.badge(t.drag, "bad"));
    var Rs = [0.03, 0.05, 0.065, 0.09];
    p4.push(h("h2", { text: t.sens }));
    p4.push(A.table([t.tDown].concat(Rs.map(function (x) { return "R " + pct(x, 1); })), [0.1, 0.2, 0.3, 0.5, 1].map(function (d) {
      return [pct(d, 0)].concat(Rs.map(function (R) { return pct(E.houseROI({ R: R, D: v.D, N: E.leverageFromDown(d) }), 1); }));
    })));
    out.push(A.panel(t.s4, p4));
    return out;
  }
  A.mount({ I18N: I18N, fields: fields, render: render });
})();
