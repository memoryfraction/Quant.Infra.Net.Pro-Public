// Pure calculation functions (no DOM). Works in browsers (window.RebalEngine) and Node (require).
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.RebalEngine = api;
})(typeof self !== "undefined" ? self : this, function (root) {
  const A = root.AllocEngine || require("../allocation/engine.js");
  const yearType = (s, e, n) => { const g = e - s - n; return { pureGain: g, type: Math.abs(g) < 1e-9 ? "flat" : g > 0 ? "up" : "down" }; };
  const wts = a => { const T = a.base + a.lev + a.cash; return { base: a.base / T, lev: a.lev / T, cash: a.cash / T }; };
  function smart({ p, levStart, levNew, lockRatio = .3, downRate = .02, pledged, initialTotal }) {
    if (!(lockRatio >= 0 && lockRatio <= 1 && downRate >= 0 && downRate <= .2) || (pledged && !(initialTotal > 0))) return { ok: false, error: "invalid" };
    const y = yearType(levStart, p.lev, levNew), after = Object.assign({}, p), flags = []; let action = null, basis;
    const total = p.base + p.lev + p.cash;
    if (y.type === "up") { const a = Math.min(p.lev, lockRatio * y.pureGain); after.lev -= a; after.cash += a; action = { from: "lev", to: "cash", amount: a }; }
    else if (y.type === "down") { basis = pledged ? initialTotal : total; const want = downRate * basis, a = Math.min(want, p.cash); after.lev += a; after.cash -= a; action = { from: "cash", to: "lev", amount: a }; if (a < want) flags.push("cash_short"); }
    const w = wts(after); return { ok: true, type: y.type, pureGain: y.pureGain, basis, action, after, weights: w, beta: A.beta(w), flags };
  }
  function mindless(p, t) { const k = p.lev + p.cash, s = (t.lev + t.cash) ? t.lev / (t.lev + t.cash) : 0, after = { base: p.base, lev: k * s, cash: k * (1 - s) }, w = wts(after); return { after, weights: w, beta: A.beta(w) }; }
  function lumpSum(p, m, t) {
    const T = p.base + p.lev + p.cash + m, ks = ["base", "lev", "cash"], need = {};
    ks.forEach(k => need[k] = t[k] * T - p[k]);
    if (ks.some(k => need[k] < 0)) { ks.forEach(k => need[k] = Math.max(0, need[k])); const s = ks.reduce((a, k) => a + need[k], 0); ks.forEach(k => need[k] = s ? need[k] * m / s : 0); }
    const after = {}; ks.forEach(k => after[k] = p[k] + need[k]); const w = wts(after); return { buys: need, after, weights: w, beta: A.beta(w) };
  }
  return { yearType, smart, mindless, lumpSum };
});
