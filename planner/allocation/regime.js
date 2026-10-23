/*
 * planner/allocation/regime.js — stress windows for the 433-style mixes.
 *
 * Each window is a real bear market measured on index CLOSING PRICES, peak to trough
 * (price return, dividends not reinvested). Index levels are not the same as what an
 * investor feels, so treat the result as an order of magnitude, not a forecast.
 *
 * Sources, checked against each other when this file was written:
 *   S&P 500   2000-03 -> 2002-10  -49.1%   2007-10 -> 2009-03  -56.8%
 *             2020-02 -> 2020-03  -33.9%   2022-01 -> 2022-10  -25.4%
 *   Nasdaq-100 (peak/trough dates differ slightly from the S&P):
 *             2000-03 -> 2002-10  -83.0%   2020-02 -> 2020-03  -28.6%
 *             2021-11 -> 2022-12  -35.6%   (https://shibui.finance/nasdaq-100-drawdown-history)
 *             2007-10 -> 2009-03  about -54%  (approximate: NOT yet confirmed by a second source)
 *
 * A 2x leveraged ETF is approximated as twice the index move, floored at -100%. Real 2x funds
 * reset daily and usually lose MORE in a long, choppy fall, so the figures are a floor.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AllocRegime = factory();
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  var DATA_SOURCES = [
    "https://dqydj.com/sp-500-drawdown-history/",
    "https://shibui.finance/nasdaq-100-drawdown-history"
  ];

  var WINDOWS = [
    { id: "y2000", label: { en: "2000–02 dot-com bust", zh: "2000–02 互联网泡沫" }, period: "2000-03 → 2002-10", spxDrop: -0.491, ndxDrop: -0.830, ndxApprox: false },
    { id: "y2007", label: { en: "2007–09 financial crisis", zh: "2007–09 金融危机" }, period: "2007-10 → 2009-03", spxDrop: -0.568, ndxDrop: -0.540, ndxApprox: true },
    { id: "y2020", label: { en: "2020 COVID crash", zh: "2020 新冠暴跌" }, period: "2020-02 → 2020-03", spxDrop: -0.339, ndxDrop: -0.286, ndxApprox: false },
    { id: "y2022", label: { en: "2022 rate-hike bear market", zh: "2022 加息熊市" }, period: "2022-01 → 2022-10", spxDrop: -0.254, ndxDrop: -0.356, ndxApprox: false }
  ];

  // Loss of a base / 2x / cash mix over one window; `drop` is the index move (negative).
  function simulate(w, investable, drop) {
    var rate = w.base * drop + w.lev * Math.max(2 * drop, -1);
    return { rate: rate, amount: investable * rate };
  }

  // The window that hurts most. series: "spx" | "ndx".
  function worst(w, investable, series) {
    var best = null;
    WINDOWS.forEach(function (win) {
      var s = simulate(w, investable, series === "ndx" ? win.ndxDrop : win.spxDrop);
      if (!best || s.rate < best.rate) best = { window: win, rate: s.rate, amount: s.amount };
    });
    return best;
  }

  return { WINDOWS: WINDOWS, DATA_SOURCES: DATA_SOURCES, simulate: simulate, worst: worst };
});
