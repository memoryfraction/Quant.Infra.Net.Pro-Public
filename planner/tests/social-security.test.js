// Golden values cross-checked against an independent Python reference.
module.exports = function (t) {
  const S = require("../social-security/engine.js"); const F67 = 67*12;
  t.eq(S.fraMonths(1965), 804); t.eq(S.fraMonths(1957), 798); t.eq(S.fraMonths(1950), 792); t.eq(S.fraMonths(1937), 780)
  t.close(S.factor(62*12, F67), 0.70, 1e-12); t.close(S.factor(63*12, F67), 0.75, 1e-12); t.close(S.factor(64*12, F67), 0.80, 1e-12)
  t.close(S.factor(65*12, F67), 0.866667, 1e-6); t.close(S.factor(66*12, F67), 0.933333, 1e-6); t.close(S.factor(67*12, F67), 1.0, 1e-12)
  t.close(S.factor(68*12, F67), 1.08, 1e-12); t.close(S.factor(70*12, F67), 1.24, 1e-12)
  t.close(S.factor(62*12, 798), 0.725, 1e-12); t.close(S.factor(70*12, 798), 1.28, 1e-12); t.close(S.factor(70*12, 792), 1.32, 1e-12)
  t.eq(S.factor(61*12, F67).ok, false); t.eq(S.factor(71*12, F67).ok, false)
  t.close(S.annual(3000, 62*12, F67), 25200, 1e-6); t.close(S.annual(3000, 70*12, F67), 44640, 1e-6)
  t.close(S.breakeven(62*12, 67*12, F67), 78.6667, 1e-4); t.close(S.breakeven(67*12, 70*12, F67), 82.5, 1e-9); t.close(S.breakeven(62*12, 70*12, F67), 80.3704, 1e-4)
  t.eq(S.cumulative(3000, 67*12, F67, 66), 0); t.close(S.cumulative(3000, 67*12, F67, 82.5), 3000*186, 1e-6)
  
};
