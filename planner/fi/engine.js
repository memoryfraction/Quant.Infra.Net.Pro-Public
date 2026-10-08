// Pure calculation functions (no DOM). Works in browsers (window.FIEngine) and Node (require).
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.FIEngine = api;
})(typeof self !== "undefined" ? self : this, function (root) {
  const inflationFactor = (pi, n) => Math.pow(1 + pi, n);
  const accumMultiple = (r, n) => r === 0 ? n + 1 : (Math.pow(1 + r, n + 1) - 1) / r;
  function targetAssets(o) {
    const { expenseNow, inflation, years, replaceRatio, rentNow, otherPassiveFuture, swr } = o;
    if (!(expenseNow > 0 && swr > 0 && years >= 0 && replaceRatio > 0 && replaceRatio <= 1.5 && rentNow >= 0 && otherPassiveFuture >= 0 && inflation >= 0)) return { ok: false, error: "invalid" };
    const inf = inflationFactor(inflation, years), fe = expenseNow * inf * replaceRatio, fr = rentNow * inf, need = fe - fr - otherPassiveFuture;
    return { ok: true, inf, futureExpense: fe, futureRent: fr, need, F: Math.max(0, need / swr) };
  }
  const gap = ({ F, current, r, years }) => { const grown = current * Math.pow(1 + r, years); return { ok: true, grown, D: F - grown }; };
  const yearlyNeeded = ({ D, r, years }) => D <= 0 ? 0 : D / accumMultiple(r, years);
  function yearsToFI({ s, g, w, a0 = 0 }) {
    if (s <= 0) return { ok: false, error: "no_savings" };
    if (s >= 1) return { ok: false, error: "invalid" };
    const T = (1 - s) / w;
    if (a0 >= T) return { ok: true, years: 0 };
    const y = g === 0 ? (T - a0) / s : Math.log((T + s / g) / (a0 + s / g)) / Math.log(1 + g);
    return y > 100 ? { ok: true, years: null, capped: true } : { ok: true, years: y };
  }
  return { inflationFactor, accumMultiple, targetAssets, gap, yearlyNeeded, yearsToFI, rule72: r => r <= 0 ? null : 72 / (r * 100), bookSafeRate: (a, b) => a - b };
});
