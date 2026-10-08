(function () {
  var A = window.AWL, E = window.RebalEngine, AE = window.AllocEngine, h = A.h, fmt = A.fmt, pct = A.pct;
  var NAMES = { US: ["QQQ", "QLD", "SGOV"], TW: ["00662", "00670L", "00865B"] };
  var I18N = {
    en: {
      title: "Smart Rebalancing Assistant",
      subtitle: "Once a year, enter your three sleeves and get this year's move.",
      s1: "Target & today's values", s2: "Rules",
      preset: "Target mix", region: "Labels", rGen: "Generic", rUS: "US tickers", rTW: "Taiwan tickers",
      base: "Base index value", lev: "2x leveraged value", cash: "Cash / T-bill value",
      levStart: "Leveraged value a year ago", levNew: "New money put into the leveraged part this year",
      lock: "Profit-lock ratio", down: "Down-year top-up rate", pledged: "I have a pledge loan", initial: "Total assets at the start", newMoney: "Lump sum to invest (optional)",
      tBase: "Base index", tLev: "2x leveraged", tCash: "Cash / short bonds",
      up: "Up year", downY: "Down year", flat: "Flat year", kType: "Year type", kGain: "Pure gain of the leveraged part", kBasis: "Top-up base",
      doUp: "Sell {a} of {from}, buy {to}", doDown: "Use {to_} to buy {a} of {lev}", doNone: "No action this year",
      cmp: "Comparison", cCur: "Now", cSmart: "After smart rebalance", cMind: "After mechanical rebalance", cBeta: "Beta",
      lumpTitle: "Lump-sum allocation", buy: "Buy",
      short: "Cash is not enough for the full top-up: your cash buffer is thin.",
      method: [
        "pure gain = leveraged value now − a year ago − new money this year",
        "up year: sell min(leveraged, lock ratio × pure gain) of the leveraged part → cash",
        "down year: buy leveraged with  rate × base  from cash (base = starting assets if pledged, else current assets)",
        "mechanical: leveraged + cash re-split by target weights; base index untouched",
        "lump sum: buy only the under-weight parts, scaled to the new money; never sell",
        "• Subtract new money, or you will sell your own fresh contributions as if they were profit.",
        "• Down years are bought slowly because the cash must last through many bear years.",
        "• With a pledge loan the starting assets are used as base: after a rally, the current value would drain cash too fast."
      ]
    },
    zh: {
      title: "聪明再平衡执行器",
      subtitle: "每年固定一天，输入三个部位的市值，得到这一年的操作。",
      s1: "目标与今天的市值", s2: "规则",
      preset: "目标阵型", region: "标的名称", rGen: "通用", rUS: "美股标的", rTW: "台股标的",
      base: "原型指数市值", lev: "二倍杠杆市值", cash: "现金/短债市值",
      levStart: "一年前的杠杆部位市值", levNew: "今年新投入杠杆部位的本金",
      lock: "锁利比例", down: "下跌年补仓比例", pledged: "我有质押借款", initial: "最初投入的总资产", newMoney: "大额资金（可选）",
      tBase: "原型指数", tLev: "二倍杠杆", tCash: "现金/短债",
      up: "上涨年", downY: "下跌年", flat: "持平", kType: "年份类型", kGain: "杠杆部位纯收益", kBasis: "补仓基数",
      doUp: "卖出 {a} 的{from}，买入{to}", doDown: "用{to_}买入 {a} 的{lev}", doNone: "今年不用操作",
      cmp: "对比", cCur: "当前", cSmart: "聪明再平衡后", cMind: "无脑再平衡后", cBeta: "Beta",
      lumpTitle: "大额资金精算", buy: "买入",
      short: "现金不够按规则补仓，说明现金防线偏薄。",
      method: [
        "纯收益 = 杠杆部位今年市值 − 一年前市值 − 今年新投入",
        "上涨年：卖出 min(杠杆市值, 锁利比例 × 纯收益) 的杠杆，转入现金",
        "下跌年：从现金拿出 比例 × 基数 买入杠杆（有质押：基数 = 初始资产；无质押：当前资产）",
        "无脑：把（杠杆+现金）按目标比例重分，原型不动",
        "大额资金：只买低配部位，并缩放到新资金总额；不卖出任何部位",
        "• 一定要扣除新投入的本金，否则会把自己刚投入的钱当收益卖掉。",
        "• 下跌年要慢慢补，因为现金要撑过很多年的熊市。",
        "• 有质押时用初始资产当基数：上涨之后再用当前资产会让现金消耗过快。"
      ]
    }
  };
  var fields = [
    { sec: "s1", id: "preset", type: "sel", def: "433", lbl: "preset", opts: Object.keys(AE.PRESETS).map(function (k) { return [k, k]; }) },
    { id: "region", type: "sel", def: "GEN", lbl: "region", opts: [["GEN", "rGen"], ["US", "rUS"], ["TW", "rTW"]] },
    { id: "base", type: "num", def: 400000, lbl: "base" },
    { id: "lev", type: "num", def: 135000, lbl: "lev" },
    { id: "cash", type: "num", def: 300000, lbl: "cash" },
    { id: "levStart", type: "num", def: 100000, lbl: "levStart" },
    { id: "levNew", type: "num", def: 5000, lbl: "levNew" },
    { sec: "s2", id: "lock", type: "pct", def: 30, lbl: "lock" },
    { id: "down", type: "pct", def: 2, lbl: "down" },
    { id: "pledged", type: "chk", def: true, lbl: "pledged" },
    { id: "initial", type: "num", def: 1000000, lbl: "initial", show: function (v) { return v.pledged; } },
    { id: "newMoney", type: "num", def: 0, lbl: "newMoney" }
  ];
  function render(v, t) {
    var nm = NAMES[v.region] || [t.tBase, t.tLev, t.tCash];
    var target = AE.PRESETS[v.preset];
    var p = { base: v.base, lev: v.lev, cash: v.cash };
    if (![v.base, v.lev, v.cash, v.levStart, v.levNew, v.lock, v.down].every(isFinite) || v.base < 0 || v.lev < 0 || v.cash < 0) return false;
    var s = E.smart({ p: p, levStart: v.levStart, levNew: v.levNew, lockRatio: v.lock, downRate: v.down, pledged: v.pledged, initialTotal: v.initial });
    if (!s.ok) return false;
    var m = E.mindless(p, target), cw = (function () { var T = v.base + v.lev + v.cash; return { base: v.base / T, lev: v.lev / T, cash: v.cash / T }; })();
    var typeTxt = { up: t.up, down: t.downY, flat: t.flat }[s.type];
    var act;
    if (!s.action) act = t.doNone;
    else if (s.type === "up") act = t.doUp.replace("{a}", fmt(s.action.amount)).replace("{from}", nm[1]).replace("{to}", nm[2]);
    else act = t.doDown.replace("{a}", fmt(s.action.amount)).replace("{to_}", nm[2]).replace("{lev}", nm[1]);
    var k = [[t.kType, typeTxt, s.type === "up" ? "good" : s.type === "down" ? "warn" : ""], [t.kGain, fmt(s.pureGain)]];
    if (s.basis) k.push([t.kBasis, fmt(s.basis)]);
    var p1 = [h("p", { cls: "big", text: act }), A.kpis(k)];
    if (s.flags.indexOf("cash_short") >= 0) p1.push(h("p", { cls: "alert bad", text: t.short }));
    var col = function (a, w, b) { return [fmt(a.base) + " (" + pct(w.base, 0) + ")", fmt(a.lev) + " (" + pct(w.lev, 0) + ")", fmt(a.cash) + " (" + pct(w.cash, 0) + ")", fmt(b, 2)]; };
    var c1 = col(p, cw, AE.beta(cw)), c2 = col(s.after, s.weights, s.beta), c3 = col(m.after, m.weights, m.beta);
    p1.push(A.table(["", t.cCur, t.cSmart, t.cMind], [[nm[0], c1[0], c2[0], c3[0]], [nm[1], c1[1], c2[1], c3[1]], [nm[2], c1[2], c2[2], c3[2]], [t.cBeta, c1[3], c2[3], c3[3]]]));
    var out = [A.panel(t.cmp, p1)];
    if (v.newMoney > 0) {
      var L = E.lumpSum(p, v.newMoney, target);
      out.push(A.panel(t.lumpTitle, [A.table(["", t.buy, "→"], [[nm[0], fmt(L.buys.base), pct(L.weights.base, 0)], [nm[1], fmt(L.buys.lev), pct(L.weights.lev, 0)], [nm[2], fmt(L.buys.cash), pct(L.weights.cash, 0)]]), A.note("Beta " + fmt(L.beta, 2))]));
    }
    return out;
  }
  A.mount({ I18N: I18N, fields: fields, render: render });
})();
