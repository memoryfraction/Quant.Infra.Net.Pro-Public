// Golden values cross-checked against an independent Python reference.
module.exports = function (t) {
  const W = require("../withdrawal/engine.js");
  let l = W.ladder({assets:5000000, expense:100000}); t.close(l.multiple, 50, 1e-9); t.close(l.rate, 0.02, 1e-12); t.eq(l.tier, "perpetual"); t.eq(l.toNext, 0)
  l = W.ladder({assets:3400000, expense:100000}); t.eq(l.tier, "solid"); t.close(l.toNext, 1600000, 1e-6)
  l = W.ladder({assets:2500000, expense:100000}); t.eq(l.tier, "edge")
  l = W.ladder({assets:2000000, expense:100000}); t.eq(l.tier, "rescue"); t.close(l.toNext, 500000, 1e-6)
  l = W.ladder({assets:1000000, expense:100000}); t.eq(l.tier, "critical"); t.close(l.toNext, 500000, 1e-6)
  t.eq(W.ladder({assets:0, expense:1}).ok, false)
  t.eq(W.cashRule(0.03, true), "433"); t.eq(W.cashRule(0.04, true), "514"); t.eq(W.cashRule(0.05, true), "505"); t.eq(W.cashRule(0.06, true), "qqqi")
  t.eq(W.cashRule(0.02, false), "80/20"); t.eq(W.cashRule(0.03, false), "65/35"); t.eq(W.cashRule(0.04, false), "50/50"); t.eq(W.cashRule(0.041, false), "qqqi")
  t.eq(W.cashRule(1/100*3, true), "433")
  let q = W.qqqiRescue({assets:1000000, expense:70000, yieldRate:0.10, coreRatio:0.70});
  t.close(q.qqqi, 700000, 1e-6); t.close(q.core, 210000, 1e-6); t.close(q.cash, 90000, 1e-6); t.eq(q.flags.length, 0)
  q = W.qqqiRescue({assets:500000, expense:70000, yieldRate:0.10, coreRatio:0.70});
  t.close(q.qqqi, 500000, 1e-6); t.ok(q.flags.indexOf("yield_cannot_cover") >= 0)
  const tf = W.tenPlusFive({expense:100000, yieldRate:0.10}); t.eq(tf.qqqi, 1000000); t.close(tf.core, 350000, 1e-6); t.close(tf.cash, 150000, 1e-6); t.close(tf.coverage, 1, 1e-12)
  t.close(W.bookSafeRate(0.10, 0.03), 0.07, 1e-12)
  const sd = W.sequenceDemo({start:100, withdraw:4, returns:[-0.3,-0.2,0.1,0.2,0.3]});
  t.close(sd.forward[4], 68.45696, 1e-6); t.close(sd.reversed[4], 81.79136, 1e-6); t.close(sd.forward[0], 67.2, 1e-9)
  const sd0 = W.sequenceDemo({start:100, withdraw:0, returns:[-0.3,-0.2,0.1,0.2,0.3]});
  t.close(sd0.forward[4], sd0.reversed[4], 1e-9)
  
};
