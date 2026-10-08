(function () {
  var A = window.AWL, E = window.WdEngine, h = A.h, fmt = A.fmt, pct = A.pct;
  var I18N = {
    en: {
      title: "Retirement Withdrawal Ladder",
      subtitle: "How many years of spending you hold, what you can draw each year, and what to do when it isn't enough.",
      s1: "1 · Which rung am I on?", s2: "2 · High-yield rescue mix", s3: "3 · Rule of thumb", s4: "4 · Sequence-of-returns demo",
      assets: "Retirement financial assets", expense: "Yearly spending", lev: "My mix includes 2x leveraged ETFs",
      yieldRate: "Distribution yield", core: "Share of the rest in base index",
      nominal: "Long-run yearly return", infl: "Inflation",
      start: "Starting balance", withdraw: "Yearly withdrawal", returns: "Yearly returns (%, comma separated)",
      kMult: "Assets ÷ spending", kRate: "Current draw rate", kTier: "Tier", kNext: "Needed for next tier",
      perpetual: "Perpetual (≈2%)", solid: "Solid (≈3%)", edge: "Edge (≈4%)", rescue: "Rescue zone", critical: "Critical",
      ruleTitle: "Suggested cash rule", r433: "433 mix (30% cash)", r514: "514 mix (40% cash)", r505: "505 mix (50% cash)", r8020: "80 / 20 base / cash", r6535: "65 / 35 base / cash", r5050: "50 / 50 base / cash", rq: "See the rescue mix below",
      qqqi: "High-yield income fund", coreL: "Base index", cashL: "Cash / T-bills", cover: "The yield alone cannot cover spending.",
      tenFive: "“10 + 5” comparison: 10× spending in the income fund, 5× split 70/30",
      warnRescue: "Emergency plan for insufficient assets: covered-call funds trade future upside for income today. Not for people still building wealth.",
      kBook: "Return − inflation", kUsual: "Common 4% rule",
      bookNote: "The lower the return, the lower the safe draw.",
      fwd: "Bad years first", rev: "Good years first", badInput: "Enter comma-separated numbers.",
      seqNote: "Without withdrawals both orders end equal; with yearly withdrawals the path that meets the crash first ends far lower.",
      tYear: "Year",
      method: [
        "multiple = assets / spending;  draw rate = spending / assets",
        "50× ≈ 2%,  33× ≈ 3%,  25× ≈ 4%,  15× ≈ 6.7%",
        "rescue: income-fund amount = spending / yield; the rest split 70% base / 30% cash",
        "“10 + 5”: 10 × spending in the income fund; 5 × spending in 70/30",
        "safe rate ≈ long-run return − inflation",
        "each year: balance = (balance − withdrawal) × (1 + return)"
      ]
    },
    zh: {
      title: "退休提领率阶梯",
      subtitle: "资产是年开销的几倍、每年能动用多少、不够时怎么补现金流。",
      s1: "1 · 我在第几档", s2: "2 · 高配息救援方案", s3: "3 · 书中的经验法则", s4: "4 · 顺序风险演示",
      assets: "可用于退休的金融资产", expense: "年开销", lev: "我的组合含二倍杠杆 ETF",
      yieldRate: "配息率", core: "剩余资金中原型占比",
      nominal: "长期年化收益率", infl: "通胀率",
      start: "起始余额", withdraw: "每年取出", returns: "每年收益率（%，逗号分隔）",
      kMult: "资产 ÷ 年开销", kRate: "当前提领率", kTier: "档位", kNext: "升到下一档还差",
      perpetual: "永续（≈2%）", solid: "稳健（≈3%）", edge: "边缘（≈4%）", rescue: "救援区", critical: "极限",
      ruleTitle: "建议的现金规则", r433: "433 阵型（30% 现金）", r514: "514 阵型（40% 现金）", r505: "505 阵型（50% 现金）", r8020: "原型 80 / 现金 20", r6535: "原型 65 / 现金 35", r5050: "原型 50 / 现金 50", rq: "看下面的救援方案",
      qqqi: "高配息收益型基金", coreL: "原型指数", cashL: "现金/短债", cover: "仅靠配息无法覆盖开销。",
      tenFive: "“10 + 5”对照：10 倍年开销放收益型基金，5 倍按 70/30 配置",
      warnRescue: "这是资产不足时的应急方案：备兑策略用未来的上涨空间换现在的现金流，还在累积资产的人不应使用。",
      kBook: "收益率 − 通胀率", kUsual: "常用 4% 法则",
      bookNote: "收益率越低，能安全取的比例越低。",
      fwd: "先遇到差的年份", rev: "先遇到好的年份", badInput: "请输入用逗号分隔的数字。",
      seqNote: "不取钱时两种顺序终值相同；每年取钱时，先遇到大跌的路径终值会低很多。",
      tYear: "年",
      method: [
        "倍数 = 资产 / 年开销；提领率 = 年开销 / 资产",
        "50 倍 ≈ 2%，33 倍 ≈ 3%，25 倍 ≈ 4%，15 倍 ≈ 6.7%",
        "救援：收益型基金金额 = 年开销 / 配息率；其余按 70% 原型 / 30% 现金",
        "“10 + 5”：10 倍年开销放收益型基金；5 倍年开销按 70/30",
        "可持续提取率 ≈ 长期收益率 − 通胀率",
        "每年：余额 = (余额 − 取款) × (1 + 收益率)"
      ]
    }
  };
  var fields = [
    { sec: "s1", id: "assets", type: "num", def: 5000000, lbl: "assets" },
    { id: "expense", type: "num", def: 120000, lbl: "expense" },
    { id: "lev", type: "chk", def: false, lbl: "lev" },
    { sec: "s2", id: "yieldRate", type: "pct", def: 10, lbl: "yieldRate" },
    { id: "core", type: "pct", def: 70, lbl: "core" },
    { sec: "s3", id: "nominal", type: "pct", def: 8, lbl: "nominal" },
    { id: "infl", type: "pct", def: 3, lbl: "infl" },
    { sec: "s4", id: "start", type: "num", def: 100, lbl: "start" },
    { id: "withdraw", type: "num", def: 4, lbl: "withdraw" },
    { id: "returns", type: "text", def: "-30,-20,10,20,30", lbl: "returns", wide: true }
  ];
  var seq = null;
  function render(v, t) {
    var l = E.ladder({ assets: v.assets, expense: v.expense });
    if (!l.ok) return false;
    var cls = { perpetual: "good", solid: "good", edge: "warn", rescue: "bad", critical: "bad" }[l.tier];
    var p1 = [A.kpis([[t.kMult, fmt(l.multiple, 1) + "×"], [t.kRate, pct(l.rate, 2)], [t.kTier, t[l.tier], cls], [t.kNext, l.toNext > 0 ? fmt(l.toNext) : "—"]])];
    var rule = E.cashRule(l.rate, v.lev), rk = { "433": "r433", "514": "r514", "505": "r505", "80/20": "r8020", "65/35": "r6535", "50/50": "r5050", qqqi: "rq" }[rule];
    p1.push(A.note(t.ruleTitle + ": " + t[rk]));
    var out = [A.panel(t.s1, p1)];

    var q = E.qqqiRescue({ assets: v.assets, expense: v.expense, yieldRate: v.yieldRate, coreRatio: v.core });
    var tf = E.tenPlusFive({ expense: v.expense, yieldRate: v.yieldRate });
    var p2 = [h("p", { cls: "alert info", text: t.warnRescue }),
      A.table(["", ""], [[t.qqqi, fmt(q.qqqi)], [t.coreL, fmt(q.core)], [t.cashL, fmt(q.cash)]])];
    if (q.flags.length) p2.push(A.badge(t.cover, "bad"));
    p2.push(A.note(t.tenFive));
    p2.push(A.table(["", ""], [[t.qqqi, fmt(tf.qqqi)], [t.coreL, fmt(tf.core)], [t.cashL, fmt(tf.cash)]]));
    var det = h("details", l.tier === "rescue" || l.tier === "critical" ? { open: "" } : null, [h("summary", { text: t.s2 })].concat(p2));
    out.push(h("section", { cls: "panel" }, [det]));

    out.push(A.panel(t.s3, [A.kpis([[t.kBook, pct(E.bookSafeRate(v.nominal, v.infl), 1)], [t.kUsual, "4.0%"]]), A.note(t.bookNote)]));

    var rs = String(v.returns).split(",").map(function (x) { return x.trim() === "" ? NaN : Number(x) / 100; });
    var p4;
    if (!rs.length || rs.some(function (x) { return !isFinite(x); }) || !(v.start > 0) || !(v.withdraw >= 0)) { seq = null; p4 = [h("p", { cls: "err", text: t.badInput })]; }
    else {
      var sd = E.sequenceDemo({ start: v.start, withdraw: v.withdraw, returns: rs });
      seq = sd;
      p4 = [A.chartBox("seqChart", [[t.fwd, "#0F5C55"], [t.rev, "#B8892B"]]),
        A.table([t.tYear, t.fwd, t.rev], sd.forward.map(function (x, i) { return [String(i + 1), fmt(x, 1), fmt(sd.reversed[i], 1)]; })), A.note(t.seqNote)];
    }
    out.push(A.panel(t.s4, p4));
    return out;
  }
  A.mount({
    I18N: I18N, fields: fields, render: render,
    after: function () {
      var cv = document.getElementById("seqChart"); if (!cv || !seq) return;
      A.drawLines(cv, [{ color: "#0F5C55", pts: seq.forward }, { color: "#B8892B", pts: seq.reversed }], { xs: seq.forward.map(function (_, i) { return String(i + 1); }), fmtY: function (x) { return fmt(x, 0); } });
    }
  });
})();
