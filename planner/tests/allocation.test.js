// Golden values cross-checked against an independent Python reference.
module.exports = function (t) {
  const A = require("../allocation/engine.js");
  t.close(A.beta(A.PRESETS["433"]), 1.0, 1e-12)
  t.close(A.beta(A.PRESETS["442"]), 1.2, 1e-12)
  t.close(A.beta(A.PRESETS["703"]), 0.7, 1e-12)
  t.close(A.beta(A.PRESETS["514"]), 0.7, 1e-12)
  t.close(A.beta(A.PRESETS["505"]), 0.5, 1e-12)
  t.close(A.beta(A.PRESETS["226"]), 0.6, 1e-12)
  t.close(A.beta({base:.7, lev:.2, cash:.1}), 1.1, 1e-12)
  let c = A.cashFloor({assets:160000, annualExpense:100000}); t.eq(c.floor, 100000); t.eq(c.investable, 60000); t.eq(c.beginner, true)
  c = A.cashFloor({assets:500000, annualExpense:100000}); t.close(c.floor, 150000, 1e-6); t.close(c.investable, 350000, 1e-6); t.eq(c.beginner, false)
  c = A.cashFloor({assets:50000, annualExpense:100000}); t.eq(c.floor, 50000); t.eq(c.investable, 0)
  const codes = r => r.map(x => x.code).sort().join(",");
  t.eq(codes(A.checkRules({w:A.PRESETS["433"], age:40, salaried:true, withdrawing:false, pledge:false})), "all_good")
  t.eq(codes(A.checkRules({w:A.PRESETS["442"], age:25, salaried:true, withdrawing:false, pledge:false})), "all_good")
  t.eq(codes(A.checkRules({w:A.PRESETS["442"], age:40, salaried:true, withdrawing:false, pledge:false})), "beta_age,cash_low,lev_gt_cash")
  t.eq(codes(A.checkRules({w:A.PRESETS["433"], age:65, salaried:false, withdrawing:true, pledge:false})), "lev_no_pledge")
  t.eq(codes(A.checkRules({w:{base:.3, lev:.4, cash:.3}, age:40, salaried:true, withdrawing:false, pledge:false})), "beta_age,lev_gt_base,lev_gt_cash")
  t.eq(codes(A.checkRules({w:{base:.5, lev:.3, cash:.1}, age:40, salaried:true, withdrawing:false, pledge:false})), "sum")
  t.eq(A.suggest({age:25, salaried:true, withdrawing:false, pledge:false, novice:false}), "442")
  t.eq(A.suggest({age:45, salaried:true, withdrawing:false, pledge:false, novice:false}), "433")
  t.eq(A.suggest({age:65, salaried:false, withdrawing:true, pledge:false, novice:false}), "703")
  t.eq(A.suggest({age:65, salaried:false, withdrawing:true, pledge:true, novice:false}), "433")
  t.eq(A.suggest({age:75, salaried:false, withdrawing:true, pledge:true, novice:false}), "505")
  t.eq(A.suggest({age:25, salaried:true, withdrawing:false, pledge:false, novice:true}), "703")
  const e = A.exposure({house:2000, stock1x:600, stock2x:300, stock3x:0, cash:300, mortSelf:800, mortInvest:200, creditLoan:100, creditLineTotal:300, creditLineUsed:100});
  t.close(e.liqBeta, 1.0, 1e-4); t.close(e.nwBeta, 0.5714, 1e-4); t.close(e.lnwLev, 1.3333, 1e-4)
  t.close(e.hypBeta, 0.5217, 1e-4); t.close(e.bookLev, 1.5238, 1e-4); t.close(e.expLev, 1.5238, 1e-4); t.close(e.cashShare, 0.25, 1e-9)
  t.ok(e.flags.indexOf("cash_share_low") >= 0)
  const z = A.exposure({house:0, stock1x:0, stock2x:0, stock3x:0, cash:0, mortSelf:0, mortInvest:0, creditLoan:0, creditLineTotal:0, creditLineUsed:0});
  t.eq(z.liqBeta, null); t.eq(z.nwBeta, null)
  
};
