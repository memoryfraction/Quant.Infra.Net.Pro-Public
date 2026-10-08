// Golden values cross-checked against an independent Python reference.
module.exports = function (t) {
  const M = require("../margin/engine.js"); const th = {renew:1.67, warn:1.40, call:1.30};
  t.close(M.dropToHit(0.5, 1.67), 0.165, 1e-9); t.close(M.dropToHit(0.5, 1.30), 0.35, 1e-9)
  t.close(M.dropToHit(0.4, 1.30), 0.48, 1e-9); t.close(M.dropToHit(0.2, 1.30), 0.74, 1e-9)
  t.close(M.dropToHit(0.6, 1.30), 0.22, 1e-9); t.ok(M.dropToHit(0.6, 1.67) < 0)
  t.close(M.ratioAfterDrop(0.2, 0.30), 3.5, 1e-9)
  const tbl = M.ltvTable([0.6,0.5,0.4,0.3,0.2,0.1], th);
  t.eq(tbl.map(r => r.rating).join(","), "very_high,high,medium,low,safe,very_safe")
  t.close(tbl[0].init, 1.6667, 1e-4); t.close(tbl[4].init, 5, 1e-9)
  t.eq(M.status(1.80, th), "safe"); t.eq(M.status(1.50, th), "no_renew"); t.eq(M.status(1.35, th), "alert"); t.eq(M.status(1.20, th), "call")
  const cur = M.current({collateral:100, loan:70, th});
  t.close(cur.ratio, 1.428571, 1e-6); t.eq(cur.status, "no_renew")
  t.close(cur.addCollateral, 16.9, 1e-9); t.close(cur.repay, 10.1198, 1e-4)
  t.eq(M.current({collateral:100, loan:0, th}).status, "no_loan")
  t.close(M.cashMultiple({rate:0.05, years:10, maxLtv:0.6, growth:0.02}), 2.2271, 1e-4)
  let p = M.project({C0:100, drawRate:0.02, i:0.05, g:0, years:30, th});
  t.close(p.rows[0].loan, 2, 1e-9); t.close(p.rows[9].loan, 25.1558, 1e-4); t.close(p.rows[21].ratio, 1.2985, 1e-4)
  t.eq(p.first.renew, 19); t.eq(p.first.warn, 21); t.eq(p.first.call, 22)
  p = M.project({C0:100, drawRate:0.02, i:0.07, g:0.03, years:30, th});
  t.eq(p.first.renew, 25); t.eq(p.first.warn, 29); t.eq(p.first.call, 30)
  p = M.project({C0:100, drawRate:0.02, i:0.07, g:0.10, years:30, th});
  t.eq(p.first.call, null)
  const g = M.dropGrid([0.5], [0, 0.35, 0.5], th);
  t.eq(g[0][0].status, "safe"); t.close(g[0][2].ratio, 1.0, 1e-9); t.eq(g[0][2].status, "call")
  
};
