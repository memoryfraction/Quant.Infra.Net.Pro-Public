// Golden values cross-checked against an independent Python reference.
module.exports = function (t) {
  const R = require("../rebalance/engine.js"); const A = require("../allocation/engine.js"); const T433 = A.PRESETS["433"];
  let y = R.yearType(100, 135, 5); t.eq(y.type, "up"); t.close(y.pureGain, 30, 1e-9)
  t.eq(R.yearType(100, 105, 5).type, "flat")
  let s = R.smart({p:{base:400, lev:135, cash:300}, levStart:100, levNew:5, lockRatio:0.3, downRate:0.02, pledged:true, initialTotal:1000});
  t.eq(s.type, "up"); t.close(s.action.amount, 9, 1e-9); t.close(s.after.lev, 126, 1e-9); t.close(s.after.cash, 309, 1e-9); t.close(s.after.base, 400, 1e-9)
  s = R.smart({p:{base:360, lev:220, cash:300}, levStart:300, levNew:0, lockRatio:0.3, downRate:0.02, pledged:true, initialTotal:1000});
  t.eq(s.type, "down"); t.close(s.action.amount, 20, 1e-9); t.close(s.after.lev, 240, 1e-9); t.close(s.after.cash, 280, 1e-9)
  s = R.smart({p:{base:360, lev:220, cash:300}, levStart:300, levNew:0, lockRatio:0.3, downRate:0.02, pledged:false, initialTotal:0});
  t.close(s.action.amount, 17.6, 1e-9)
  s = R.smart({p:{base:360, lev:220, cash:10}, levStart:300, levNew:0, lockRatio:0.3, downRate:0.02, pledged:true, initialTotal:1000});
  t.close(s.action.amount, 10, 1e-9); t.ok(s.flags.indexOf("cash_short") >= 0)
  t.eq(R.smart({p:{base:1, lev:1, cash:1}, levStart:1, levNew:0, lockRatio:1.5, downRate:0.02, pledged:false}).ok, false)
  let m = R.mindless({base:44, lev:38, cash:30}, T433); t.close(m.after.lev, 34, 1e-9); t.close(m.after.cash, 34, 1e-9); t.close(m.beta, 1.0, 1e-9)
  m = R.mindless({base:36, lev:22, cash:30}, T433); t.close(m.after.lev, 26, 1e-9); t.close(m.after.cash, 26, 1e-9)
  let L = R.lumpSum({base:40, lev:30, cash:30}, 100, T433); t.close(L.buys.base, 40, 1e-9); t.close(L.buys.lev, 30, 1e-9); t.close(L.buys.cash, 30, 1e-9)
  L = R.lumpSum({base:60, lev:30, cash:10}, 20, T433); t.close(L.buys.base, 0, 1e-9); t.close(L.buys.lev, 3.75, 1e-9); t.close(L.buys.cash, 16.25, 1e-9)
  t.close(L.after.lev, 33.75, 1e-9)
  
};
