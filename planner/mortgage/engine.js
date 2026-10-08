// Pure calculation functions (no DOM). Works in browsers (window.MortEngine) and Node (require).
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.MortEngine = api;
})(typeof self !== "undefined" ? self : this, function (root) {
  const afterTaxRate = (i, t) => i * (1 - t), realRate = (i, t, pi) => i * (1 - t) - pi;
  const fvDue = (X, r, Y) => r === 0 ? X * Y : X * (Math.pow(1 + r, Y) - 1) / r * (1 + r);
  const yearlyExtra = ({ X, Y, r, i, t }) => { const inv = fvDue(X, r, Y), pp = fvDue(X, afterTaxRate(i, t), Y); return { invest: inv, prepay: pp, diff: inv - pp, spreadApprox: fvDue(X, r - i, Y) }; };
  function lumpSum({ P, Y, r, i, t, cg = 0 }) { const ie = afterTaxRate(i, t), B = r === 0 ? P - P * ie * Y : P * Math.pow(1 + r, Y) - P * ie * (Math.pow(1 + r, Y) - 1) / r, tax = Math.max(0, B - P) * cg; return { B, advantage: B - P - tax, tax, bookApprox: P * Math.pow(1 + r - ie, Y) - P }; }
  return { afterTaxRate, realRate, fvDue, yearlyExtra, lumpSum, houseROI: ({ R, D, N }) => R + (R - D) * N, leverageFromDown: dp => (1 - dp) / dp };
});
