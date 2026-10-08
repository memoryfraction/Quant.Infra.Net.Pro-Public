(function () {
  var A = window.AWL, E = window.AllocEngine, h = A.h, fmt = A.fmt, pct = A.pct;
  var NAMES = {
    US: ["QQQ", "QLD", "SGOV / BOXX"], TW: ["00662", "00670L", "00865B"], GEN: null
  };
  var DESC = {
    "703": ["New investors / retirees without leverage", "新手 / 不开杠杆的退休者"], "802": ["Conservative, no leverage (~2% draw)", "保守，无杠杆（提领约 2%）"],
    "613": ["A little leverage", "入门加一点杠杆"], "433": ["Classic balance", "经典平衡"], "442": ["Aggressive: under 30, salaried, not living off assets", "积极：30 岁以下、有工资、不靠资产生活"],
    "514": ["Retired, 3–4% draw", "退休，提领 3–4%"], "424": ["Extra cash", "加厚现金"], "415": ["Retired, 4–5% draw", "退休，提领 4–5%"],
    "505": ["Elderly / maximum cash", "高龄 / 极致现金"], "226": ["Large near-term spending", "近期有大额刚性支出"]
  };
  var I18N = {
    en: {
      title: "433 Allocation & Beta Check",
      subtitle: "Mix a base index, a 2x leveraged ETF and cash — and see how much market exposure you really carry.",
      s1: "1 · Cash first", s2: "2 · Pick a mix", s3: "3 · Household exposure",
      assets: "Total investable assets", expense: "Yearly spending",
      age: "Age", salaried: "Steady salary (not living off the portfolio)", withdrawing: "I need to draw living costs from the portfolio", pledge: "Pledge-loan line is set up", novice: "First time investing",
      region: "Labels", rGen: "Generic", rUS: "US tickers", rTW: "Taiwan tickers",
      preset: "Mix (base / 2x / cash)", custom: "Custom", cBase: "Base index", cLev: "2x leveraged", cCash: "Cash / T-bills",
      house: "Property value", stock1x: "1x stocks / base index", stock2x: "2x leveraged ETFs", stock3x: "3x leveraged ETFs", cash: "Cash & T-bills",
      mortSelf: "Home mortgage balance", mortInvest: "Investment-purpose mortgage", creditLoan: "Credit loan balance", creditLineTotal: "Credit line (total)", creditLineUsed: "Credit line (used)",
      kFloor: "Cash floor", kInv: "Can invest", kBeta: "Portfolio beta", kSug: "Suggested mix", beginner: "Assets are under 3× yearly spending: lock one year of spending as a reserve first, invest the rest.",
      base: "Base index", lev: "2x leveraged", cashL: "Cash / short bonds", sumBad: "The three weights must add up to 100%.",
      tbl: "Reference mixes", tMix: "Mix", tW: "Weights", tB: "Beta", tUse: "Use for",
      sLiq: "Liquid-asset beta", sNw: "Net-worth beta", sLnw: "Liquid net-worth leverage", sHyp: "Beta incl. unused credit", sBook: "Book leverage (assets / net worth)", sExp: "Exposure leverage", sCash: "Cash share of liquid assets",
      exNote: "Book leverage looks at debt; exposure leverage also counts the amplification of 2x/3x ETFs, so it is usually higher. Unused credit is not real cash — banks can withdraw it.",
      r_sum: "Weights do not add up to 100%.", r_lev_gt_base: "Leveraged part exceeds the base index.", r_lev_gt_cash: "Leveraged part exceeds cash.",
      r_cash_low: "Cash is low (guideline: 30%, minimum 20%).", r_lev_no_pledge: "Living off the portfolio without a pledge line: do not use leverage.",
      r_beta_age: "Over 30: 433 (beta 1.0) is already the aggressive limit.", r_beta_high: "Beta above 1.2 is too high.", r_all_good: "All rules pass.",
      f_cash_share_low: "Cash is under 30% of liquid assets.", f_negative_nw: "Net worth is not positive.",
      method: [
        "beta = base × 1 + leveraged × 2 + cash × 0",
        "cash floor = min(assets, max(1 year spending, 30% × assets))",
        "market exposure = 1x + 2 × (2x ETFs) + 3 × (3x ETFs)",
        "liquid-asset beta = exposure / (stocks + cash)      net-worth beta = exposure / net worth",
        "exposure leverage = (property + exposure) / net worth",
        "• Rules: the leveraged part must not exceed the base index nor cash; 442 only suits people under 30 with a salary who do not live off assets.",
        "• Cash is what lets you add on drops without being forced to sell. Back-tests and simulations do not predict the future."
      ]
    },
    zh: {
      title: "433 配置与 Beta 体检",
      subtitle: "原型、二倍杠杆、现金三种资产怎么配，组合的波动相当于几倍大盘。",
      s1: "1 · 先留现金", s2: "2 · 选阵型", s3: "3 · 全家资产曝险",
      assets: "可投资总资产", expense: "年开销",
      age: "年龄", salaried: "有稳定工资（不靠组合生活）", withdrawing: "需要从投资组合里拿生活费", pledge: "已开通质押额度", novice: "第一次投资",
      region: "标的名称", rGen: "通用", rUS: "美股标的", rTW: "台股标的",
      preset: "阵型（原型/二倍/现金）", custom: "自定义", cBase: "原型指数", cLev: "二倍杠杆", cCash: "现金/短债",
      house: "房产市值", stock1x: "1 倍股票/原型指数", stock2x: "二倍杠杆 ETF", stock3x: "三倍杠杆 ETF", cash: "现金与短债",
      mortSelf: "自住房贷余额", mortInvest: "投资用途房贷余额", creditLoan: "信贷余额", creditLineTotal: "信贷额度（总）", creditLineUsed: "信贷额度（已用）",
      kFloor: "现金底线", kInv: "可投入", kBeta: "组合 Beta", kSug: "建议阵型", beginner: "资产不到年开销 3 倍：先锁定 1 年开销做备用金，剩下的再投资。",
      base: "原型指数", lev: "二倍杠杆", cashL: "现金/短债", sumBad: "三项合计必须是 100%。",
      tbl: "参考阵型", tMix: "阵型", tW: "比例", tB: "Beta", tUse: "适用",
      sLiq: "流动资产 Beta", sNw: "总净资产 Beta", sLnw: "流动净资产曝险杠杆", sHyp: "含未动用信贷的 Beta", sBook: "账面杠杆（总资产/净资产）", sExp: "曝险杠杆", sCash: "现金占流动资产",
      exNote: "账面杠杆看的是负债；曝险杠杆把 2 倍、3 倍 ETF 的放大效果也算进去，通常更高。未动用的信贷额度不是真现金，银行可以收回。",
      r_sum: "三项合计不是 100%。", r_lev_gt_base: "杠杆部位超过了原型。", r_lev_gt_cash: "杠杆部位超过了现金。",
      r_cash_low: "现金偏低（参考：30%，下限 20%）。", r_lev_no_pledge: "靠资产生活又没有质押额度：不应使用杠杆。",
      r_beta_age: "30 岁以上：433（Beta 1.0）已是积极上限。", r_beta_high: "Beta 超过 1.2，太高。", r_all_good: "规则全部通过。",
      f_cash_share_low: "现金不到流动资产的 30%。", f_negative_nw: "净资产不为正。",
      method: [
        "Beta = 原型 × 1 + 杠杆 × 2 + 现金 × 0",
        "现金底线 = min(资产, max(1 年开销, 30% × 资产))",
        "股票市场曝险 = 1 倍 + 2 × 二倍 ETF + 3 × 三倍 ETF",
        "流动资产 Beta = 曝险 / (股票 + 现金)      总净资产 Beta = 曝险 / 净资产",
        "曝险杠杆 = (房产 + 曝险) / 净资产",
        "• 规则：杠杆部位不超过原型，也不超过现金；442 只适合 30 岁以下、有工资、不靠资产生活的人。",
        "• 现金的作用是大跌时有钱补仓、不被迫卖股。回测和模拟不代表未来。"
      ]
    }
  };
  var presetOpts = Object.keys(E.PRESETS).map(function (k) { return [k, k]; }).concat([["custom", "custom"]]);
  var fields = [
    { sec: "s1", id: "assets", type: "num", def: 1000000, lbl: "assets" },
    { id: "expense", type: "num", def: 100000, lbl: "expense" },
    { sec: "s2", id: "age", type: "num", def: 40, lbl: "age" },
    { id: "salaried", type: "chk", def: true, lbl: "salaried" },
    { id: "withdrawing", type: "chk", def: false, lbl: "withdrawing" },
    { id: "pledge", type: "chk", def: false, lbl: "pledge" },
    { id: "novice", type: "chk", def: false, lbl: "novice" },
    { id: "region", type: "sel", def: "GEN", lbl: "region", opts: [["GEN", "rGen"], ["US", "rUS"], ["TW", "rTW"]] },
    { id: "preset", type: "sel", def: "433", lbl: "preset", opts: presetOpts },
    { id: "cBase", type: "pct", def: 40, lbl: "cBase", show: function (v) { return v.preset === "custom"; } },
    { id: "cLev", type: "pct", def: 30, lbl: "cLev", show: function (v) { return v.preset === "custom"; } },
    { id: "cCash", type: "pct", def: 30, lbl: "cCash", show: function (v) { return v.preset === "custom"; } },
    { sec: "s3", id: "house", type: "num", def: 0, lbl: "house" },
    { id: "stock1x", type: "num", def: 400000, lbl: "stock1x" },
    { id: "stock2x", type: "num", def: 300000, lbl: "stock2x" },
    { id: "stock3x", type: "num", def: 0, lbl: "stock3x" },
    { id: "cash", type: "num", def: 300000, lbl: "cash" },
    { id: "mortSelf", type: "num", def: 0, lbl: "mortSelf" },
    { id: "mortInvest", type: "num", def: 0, lbl: "mortInvest" },
    { id: "creditLoan", type: "num", def: 0, lbl: "creditLoan" },
    { id: "creditLineTotal", type: "num", def: 0, lbl: "creditLineTotal" },
    { id: "creditLineUsed", type: "num", def: 0, lbl: "creditLineUsed" }
  ];
  var ui;
  function render(v, t) {
    var zh = document.documentElement.lang !== "en" ? 1 : 0;
    var c = E.cashFloor({ assets: v.assets, annualExpense: v.expense });
    if (!c.ok || !isFinite(v.age)) return false;
    var sug = E.suggest({ age: v.age, salaried: v.salaried, withdrawing: v.withdrawing, pledge: v.pledge, novice: v.novice });
    var w = v.preset === "custom" ? { base: v.cBase, lev: v.cLev, cash: v.cCash } : E.PRESETS[v.preset];
    if (![w.base, w.lev, w.cash].every(isFinite)) return false;
    var nm = NAMES[v.region] || [t.base, t.lev, t.cashL];
    var out = [];
    var p1 = [A.kpis([[t.kFloor, fmt(c.floor)], [t.kInv, fmt(c.investable)], [t.kSug, sug]])];
    if (c.beginner) p1.push(h("p", { cls: "alert info", text: t.beginner }));
    out.push(A.panel(t.s1, p1));

    var sumOk = Math.abs(w.base + w.lev + w.cash - 1) <= 0.001;
    var p2 = [];
    if (!sumOk) p2.push(h("p", { cls: "err", text: t.sumBad }));
    else {
      var b = E.beta(w);
      p2.push(A.kpis([[t.kBeta, fmt(b, 2)]]));
      var bar = h("div", { cls: "bar" }, [["base", "#0F5C55"], ["lev", "#B8892B"], ["cash", "#4F6D8F"]].map(function (x) {
        var d = h("div", { text: pct(w[x[0]], 0) }); d.style.flexBasis = (w[x[0]] * 100) + "%"; d.style.background = x[1]; return d;
      }));
      p2.push(bar);
      var inv = c.investable;
      p2.push(A.table(["", t.tW, ""], [
        [nm[0], pct(w.base, 0), fmt(inv * w.base)], [nm[1], pct(w.lev, 0), fmt(inv * w.lev)], [nm[2], pct(w.cash, 0), fmt(inv * w.cash)]
      ]));
      var rules = E.checkRules({ w: w, age: v.age, salaried: v.salaried, withdrawing: v.withdrawing, pledge: v.pledge });
      p2.push(h("div", null, rules.map(function (r) { return h("div", null, [A.badge(t["r_" + r.code], r.level)]); })));
    }
    var keys = Object.keys(E.PRESETS);
    p2.push(h("h2", { text: t.tbl }));
    p2.push(A.table([t.tMix, t.tW, t.tB, t.tUse], keys.map(function (k) {
      var p = E.PRESETS[k]; return [k, Math.round(p.base * 100) + " / " + Math.round(p.lev * 100) + " / " + Math.round(p.cash * 100), fmt(E.beta(p), 2), DESC[k][zh]];
    }), { hl: keys.indexOf(v.preset) }));
    out.push(A.panel(t.s2, p2));

    var e = E.exposure(v);
    var p3 = [A.kpis([[t.sLiq, fmt(e.liqBeta, 2)], [t.sNw, fmt(e.nwBeta, 2)], [t.sLnw, fmt(e.lnwLev, 2)], [t.sHyp, fmt(e.hypBeta, 2)], [t.sBook, fmt(e.bookLev, 2)], [t.sExp, fmt(e.expLev, 2)], [t.sCash, pct(e.cashShare, 0)]])];
    e.flags.forEach(function (f) { p3.push(A.badge(t["f_" + f], "warn")); });
    p3.push(A.note(t.exNote));
    out.push(A.panel(t.s3, p3));
    return out;
  }
  ui = A.mount({ I18N: I18N, fields: fields, render: render });
})();
