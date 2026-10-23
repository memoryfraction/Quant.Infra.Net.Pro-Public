// Stress windows: pure arithmetic on real bear-market index moves (see allocation/regime.js).
module.exports = function (t) {
  const R = require("../allocation/regime.js");
  const inv = 1000000;

  t.eq(R.WINDOWS.length, 4, "regime: four bear-market windows");
  t.eq(R.WINDOWS.map((w) => w.id).join(","), "y2000,y2007,y2020,y2022", "regime: windows 2000 / 2007 / 2020 / 2022");
  R.WINDOWS.forEach((w) => {
    t.ok(w.spxDrop < 0 && w.spxDrop > -1, "regime: " + w.id + " S&P drop is a loss");
    t.ok(w.ndxDrop < 0 && w.ndxDrop > -1, "regime: " + w.id + " Nasdaq drop is a loss");
    t.ok(w.label.en && w.label.zh && w.period, "regime: " + w.id + " has labels and period");
  });
  t.ok(R.DATA_SOURCES.length >= 2 && R.DATA_SOURCES.every((u) => /^https:\/\//.test(u)), "regime: at least two https data sources recorded");

  // 100% cash never loses
  R.WINDOWS.forEach((w) => {
    t.eq(R.simulate({ base: 0, lev: 0, cash: 1 }, inv, w.spxDrop).amount, 0, "regime: cash-only loses nothing (" + w.id + ")");
  });
  // 100% base = investable x drop
  R.WINDOWS.forEach((w) => {
    t.close(R.simulate({ base: 1, lev: 0, cash: 0 }, inv, w.spxDrop).amount, inv * w.spxDrop, 1e-6, "regime: base-only follows the S&P (" + w.id + ")");
    t.close(R.simulate({ base: 1, lev: 0, cash: 0 }, inv, w.ndxDrop).amount, inv * w.ndxDrop, 1e-6, "regime: base-only follows the Nasdaq (" + w.id + ")");
  });
  // 2x leg: twice the move, but never below -100%
  t.close(R.simulate({ base: 0, lev: 1, cash: 0 }, inv, -0.25).rate, -0.5, 1e-12, "regime: 2x leg doubles a 25% fall");
  t.close(R.simulate({ base: 0, lev: 1, cash: 0 }, inv, -0.83).rate, -1, 1e-12, "regime: 2x leg floors at -100%");
  // 433 against the S&P 2007-09 window, by hand: 0.4*-0.568 + 0.3*-1 (2x floors? -1.136 -> -1)
  const w433 = { base: 0.4, lev: 0.3, cash: 0.3 };
  t.close(R.simulate(w433, inv, -0.568).rate, 0.4 * -0.568 + 0.3 * -1, 1e-12, "regime: 433 in 2007-09 hand check");

  // worst() picks the largest loss
  const wst = R.worst(w433, inv, "ndx");
  t.eq(wst.window.id, "y2000", "regime: worst Nasdaq window for 433 is the dot-com bust");
  const all = R.WINDOWS.map((w) => R.simulate(w433, inv, w.ndxDrop).rate);
  t.close(wst.rate, Math.min.apply(null, all), 1e-12, "regime: worst() is the minimum rate");
  t.eq(R.worst({ base: 0, lev: 0, cash: 1 }, inv, "spx").rate, 0, "regime: worst() of cash is zero");
  t.ok(R.worst(w433, inv, "spx").amount < 0, "regime: worst() amount is negative");
};
