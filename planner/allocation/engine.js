// Pure calculation functions (no DOM). Works in browsers (window.AllocEngine) and Node (require).
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.AllocEngine = api;
})(typeof self !== "undefined" ? self : this, function (root) {
  const PRESETS = { "703": { base: .7, lev: 0, cash: .3 }, "802": { base: .8, lev: 0, cash: .2 }, "613": { base: .6, lev: .1, cash: .3 }, "433": { base: .4, lev: .3, cash: .3 }, "442": { base: .4, lev: .4, cash: .2 }, "514": { base: .5, lev: .1, cash: .4 }, "424": { base: .4, lev: .2, cash: .4 }, "415": { base: .4, lev: .1, cash: .5 }, "505": { base: .5, lev: 0, cash: .5 }, "226": { base: .2, lev: .2, cash: .6 } };
  const beta = w => w.base + 2 * w.lev;
  function cashFloor({ assets, annualExpense, ratio = .3 }) {
    if (assets < 0 || !(annualExpense > 0)) return { ok: false, error: "invalid" };
    const floor = Math.min(assets, Math.max(annualExpense, ratio * assets));
    return { ok: true, floor, investable: assets - floor, beginner: assets < 3 * annualExpense };
  }
  function checkRules({ w, age, salaried, withdrawing, pledge }) {
    if (Math.abs(w.base + w.lev + w.cash - 1) > .001) return [{ code: "sum", level: "bad" }];
    const y = age < 30 && salaried && !withdrawing, out = [], b = beta(w);
    if (w.lev > w.base + 1e-9) out.push({ code: "lev_gt_base", level: "bad" });
    if (w.lev > w.cash + 1e-9 && !y) out.push({ code: "lev_gt_cash", level: "bad" });
    if (w.cash < .2) out.push({ code: "cash_low", level: "bad" }); else if (w.cash < .3 && !y) out.push({ code: "cash_low", level: "warn" });
    if (w.lev > 0 && withdrawing && !pledge) out.push({ code: "lev_no_pledge", level: "bad" });
    if (b > 1 + 1e-9 && age >= 30) out.push({ code: "beta_age", level: "warn" });
    if (b > 1.2 + 1e-9) out.push({ code: "beta_high", level: "bad" });
    return out.length ? out : [{ code: "all_good", level: "good" }];
  }
  function suggest({ age, salaried, withdrawing, pledge, novice }) {
    if (novice) return "703"; if (withdrawing && age >= 70) return "505"; if (withdrawing && !pledge) return "703";
    if (withdrawing && pledge) return "433"; if (!withdrawing && age < 30 && salaried) return "442"; return "433";
  }
  function exposure(o) {
    const mkt = o.stock1x + 2 * o.stock2x + 3 * o.stock3x, TA = o.house + o.stock1x + o.stock2x + o.stock3x + o.cash;
    const NW = TA - (o.mortSelf + o.mortInvest + o.creditLoan), liq = o.stock1x + o.stock2x + o.stock3x + o.cash;
    const LNW = liq - (o.mortInvest + o.creditLoan), hyp = Math.max(0, o.creditLineTotal - o.creditLineUsed);
    const d = (a, b) => b > 0 ? a / b : null, cs = d(o.cash, liq), flags = [];
    if (cs !== null && cs < .3) flags.push("cash_share_low"); if (NW <= 0) flags.push("negative_nw");
    return { liqBeta: d(mkt, liq), nwBeta: d(mkt, NW), lnwLev: d(mkt, LNW), hypBeta: d(mkt, NW + hyp), bookLev: d(TA, NW), expLev: d(o.house + mkt, NW), cashShare: cs, flags };
  }
  return { PRESETS, beta, cashFloor, checkRules, suggest, exposure };
});
