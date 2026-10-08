// Pure calculation functions (no DOM). Works in browsers (window.SSEngine) and Node (require).
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SSEngine = api;
})(typeof self !== "undefined" ? self : this, function (root) {
  function fraMonths(y) { if (y <= 1937) return 780; if (y <= 1942) return 780 + 2 * (y - 1937); if (y <= 1954) return 792; if (y <= 1959) return 792 + 2 * (y - 1954); return 804; }
  function factor(c, f) { if (c < 744 || c > 840) return { ok: false, error: "range" }; const m = c - f; if (m < 0) { const k = -m; return 1 - (Math.min(k, 36) * 5 / 9 + Math.max(0, k - 36) * 5 / 12) / 100; } return 1 + Math.min(m, 840 - f) * (2 / 3) / 100; }
  const annual = (p, c, f) => p * factor(c, f) * 12;
  const breakeven = (a, b, f) => { const fa = factor(a, f), fb = factor(b, f); return (fb * b - fa * a) / (fb - fa) / 12; };
  const cumulative = (p, c, f, age) => age * 12 <= c ? 0 : p * factor(c, f) * (age * 12 - c);
  return { fraMonths, factor, annual, breakeven, cumulative };
});
