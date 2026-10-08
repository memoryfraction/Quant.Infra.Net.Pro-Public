(function () {
  var A = window.AWL, E = window.MarginEngine, h = A.h, fmt = A.fmt, pct = A.pct;
  var I18N = {
    en: {
      title: "Pledge Loan Margin & Liquidation Check",
      subtitle: "How far the market can fall before a margin call — and how a yearly living-cost loan erodes your buffer.",
      s1: "1 · My margin ratio now", s2: "2 · How much to borrow, how far can it fall", s3: "3 · Retiree borrowing living costs every year",
      collateral: "Collateral market value", loan: "Loan balance", renew: "Renewal line", warn: "Broker warning line", call: "Margin-call line",
      lineHint: "Taiwan-style defaults; follow your broker contract.",
      mRate: "Loan interest rate", mYears: "Years of bear market to survive", mLtv: "Max loan-to-value", mGrowth: "Collateral yearly growth",
      C0: "Starting collateral", draw: "Yearly borrowing (% of starting)", i: "Loan interest rate", g: "Collateral yearly growth", yrs: "Years",
      kRatio: "Current ratio", kStatus: "Status", kToRenew: "Fall to renewal line", kToWarn: "Fall to warning line", kToCall: "Fall to margin call", kAdd: "Add collateral", kRepay: "Or repay", already: "already below",
      noLoan: "No loan", safe: "Safe", no_renew: "Cannot renew", alert: "Warning", call: "Margin call", no_loan: "No loan",
      tLtv: "Loan / value", tInit: "Initial ratio", tRenew: "Fall to renewal", tWarn: "Fall to warning", tCall: "Fall to call", tRate: "Risk",
      very_high: "Very high", high: "High", medium: "Medium", low: "Low", very_safe: "Very safe",
      gridTitle: "Ratio after a fall (rows: loan / value, columns: fall)", multTitle: "Cash needed vs. loan",
      kMult: "Cash (or pledgeable assets) at least × loan",
      tYear: "Year", tLoan: "Loan", tColl: "Collateral", tRatio: "Ratio", tSt: "Status",
      first: "First time below", never: "not within the period", chart: "Ratio by year",
      method: [
        "ratio = collateral / loan = 1 / (loan-to-value)",
        "ratio after a fall d = (1 − d) / LTV        fall to hit line T = 1 − T × LTV",
        "cash multiple = (1 + rate)^years / maxLTV / (1 + growth)^years",
        "year n: loan = loan × (1 + i) + yearly draw;  collateral = start × (1 + g)^n",
        "• A high ratio is not the same as being able to borrow at any time: brokers may cut limits when credit tightens.",
        "• The less you borrow, the longer you survive: after a 30% fall, a 20% borrower still sits at 350%, a 60% borrower is already called.",
        "• US brokers usually liquidate in real time; Taiwan settles after the close. Rules follow your contract."
      ]
    },
    zh: {
      title: "质押维持率与断头台",
      subtitle: "借几成、市场跌多少会被追缴；退休后每年借生活费，几年后会碰线。",
      s1: "1 · 我现在的维持率", s2: "2 · 借几成、跌多少会出事", s3: "3 · 退休后每年质押借生活费",
      collateral: "担保品市值", loan: "借款余额", renew: "可续约线", warn: "券商警示线", call: "追缴断头线",
      lineHint: "台湾常见默认值，以你的券商合约为准。",
      mRate: "借款利率", mYears: "要撑过的熊市年数", mLtv: "最高借款成数", mGrowth: "担保品年增长",
      C0: "起始担保品", draw: "每年借出（占起始 %）", i: "借款利率", g: "担保品年增长", yrs: "年数",
      kRatio: "当前维持率", kStatus: "状态", kToRenew: "跌到可续约线", kToWarn: "跌到警示线", kToCall: "跌到断头线", kAdd: "需补担保品", kRepay: "或还款", already: "已低于",
      noLoan: "没有借款", safe: "安全", no_renew: "无法续约", alert: "警示", call: "追缴断头", no_loan: "没有借款",
      tLtv: "借款成数", tInit: "初始维持率", tRenew: "跌到续约线", tWarn: "跌到警示线", tCall: "跌到断头线", tRate: "风险",
      very_high: "极高", high: "高", medium: "中", low: "低", very_safe: "极安全",
      gridTitle: "下跌后的维持率（行：借款成数，列：跌幅）", multTitle: "现金与借款的倍数",
      kMult: "现金（或可质押资产）至少是借款的倍数",
      tYear: "年", tLoan: "借款余额", tColl: "担保品", tRatio: "维持率", tSt: "状态",
      first: "首次低于", never: "期间内不会", chart: "逐年维持率",
      method: [
        "维持率 = 担保品市值 / 借款余额 = 1 / 借款成数",
        "下跌 d 后的维持率 = (1 − d) / 借款成数        跌到某条线 T 的幅度 = 1 − T × 借款成数",
        "现金倍数 = (1 + 利率)^年数 / 最高成数 / (1 + 增长)^年数",
        "第 n 年：借款 = 借款 × (1 + i) + 当年借出；担保品 = 起始 × (1 + g)^n",
        "• 维持率高 ≠ 随时能借：信用收紧时券商可能下调成数或冻结额度。",
        "• 借得越少活得越久：同样跌 30%，借两成的人维持率还有 350%，借六成的人已被追缴。",
        "• 美国券商通常实时追缴，台湾盘后结算；以合约为准。"
      ]
    }
  };
  var fields = [
    { sec: "s1", id: "collateral", type: "num", def: 1000000, lbl: "collateral" },
    { id: "loan", type: "num", def: 200000, lbl: "loan" },
    { id: "renew", type: "pct", def: 167, lbl: "renew", hint: "lineHint" },
    { id: "warn", type: "pct", def: 140, lbl: "warn" },
    { id: "call", type: "pct", def: 130, lbl: "call" },
    { sec: "s2", id: "mRate", type: "pct", def: 5, lbl: "mRate" },
    { id: "mYears", type: "num", def: 10, lbl: "mYears" },
    { id: "mLtv", type: "pct", def: 60, lbl: "mLtv" },
    { id: "mGrowth", type: "pct", def: 2, lbl: "mGrowth" },
    { sec: "s3", id: "C0", type: "num", def: 10000000, lbl: "C0" },
    { id: "draw", type: "pct", def: 2, lbl: "draw" },
    { id: "i", type: "pct", def: 5, lbl: "i" },
    { id: "g", type: "pct", def: 3, lbl: "g" },
    { id: "yrs", type: "num", def: 30, lbl: "yrs" }
  ];
  var lastProj = null;
  function render(v, t) {
    var th = { renew: v.renew, warn: v.warn, call: v.call };
    if (![v.collateral, v.loan, v.renew, v.warn, v.call].every(isFinite) || v.collateral <= 0 || v.loan < 0) return false;
    var cur = E.current({ collateral: v.collateral, loan: v.loan, th: th });
    var stCls = { safe: "good", no_renew: "warn", alert: "warn", call: "bad", no_loan: "" }[cur.status];
    var below = function (d) { return d < 0 ? t.already : pct(d, 1); };
    var p1;
    if (cur.status === "no_loan") p1 = [A.kpis([[t.kStatus, t.no_loan, "good"]])];
    else {
      var k = [[t.kRatio, pct(cur.ratio, 0), stCls], [t.kStatus, t[cur.status], stCls], [t.kToRenew, below(cur.dRenew)], [t.kToWarn, below(cur.dWarn)], [t.kToCall, below(cur.dCall)]];
      if (cur.status !== "safe") { k.push([t.kAdd, fmt(cur.addCollateral)]); k.push([t.kRepay, fmt(cur.repay)]); }
      p1 = [A.kpis(k)];
    }
    var out = [A.panel(t.s1, p1)];

    var ltvs = [0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
    var tbl = E.ltvTable(ltvs, th), curLtv = cur.ltv, hl = -1;
    if (curLtv) tbl.forEach(function (r, i) { if (curLtv <= r.ltv + 1e-9 && (i === tbl.length - 1 || curLtv > tbl[i + 1].ltv)) hl = i; });
    var p2 = [A.table([t.tLtv, t.tInit, t.tRenew, t.tWarn, t.tCall, t.tRate], tbl.map(function (r) {
      return [pct(r.ltv, 0), pct(r.init, 0), below(r.dRenew), below(r.dWarn), below(r.dCall), t[r.rating]];
    }), { hl: hl })];
    var drops = []; for (var d = 0; d <= 90; d += 5) drops.push(d / 100);
    var grid = E.dropGrid(ltvs, drops, th);
    var clsOf = { safe: "good", no_renew: "warn", alert: "warn", call: "bad" };
    p2.push(h("h2", { text: t.gridTitle }));
    p2.push(A.table([""].concat(drops.map(function (x) { return "−" + Math.round(x * 100) + "%"; })), grid.map(function (row, i) {
      return [pct(ltvs[i], 0)].concat(row.map(function (c) { return { t: Math.round(c.ratio * 100) + "%", cls: clsOf[c.status] }; }));
    })));
    var mult = v.mYears >= 0 && v.mLtv > 0 ? E.cashMultiple({ rate: v.mRate, years: v.mYears, maxLtv: v.mLtv, growth: v.mGrowth }) : null;
    p2.push(h("h2", { text: t.multTitle }));
    p2.push(A.kpis([[t.kMult, mult === null ? "—" : fmt(mult, 2) + "×"]]));
    out.push(A.panel(t.s2, p2));

    if (!(v.C0 > 0 && v.yrs >= 1 && v.yrs <= 80 && [v.draw, v.i, v.g].every(isFinite))) return false;
    var pr = E.project({ C0: v.C0, drawRate: v.draw, i: v.i, g: v.g, years: Math.floor(v.yrs), th: th });
    lastProj = { pr: pr, th: th };
    var firstTxt = function (n) { return n === null ? t.never : t.tYear + " " + n; };
    var p3 = [A.kpis([[t.first + " " + pct(th.renew, 0), firstTxt(pr.first.renew)], [t.first + " " + pct(th.warn, 0), firstTxt(pr.first.warn)], [t.first + " " + pct(th.call, 0), firstTxt(pr.first.call), pr.first.call ? "bad" : "good"]])];
    p3.push(h("h2", { text: t.chart }));
    p3.push(A.chartBox("projChart"));
    var step = pr.rows.length > 30 ? 5 : 1;
    p3.push(A.table([t.tYear, t.tLoan, t.tColl, t.tRatio, t.tSt], pr.rows.filter(function (r) { return r.year % step === 0 || r.year === pr.rows.length; }).map(function (r) {
      return [String(r.year), fmt(r.loan), fmt(r.collateral), pct(r.ratio, 0), { t: t[r.status], cls: clsOf[r.status] }];
    })));
    out.push(A.panel(t.s3, p3));
    return out;
  }
  A.mount({
    I18N: I18N, fields: fields, render: render,
    after: function () {
      var cv = document.getElementById("projChart"); if (!cv || !lastProj) return;
      var pr = lastProj.pr, th = lastProj.th;
      A.drawLines(cv, [{ name: "ratio", color: "#0F5C55", pts: pr.rows.map(function (r) { return Math.min(r.ratio, 10) * 100; }) }],
        { xs: pr.rows.map(function (r) { return String(r.year); }), fmtY: function (x) { return Math.round(x) + "%" },
          hlines: [{ y: th.renew * 100, color: "#2E7D4F", label: Math.round(th.renew * 100) + "%" }, { y: th.warn * 100, color: "#B8892B", label: Math.round(th.warn * 100) + "%" }, { y: th.call * 100, color: "#B3261E", label: Math.round(th.call * 100) + "%" }] });
    }
  });
})();
