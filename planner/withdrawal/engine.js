// Pure calculation functions (no DOM). Works in browsers (window.WdEngine) and Node (require).
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.WdEngine = api;
})(typeof self !== "undefined" ? self : this, function (root) {
  function ladder({ assets, expense }) {
    if (!(assets > 0 && expense > 0)) return { ok: false, error: "invalid" };
    const m = assets / expense, tier = m >= 50 ? "perpetual" : m >= 100 / 3 ? "solid" : m >= 25 ? "edge" : m >= 15 ? "rescue" : "critical";
    const next = { critical: 15, rescue: 25, edge: 100 / 3, solid: 50 }[tier];
    return { ok: true, multiple: m, rate: expense / assets, tier, toNext: next ? next * expense - assets : 0 };
  }
  function cashRule(r, lev) { const e = 1e-12; if (lev) return r <= .03 + e ? "433" : r <= .04 + e ? "514" : r <= .05 + e ? "505" : "qqqi"; return r <= .02 + e ? "80/20" : r <= .03 + e ? "65/35" : r <= .04 + e ? "50/50" : "qqqi"; }
  function qqqiRescue({ assets, expense, yieldRate = .1, coreRatio = .7 }) { const need = expense / yieldRate, q = Math.min(assets, need), rest = assets - q, core = rest * coreRatio; return { qqqi: q, rest, core, cash: rest - core, flags: need > assets ? ["yield_cannot_cover"] : [] }; }
  const tenPlusFive = ({ expense, yieldRate = .1 }) => ({ qqqi: 10 * expense, core: 5 * expense * .7, cash: 5 * expense * .3, total: 15 * expense, coverage: 10 * expense * yieldRate / expense });
  function sequenceDemo({ start, withdraw, returns }) { const run = rs => { let B = start; return rs.map(r => { B = Math.max(0, B - withdraw) * (1 + r); return B; }); }; return { forward: run(returns), reversed: run(returns.slice().reverse()) }; }
  return { ladder, cashRule, qqqiRescue, tenPlusFive, bookSafeRate: (a, b) => a - b, sequenceDemo };
});
