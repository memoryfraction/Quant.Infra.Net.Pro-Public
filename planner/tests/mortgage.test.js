// Golden values cross-checked against an independent Python reference.
module.exports = function (t) {
  const H = require("../mortgage/engine.js");
  t.close(H.afterTaxRate(0.04, 0.35), 0.026, 1e-12); t.close(H.realRate(0.04, 0.35, 0.03), -0.004, 1e-12)
  let y = H.yearlyExtra({X:1, Y:30, r:0.10, i:0.04, t:0});
  t.close(y.invest, 180.943, 1e-3); t.close(y.prepay, 58.328, 1e-3); t.close(y.diff, 122.615, 1e-3); t.close(y.spreadApprox, 83.802, 1e-3)
  y = H.yearlyExtra({X:1, Y:30, r:0.10, i:0.04, t:0.35});
  t.close(y.prepay, 45.77, 0.01); t.close(y.diff, 135.17, 0.01)
  t.close(H.fvDue(5, 0, 4), 20, 1e-12)
  let L = H.lumpSum({P:1, Y:30, r:0.10, i:0.04, t:0.35, cg:0});
  t.close(L.B, 13.172558, 1e-6); t.close(L.advantage, 12.172558, 1e-6); t.close(L.bookApprox, 7.513898, 1e-6)
  L = H.lumpSum({P:1, Y:30, r:0.10, i:0.04, t:0.35, cg:0.15}); t.close(L.advantage, 10.346674, 1e-6)
  t.close(H.houseROI({R:0.065, D:0.04, N:4}), 0.165, 1e-12); t.close(H.houseROI({R:0.09, D:0.05, N:4}), 0.25, 1e-12)
  t.close(H.leverageFromDown(0.2), 4, 1e-12)
  
};
