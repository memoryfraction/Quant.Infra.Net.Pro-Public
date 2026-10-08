// Pure calculation functions (no DOM). Works in browsers (window.MarginEngine) and Node (require).
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.MarginEngine = api;
})(typeof self !== "undefined" ? self : this, function (root) {
  const ratioAfterDrop = (l, d) => (1 - d) / l, dropToHit = (l, T) => 1 - T * l;
  const status = (r, th) => r >= th.renew ? "safe" : r >= th.warn ? "no_renew" : r >= th.call ? "alert" : "call";
  const rating = d => d < .3 ? "very_high" : d < .4 ? "high" : d < .55 ? "medium" : d < .7 ? "low" : d < .8 ? "safe" : "very_safe";
  const ltvTable = (ls, th) => ls.map(ltv => { const dCall = dropToHit(ltv, th.call); return { ltv, init: 1 / ltv, dRenew: dropToHit(ltv, th.renew), dWarn: dropToHit(ltv, th.warn), dCall, rating: rating(dCall) }; });
  const dropGrid = (ls, ds, th) => ls.map(l => ds.map(d => { const r = ratioAfterDrop(l, d); return { ratio: r, status: status(r, th) }; }));
  function current({ collateral, loan, th }) {
    if (loan === 0) return { ok: true, ratio: null, status: "no_loan" };
    const ratio = collateral / loan, ltv = loan / collateral;
    return { ok: true, ratio, ltv, status: status(ratio, th), dRenew: dropToHit(ltv, th.renew), dWarn: dropToHit(ltv, th.warn), dCall: dropToHit(ltv, th.call), addCollateral: Math.max(0, th.renew * loan - collateral), repay: Math.max(0, loan - collateral / th.renew) };
  }
  const cashMultiple = ({ rate = .05, years = 10, maxLtv = .6, growth = .02 }) => Math.pow(1 + rate, years) / maxLtv / Math.pow(1 + growth, years);
  function project({ C0, drawRate, i, g, years, th }) {
    const D = C0 * drawRate; let L = 0; const rows = [], first = { renew: null, warn: null, call: null };
    for (let n = 1; n <= years; n++) {
      L = L * (1 + i) + D; const C = C0 * Math.pow(1 + g, n), r = C / L;
      rows.push({ year: n, loan: L, collateral: C, ratio: r, status: status(r, th) });
      for (const k of ["renew", "warn", "call"]) if (first[k] === null && r < th[k]) first[k] = n;
    }
    return { rows, first };
  }
  return { ratioAfterDrop, dropToHit, status, rating, ltvTable, dropGrid, current, cashMultiple, project };
});
