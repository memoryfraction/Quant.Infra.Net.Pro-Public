// Golden values cross-checked against an independent Python reference.
module.exports = function (t) {
  const E = require("../fi/engine.js");
  t.close(E.inflationFactor(0.04, 25), 2.665836, 1e-5)
  const ta = E.targetAssets({expenseNow:100000, inflation:0.04, years:25, replaceRatio:0.8, rentNow:30000, otherPassiveFuture:40000, swr:0.04});
  t.close(ta.F, 2332295.41, 0.5)
  // 书里把通胀因子取整成 2.7，算出约 238 万；我们用精确值，约 233 万
  const gp = E.gap({F: ta.F, current:100000, r:0.10, years:25});
  t.close(gp.D, 1248824.82, 0.5)
  t.close(E.accumMultiple(0.10, 25), 109.1818, 1e-3)
  t.close(E.accumMultiple(0.10, 40), 487.9, 0.1)
  t.close(E.accumMultiple(0.15, 25), 245.7, 0.1)
  t.close(E.accumMultiple(0.10, 10), 18.5, 0.1)
  t.close(E.accumMultiple(0.10, 5), 7.7, 0.1)
  t.eq(E.accumMultiple(0, 9), 10)
  t.close(E.yearlyNeeded({D: gp.D, r:0.10, years:25}), 11438.03, 0.05)
  t.eq(E.yearlyNeeded({D: -5, r:0.10, years:25}), 0)
  const now = E.targetAssets({expenseNow:100000, inflation:0.03, years:0, replaceRatio:1, rentNow:30000, otherPassiveFuture:0, swr:0.04});
  t.close(now.F, 1750000, 1e-6)
  t.close(E.yearsToFI({s:0.5, g:0.05, w:0.04, a0:0}).years, 16.62, 0.01)
  t.close(E.yearsToFI({s:0.1, g:0.05, w:0.04, a0:0}).years, 51.35, 0.01)
  t.close(E.yearsToFI({s:0.2, g:0.05, w:0.04, a0:0}).years, 36.72, 0.01)
  t.close(E.yearsToFI({s:0.8, g:0.05, w:0.04, a0:0}).years, 5.57, 0.01)
  t.close(E.yearsToFI({s:0.5, g:0.02, w:0.04, a0:0}).years, 20.48, 0.01)
  t.close(E.yearsToFI({s:0.5, g:0.07, w:0.04, a0:0}).years, 14.95, 0.01)
  t.close(E.yearsToFI({s:0.5, g:0.05, w:0.04, a0:5}).years, 8.31, 0.01)
  t.close(E.yearsToFI({s:0.5, g:0, w:0.04, a0:0}).years, 25, 1e-9)
  t.eq(E.yearsToFI({s:0, g:0.05, w:0.04, a0:0}).ok, false)
  t.eq(E.yearsToFI({s:0.5, g:0.05, w:0.04, a0:20}).years, 0)
  t.close(E.rule72(0.10), 7.2, 1e-9)
  t.close(E.bookSafeRate(0.10, 0.03), 0.07, 1e-12)
  t.eq(E.targetAssets({expenseNow:0, inflation:0.03, years:10, replaceRatio:0.8, rentNow:0, otherPassiveFuture:0, swr:0.04}).ok, false)
  
};
