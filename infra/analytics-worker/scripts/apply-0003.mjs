// scripts/apply-0003.mjs — idempotently add the 15 Phase-1 columns + 2 indexes to `hits`.
// Safe to run repeatedly: reads PRAGMA table_info(hits), then runs only the missing ALTERs.
//   node scripts/apply-0003.mjs            # remote (default)
//   node scripts/apply-0003.mjs --local    # local dev D1 (wrangler d1 execute --local)
// Requires CLOUDFLARE_API_TOKEN (or `wrangler login`) for --remote.
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const DB = process.env.DB_NAME || "awl_analytics";
const LOCAL = process.argv.includes("--local");
const flag = LOCAL ? "--local" : "--remote";

const COLS = [
  ["visitor", "TEXT NOT NULL DEFAULT ''"],
  ["vid", "TEXT NOT NULL DEFAULT ''"],
  ["sid", "TEXT NOT NULL DEFAULT ''"],
  ["ip_hash", "TEXT NOT NULL DEFAULT ''"],
  ["device", "TEXT NOT NULL DEFAULT ''"],
  ["os", "TEXT NOT NULL DEFAULT ''"],
  ["browser", "TEXT NOT NULL DEFAULT ''"],
  ["blang", "TEXT NOT NULL DEFAULT ''"],
  ["vw", "INTEGER"],
  ["utm_source", "TEXT NOT NULL DEFAULT ''"],
  ["utm_medium", "TEXT NOT NULL DEFAULT ''"],
  ["utm_campaign", "TEXT NOT NULL DEFAULT ''"],
  ["campaign", "TEXT NOT NULL DEFAULT ''"],
  ["dur_ms", "INTEGER"],
  ["scroll", "INTEGER"],
];
const INDEXES = [
  "CREATE INDEX IF NOT EXISTS idx_hits_vid ON hits(vid);",
  "CREATE INDEX IF NOT EXISTS idx_hits_day_vid ON hits(day, vid);",
];

function run(args) {
  const out = execFileSync("npx", ["wrangler", "d1", "execute", DB, flag, ...args, "--json"],
    { encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "pipe"] });
  try { return JSON.parse(out); } catch { return { raw: out }; }
}

function main() {
  const info = run(["--command", "PRAGMA table_info(hits)"]);
  const rows = (info && info.results) || [];
  const present = new Set(rows.map((r) => r.name));
  const missing = COLS.filter((c) => !present.has(c[0]));
  console.log(`hits columns present: ${present.size}; to add: ${missing.length}`);
  if (missing.length) {
    const sql = missing.map(([n, d]) => `ALTER TABLE hits ADD COLUMN ${n} ${d};`).join("\n");
    const tmp = join(process.cwd(), "_apply0003.sql");
    writeFileSync(tmp, sql + "\n");
    try { run(["--file", tmp]); } finally { try { unlinkSync(tmp); } catch {} }
    console.log("added: " + missing.map((m) => m[0]).join(", "));
  } else {
    console.log("no columns to add (already applied)");
  }
  // indexes are idempotent (IF NOT EXISTS) — always run.
  const tmp2 = join(process.cwd(), "_apply0003_idx.sql");
  writeFileSync(tmp2, INDEXES.join("\n") + "\n");
  try { run(["--file", tmp2]); } finally { try { unlinkSync(tmp2); } catch {} }
  console.log("indexes ensured; apply-0003 complete.");
}

try { main(); } catch (e) { console.error("apply-0003 failed:", e && e.message); process.exit(1); }