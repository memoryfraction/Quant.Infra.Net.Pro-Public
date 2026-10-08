(function () {
  var A = window.AWL, E = window.SSEngine, h = A.h, fmt = A.fmt;
  var ages = []; for (var a = 62; a <= 70; a++) ages.push([String(a), String(a)]);
  var I18N = {
    en: {
      title: "Social Security: When to Claim",
      subtitle: "Early, full or delayed to 70 — monthly amounts and the age where waiting pays off.",
      s1: "Inputs", birth: "Birth year", pia: "Monthly benefit at full retirement age", piaHint: "See your statement at ssa.gov.",
      cA: "Compare age A", cB: "Compare age B", cC: "Compare age C", life: "Expected age at death",
      kFra: "Full retirement age", ym: "{y} y {m} m", tbl: "Comparison", tAge: "Claim at", tF: "Factor", tM: "Per month", tY: "Per year", tCum: "Total by expected age",
      be: "Break-even ages", vs: "{a} vs {b}", chart: "Cumulative benefits by age", bad: "Age out of range.",
      concl: "If you live past {x}, claiming at {b} beats {a}.",
      method: [
        "full retirement age depends on birth year (66–67 for most people)",
        "claiming early: first 36 months −5/9 % each, further months −5/12 % each",
        "claiming late: +2/3 % per month after FRA, up to age 70",
        "break-even age = (f_b × age_b − f_a × age_a) / (f_b − f_a)",
        "• Ignores cost-of-living adjustments and discounting; spouse and survivor benefits are not modelled. Actual amounts are set by the SSA."
      ]
    },
    zh: {
      title: "美国社安金：几岁开始领",
      subtitle: "提前领、按时领、推迟到 70 岁，每月多少、几岁之后划算。",
      s1: "输入", birth: "出生年份", pia: "完全退休年龄时每月可领", piaHint: "可在 ssa.gov 的账户里查到。",
      cA: "比较年龄 A", cB: "比较年龄 B", cC: "比较年龄 C", life: "预计寿命",
      kFra: "完全退休年龄", ym: "{y} 岁 {m} 个月", tbl: "对比", tAge: "开始领取", tF: "系数", tM: "每月", tY: "每年", tCum: "到预计寿命累计",
      be: "盈亏平衡年龄", vs: "{a} 对 {b}", chart: "累计领取额", bad: "年龄超出范围。",
      concl: "如果你活过 {x} 岁，{b} 岁开始领比 {a} 岁开始领更划算。",
      method: [
        "完全退休年龄由出生年份决定（多数人是 66–67 岁）",
        "提前领：前 36 个月每月 −5/9 %，更早的月份每月 −5/12 %",
        "推迟领：FRA 之后每月 +2/3 %，最多到 70 岁",
        "盈亏平衡年龄 = (f_b × 年龄_b − f_a × 年龄_a) / (f_b − f_a)",
        "• 未考虑生活费调整和折现；配偶与遗属福利未计算。实际金额以 SSA 为准。"
      ]
    }
  };
  var fields = [
    { sec: "s1", id: "birth", type: "num", def: 1965, lbl: "birth" },
    { id: "pia", type: "num", def: 3000, lbl: "pia", hint: "piaHint" },
    { id: "cA", type: "sel", def: "62", lbl: "cA", opts: ages },
    { id: "cB", type: "sel", def: "67", lbl: "cB", opts: ages },
    { id: "cC", type: "sel", def: "70", lbl: "cC", opts: ages },
    { id: "life", type: "num", def: 90, lbl: "life" }
  ];
  var cv = null;
  function render(v, t) {
    if (![v.birth, v.pia, v.life].every(isFinite) || v.birth < 1900 || v.birth > 2100 || v.pia <= 0) return false;
    var fra = E.fraMonths(Math.floor(v.birth));
    var cols = [v.cA, v.cB, v.cC].map(function (x) { var m = Number(x) * 12; return { age: Number(x), m: m, f: E.factor(m, fra) }; });
    var best = 0, tot = cols.map(function (c) { return E.cumulative(v.pia, c.m, fra, v.life); });
    tot.forEach(function (x, i) { if (x > tot[best]) best = i; });
    var fraTxt = t.ym.replace("{y}", Math.floor(fra / 12)).replace("{m}", fra % 12);
    var p1 = [A.kpis([[t.kFra, fraTxt]]), A.table([t.tAge, t.tF, t.tM, t.tY, t.tCum], cols.map(function (c, i) {
      return [String(c.age), fmt(c.f * 100, 1) + "%", fmt(v.pia * c.f), fmt(v.pia * c.f * 12), fmt(tot[i])];
    }), { hl: best })];
    var pairs = [[0, 1], [1, 2], [0, 2]], rows = [];
    pairs.forEach(function (p) {
      var a = cols[p[0]], b = cols[p[1]];
      if (a.age >= b.age) { rows.push([t.vs.replace("{a}", a.age).replace("{b}", b.age), "—"]); return; }
      rows.push([t.vs.replace("{a}", a.age).replace("{b}", b.age), fmt(E.breakeven(a.m, b.m, fra), 1)]);
    });
    p1.push(h("h2", { text: t.be })); p1.push(A.table(["", ""], rows));
    var ordered = cols.slice().sort(function (a, b) { return a.age - b.age; });
    if (ordered[0].age < ordered[ordered.length - 1].age) {
      var a0 = ordered[0], b0 = ordered[ordered.length - 1];
      p1.push(A.note(t.concl.replace("{x}", fmt(E.breakeven(a0.m, b0.m, fra), 1)).replace("{a}", a0.age).replace("{b}", b0.age)));
    }
    p1.push(h("h2", { text: t.chart })); p1.push(A.chartBox("ssChart", cols.map(function (c, i) { return [String(c.age), ["0F5C55", "B8892B", "4F6D8F"][i]]; })));
    cv = { cols: cols, fra: fra, pia: v.pia, life: v.life };
    return [A.panel(null, p1)];
  }
  A.mount({
    I18N: I18N, fields: fields, render: render,
    after: function () {
      var c = document.getElementById("ssChart"); if (!c || !cv) return;
      var xs = [], k; for (k = 62; k <= 100; k++) xs.push(k);
      A.drawLines(c, cv.cols.map(function (col, i) { return { color: ["#0F5C55", "#B8892B", "#4F6D8F"][i], pts: xs.map(function (a) { return E.cumulative(cv.pia, col.m, cv.fra, a); }) }; }),
        { xs: xs.map(String), fmtY: function (x) { return fmt(x / 1000, 0) + "k"; }, hlines: [] });
    }
  });
})();
