// Usage: node planner/tests/run.js
const fs = require("fs"), path = require("path");
let fails = 0, passes = 0;
for (const f of fs.readdirSync(__dirname).filter((n) => n.endsWith(".test.js"))) {
  const before = fails;
  const fn = require(path.join(__dirname, f));
  const t = {
    eq: (a, e, m) => { if (a === e) passes++; else { fails++; console.log(`  FAIL ${f}: ${JSON.stringify(a)} !== ${JSON.stringify(e)} ${m || ""}`); } },
    close: (a, e, tol, m) => { if (Math.abs(a - e) <= tol) passes++; else { fails++; console.log(`  FAIL ${f}: ${a} vs ${e} (tol ${tol}) ${m || ""}`); } },
    ok: (c, m) => { if (c) passes++; else { fails++; console.log(`  FAIL ${f}: ${m || "ok"}`); } },
  };
  try { fn(t); } catch (e) { fails++; console.log(`  ERROR ${f}: ${e.message}`); }
  console.log(`${fails === before ? "PASS" : "FAIL"} ${f}`);
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
