/*
 * planner/allocation/regime.js — stress windows for the 433-style mixes.
 *
 * Each window is a real bear market measured on index CLOSING PRICES, peak to trough
 * (price return, dividends not reinvested). Index levels are not the same as what an
 * investor feels, so treat the result as an order of magnitude, not a forecast.
 *
 * Computed from daily closes (Yahoo Finance via yfinance: ^GSPC and ^NDX), peak to trough
 * inside each episode, and cross-checked against published drawdown tables:
 *   S&P 500    2000-03-24 -> 2002-10-09  -49.15%   2007-10-09 -> 2009-03-09  -56.78%
 *              2020-02-19 -> 2020-03-23  -33.92%   2022-01-03 -> 2022-10-12  -25.43%
 *   Nasdaq-100 2000-03-27 -> 2002-10-07  -82.90%   2007-10-31 -> 2008-11-20  -53.71%
 *              2020-02-19 -> 2020-03-20  -28.03%   2021-11-19 -> 2022-12-28  -35.56%
 * (shibui.finance lists -83.0% / -28.6% / -35.6% for the Nasdaq-100 in 2000 / 2020 / 2022; the
 * 2020 gap is only a different trough close, 3/16 vs 3/20.) The table shows the S&P dates; the
 * Nasdaq-100 peak and trough days differ by a few weeks in some episodes.
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
    "https://finance.yahoo.com/quote/%5EGSPC/history/",
    "https://finance.yahoo.com/quote/%5ENDX/history/",
    "https://dqydj.com/sp-500-drawdown-history/",
    "https://shibui.finance/nasdaq-100-drawdown-history"
  ];

  var WINDOWS = [
    { id: "y2000", label: { en: "2000–02 dot-com bust", zh: "2000–02 互联网泡沫" }, period: "2000-03 → 2002-10", spxDrop: -0.4915, ndxDrop: -0.8290, ndxApprox: false },
    { id: "y2007", label: { en: "2007–09 financial crisis", zh: "2007–09 金融危机" }, period: "2007-10 → 2009-03", spxDrop: -0.5678, ndxDrop: -0.5371, ndxApprox: false },
    { id: "y2020", label: { en: "2020 COVID crash", zh: "2020 新冠暴跌" }, period: "2020-02 → 2020-03", spxDrop: -0.3392, ndxDrop: -0.2803, ndxApprox: false },
    { id: "y2022", label: { en: "2022 rate-hike bear market", zh: "2022 加息熊市" }, period: "2022-01 → 2022-10", spxDrop: -0.2543, ndxDrop: -0.3556, ndxApprox: false }
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
