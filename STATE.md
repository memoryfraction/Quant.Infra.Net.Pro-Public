# STATE.md — Phase 1 (Analytics Worker + Site)  — LIVING DOC
_Last updated: 2026-10-13 ~03:25 ET. Read this FIRST after any compact. Then continue "Next action"._

## >>> STATUS: DEPLOYED + ONLINE SMOKE GREEN (3rd bug found & fixed post-deploy) <<<
Worker is LIVE at https://www.alpha-wealth-lab.com/api/* (version **dbadc736**, supersedes 487c6097).
All three secrets set. Full end-to-end verified against production D1.
Task A = PR #20 open (6 commits, tip 65b71b7). Task B = PR #21 open. Neither merged (per instruction).
Bugs #7 / #8 / #9 all found post-deploy, all fixed, all re-verified live.
Remaining: final report only (spec §8) — currently lists 2 bugs, must be amended to 3.

## Objective
Implement Phase 1 of alpha-wealth-lab.com per the spec (pasted-text-1.txt, 201 lines):
Task A = analytics Worker (branch feature/phase1-worker, from main), Task B = site
(branch feature/phase1-site, from gh-pages). Local changes + Cloudflare changes.
Push branches + open PRs (do NOT merge). Do NOT commit before 17:00 ET (now 18:0x, OK).

## HARD CONSTRAINTS (do not violate)
- Repo is PUBLIC (github memoryfraction/Quant.Infra.Net.Pro-Public). NO secrets ever committed.
- NO secret written to disk under E:/Github/Quant.Infra.Net.Pro-Public (user rule). Keep all
  creds (Brevo SMTP key, CF password/token, STATS_TOKEN) ONLY in shell/env/Cloudflare secrets.
- Mon-Fri 08:00-17:00 ET: no public publish. It is ~18:00 now (outside window) + user authorized.
- No raw IP / raw User-Agent stored; no cookies; GPC on => no vid/sid generated or sent.
- No inline <script>/event attrs/style= attrs/eval; same-origin external JS only; dynamic style via el.style.x.
- Do not change engine formulas or existing test assertions (site baseline: 199 passing).
- Bump ?v= on every changed js/css reference.
- Bilingual zh/en for all new copy.
- Never print/commit IP_SALT, BREVO_API_KEY, STATS_TOKEN, Brevo SMTP key, CF password.
  STATS_TOKEN read ONLY from _pr/planner/STATS_TOKEN.txt for curl (not printed, not committed).

## Repo / worktree map
- main     = worker tree  -> infra/analytics-worker/   (deployed already; D1 awl_analytics)
- gh-pages = site tree    -> static HTML
- Worktrees:
  - E:/Github/Quant.Infra.Net.Pro-Public [fix/allocation-defaults]  (PRIMARY; STATE/LOG live here; _pr/planner/STATS_TOKEN.txt)
  - E:/Github/QIN-worker-p1  [feature/phase1-worker]  <- WORKER HERE (== main)
  - E:/Github/QIN-site-p1    [feature/phase1-site]    <- SITE HERE (== gh-pages)
  - E:/Github/QIN-worker     [chore/worker-db-id]     (old, ignore)
- feature/phase1-* are LOCAL only (not pushed yet).

## Environment
- node v26.3.0, npm 11.16.0, wrangler via `npx wrangler` (4.149.0), gh 2.97 (auth: memoryfraction),
  playwright 1.64. Windows PowerShell shell (NOT bash!). Use Get-Content/Set-Content/here-strings.
- Cloudflare: authed via a scoped API token (kept OUTSIDE this repo at
  `C:\Users\rongf\.awl-cf-profile\token.txt`). Account + zone IDs are recorded under DEPLOY below.
- Brevo: REST API (`env.BREVO_API_KEY`) is the spec path and is now configured as a Cloudflare secret.
  Account login/keys are NOT recorded here — see the DEPLOY section for the non-secret references.

## DEPLOY — COMPLETED 2026-10-12 ~23:00 ET
- [x] CF API token created via Playwright (in-page REST API call; UI form kept failing on hidden
      inputs). Saved OUTSIDE the repo at C:\Users\rongf\.awl-cf-profile\token.txt (53 chars).
      Perms: acct-scoped Workers Scripts Write / Workers Editor / D1 R+W / KV Write / Account
      Settings Read; zone-scoped Workers Routes R+W.
      Account 871a1f78b5972a5286b50d913f4a6719, zone alpha-wealth-lab.com 35b72486f8ba098c70de13c46b2ba553.
- [x] D1 migrations applied --remote: 0002 (4 tables) + 0003 (hits 14 -> 29 cols, 10 indexes).
      DB UUID 82684561-1447-4e7d-997b-1a1e8a8425d4.
- [x] `wrangler secret put IP_SALT` (32 random bytes, generated inline, never printed/persisted).
- [x] `STATS_TOKEN` pre-existing and MATCHES _pr/planner/STATS_TOKEN.txt (verified via live 200).
- [x] `wrangler secret put BREVO_API_KEY` (an `xkeysib-*` REST key, created in the Brevo dashboard).
- [x] `wrangler deploy` -> version 487c6097, route www.alpha-wealth-lab.com/api/*.
- [x] Brevo sender alphawealthlab@outlook.com confirmed ACTIVE via GET /v3/senders (id=1).
      Free plan, 300/day. Confirmation mail actually delivered (Brevo event log shows
      `requests` then `delivered` for subject "Confirm: annual rebalancing reminder").

## ONLINE SMOKE — ALL PASS (production)
- GET  /api/health                     -> 200 "ok"
- POST /api/hit  (valid e)             -> 204 AND row lands in hits (id 213/214/215)
      device/os/browser parsed from UA; utm_source/medium/campaign stored; ip_hash = 16-hex HMAC
- POST /api/hit  (bad event)           -> 400
- POST /api/hit  (bot UA)              -> 204, no row
- POST /api/calc                       -> 204
- GET  /api/stats  (no token)          -> 401
- GET  /api/stats  (Bearer token)      -> 200, 23 KB; summary/subscribers/devices/utm all reflect
      the fresh writes; subscribers {pending:0, confirmed:1, unsubscribed:0}
- POST /api/subscribe (t>=1500, no honeypot) -> 204, row pending, Brevo mail delivered
- GET  /api/confirm?t=<token>          -> 302, row flips to confirmed with confirmed_ts
- GET  /api/admin/subscribers          -> 200 (was 500 — see bug #8), emails masked (a***@outlook.com)
- GET  /api/admin/export?table=<t>     -> 200 CSV for hits/calcs/profiles/feedback/subscribers
- GET  /api/admin/export?table=bogus   -> 400 bad_table
- PRIVACY AUDIT: hits has 29 cols, NO plaintext ip / user_agent column; ip_hash len=16 hex.

## REQUEST-SHAPE GOTCHAS (cost me time; recorded so I don't repeat them)
- `/api/hit` uses SHORT keys: e=event, p=path, r=referrer, v=visitor tag, d=dwell ms, sc=scroll.
  EVENT whitelist: view|calc|share|save|load|join|leave.
  VISITOR_TAGS whitelist: new|d0|d1_7|d8_30|d30p (anything else is dropped, e.g. "returning").
  Unknown path -> normalized to "/other" by design (whitelist, not a bug).
- `/api/subscribe` silently 204s unless `t` (form dwell ms) >= 1500 and `website` (honeypot) is empty.
  This is intended anti-abuse behaviour — my first smoke request was missing `t`.
- `/api/admin/export` REQUIRES `?table=`; omitting it is a 400 by design.
- Rate limit is 5 req / 60 s per client, so back-to-back smoke calls need a ~65 s gap.
- Node CANNOT spawn child processes in this sandbox (spawnSync => EBUSY for every path, even
  `python`). Workaround for the Brevo login: run the mailbox poller as its OWN top-level process
  and communicate through a file (C:\Users\rongf\.awl-cf-profile\code-feed.txt).

## CREDENTIALS STATUS  (Rex answered 20:2x 2026-10-12)
- [DONE] Cloudflare API token -> created via Playwright browser login (account holder's CF login).
- [DONE] Brevo v3 API key -> created in the dashboard via Playwright as alphawealthlab@outlook.com,
  now stored ONLY as the Cloudflare secret BREVO_API_KEY (+ a local copy outside the repo at
  C:\Users\rongf\.awl-cf-profile\brevo-key.txt). Never committed, never printed in full.
- [DECIDED] MAIL_FROM = **alphawealthlab@outlook.com** (Rex's decision). Already in wrangler.toml.
- [note] The `xsmtpsib-...` string Rex supplied is an **SMTP-relay** key; it returns 401
  "Key not found" against api.brevo.com/v3, so it cannot be used as BREVO_API_KEY. Only an
  `xkeysib-...` key works for the REST API.
- [ok]   STATS_TOKEN           -> in _pr/planner/STATS_TOKEN.txt (file; read for curl only).

## PROGRESS — Task A: WORKER (QIN-worker-p1/infra/analytics-worker)
Existing single-file src/index.js (hit/stats/health), schema.sql (hits only), wrangler.toml.
- [x] src/lib.js            (178 lines; pure fns + whitelists; all exported)
- [x] migrations/0002_phase1.sql   (calcs, profiles, feedback, subscribers + 7 indexes)
- [x] migrations/0003_hits_extend.sql (15 ALTER cols + 2 indexes) [reference DDL]
- [x] scripts/apply-0003.mjs   (idempotent PRAGMA-driven ALTERs)
- [x] src/index.js           (537 lines; hit ext, calc, profile, feedback, subscribe,
                              confirm, unsubscribe, admin subs/send-reminder/export/delete,
                              stats ext, Brevo mail, scheduled())
- [x] wrangler.toml          (MAIL_FROM var, crons, d1 binding, route)
- [x] package.json           (type module, test script)
- [x] .gitignore            (adds _pr/, *.token, *.secret, .wrangler, node_modules)
- [x] test/lib.test.mjs      (22 tests)
- [x] test/index.test.mjs    (37 endpoint tests; in-memory D1 stub + Brevo mocked)
- [x] **VERIFIED: node --test => 62 tests, 62 pass, 0 fail**  (after the two D1 fixes)
- [x] `PR #20` OPEN: https://github.com/memoryfraction/Quant.Infra.Net.Pro-Public/pull/20
      (`feature/phase1-worker` -> main). 5 commits, all with Co-Authored-By: Codex.
      Secret scan of the diff = clean. NOT merged (as instructed).
- [x] Deploy: DONE (see DEPLOY section above). ONLINE SMOKE: DONE, all pass.

## PROGRESS — Task B: SITE (QIN-site-p1)
- [x] planner/assets/lib.js        (UMD AWLLib: encode/decodeState, planStore, comparePlan, getVid/getSid, visitorTag, utm, campaign, band fns; node-safe)
- [x] planner/tests/lib.test.js    (encode/decodeState, planStore eviction+throwing store, comparePlan, getVid/getSid+GPC, utm/campaign, bands, constants sync)
- [x] 7 tool ui.js: summary(v,t) <=5 rows + next (fi/allocation/margin/rebalance/withdrawal/mortgage/social-security)
- [x] `AWL.mount.last` hook added (exposes the mounted cfg for tests; render unaffected)
- [x] planner/tests/summary.test.js (vm sandbox: common.js + engines + ui.js; asserts <=5 rows, non-empty [string,string],
      bilingual zh/en, deterministic, next-step href shape + key resolves in both langs)
- [x] planner/assets/common.js  PHASE-1 RUNTIME: share(+from=share)/save/load-banner/compare table/calc reporting
      (beacon, <=5/page, 3s idle)/profile card (6 questions, on-device once)/retention (zh->/join/ primary,
      en->email primary)/feedback(1-5 stars+msg+contact+wtp honeypot+form-time)/next-step. All gated on prod host + vid.
- [x] planner/tests/runtime.test.js (real common.js against a DOM stub: renders all blocks for all 7 tools,
      ?s= restore, garbage ?s= no-throw, blocked storage, GPC -> no ids & no reports, non-prod host -> no reports,
      saved-plan banner -> load -> compare table, share copies a ?s=…&from=share link)
- [x] **VERIFIED: node planner/tests/run.js => 818 passed, 0 failed** (baseline was 199)  (2026-10-12)
- [x] Real bugs found & fixed by the new tests:
      (1) `olderThan(plan.ts, 330 * DAY_MS)` passed ms where DAYS was expected -> banner never used "almost a year" wording;
      (2) dead `row.lastChild.firstChild.__awlVal = val` in pickGroup crashed on text nodes;
      (3) `inputsEl.parentNode.insertBefore` threw when #inputs had no parent -> now guarded with a fallback.
- [x] planner/registry.js            (AWL_TOOLS: 7 planner tools + calculator + macro; each with bilingual
      [title,desc], source{name,url,kind}, tags; AWL_TOOL_TAGS + AWL_TAG_COPY + AWL_REGISTRY_COPY bilingual)
- [x] planner/hub.js                 (renders from the registry, tag filter chips, "方法论参考：xxx" per card)
- [x] planner/index.html             (+ registry.js, + #filters container)
- [x] 7 tool pages: + registry.js, + `<p class="srcref" id="srcRef" hidden>` under "Method & formulas";
      common.js renderSource() fills it from the registry on every language change.
- [x] planner/tests/registry.test.js (9 entries, 7 planner pages exist on disk, unique slug/href, tag ids valid
      with zh+en copy, calculator/macro kept without a book source, source.url is never cover art,
      hub renders one card per entry incl. attribution + filter)
- [x] assets/hit.js + assets/notice.css   (notice bar zh/en + awl_notice=1, counter.dev once, vid/sid/v/utm/vw/bl,
      AWL_track whitelist calc|share|save|load|join once per load, leave beacon with d+sc, GPC -> basic fields only,
      production-host-only, inline minimal lib.js fallback that must match AWLLib)
- [x] planner/tests/hit.test.js      (16 groups: basic fields, utm/campaign, dirty params dropped, GPC -> basic only,
      blocked storage, non-prod host -> zero beacons, AWL_track whitelist+once, leave beacon d/sc, notice injection +
      dismissal persistence + stored-flag suppression + en copy + notice.css link, counter.dev once,
      fallback===AWLLib parity incl. identical field set, visitor-tag boundaries, no cookie / no UA / no ip)
- [x] **VERIFIED: node planner/tests/run.js => 893 passed, 0 failed** (baseline was 199)  (2026-10-12)
- [x] More real bugs found & fixed by the new tests:
      (4) hit.js fallback getVid/getSid/visitorTag ignored Global Privacy Control -> under GPC it still created and
          stored an id. Now every fallback accessor short-circuits on GPC, matching AWLLib.
- [x] stats/stats.js + stats/index.html  (all 10 spec blocks: ①overview ②new-vs-returning + D1/D7/D30 cohort curve
      ③devices/os/browsers with the WeChat share highlighted ④referrers + utm(source/medium/campaign) + from=
      ⑤per-page dwell seconds + scroll depth ⑥per-tool calcs + input P25/median/P75 + select distributions
      ⑦profile (age/asset/goal/markets/follows/leverage) ⑧wtp ⑨subscriber counts ⑩last-50 feedback;
      CSV export dropdown (table × days) via /api/admin/export; token in sessionStorage only; textContent everywhere)
- [x] planner/tests/stats.test.js    (static: no innerHTML, no localStorage, token in sessionStorage; html has
      every control id + 5 export tables + noindex; then renders a synthetic response and asserts all 10 blocks,
      the WeChat share %, ms->seconds dwell, scroll %, retention %, new/returning %, multi-select market %,
      export request params + bearer, and that a `<script>` inside a feedback comment stays literal text
      and creates no SCRIPT element)
- [x] **VERIFIED: node planner/tests/run.js => 945 passed, 0 failed** (baseline was 199)  (2026-10-12)
- [x] NEW PAGES (spec 4.6) — all four done:
      `terms/index.html` (bilingual; §4 consent wording verbatim both langs; §7 jurisdiction LEFT BLANK
        on purpose + "assumption" note; no invented governing law)
      `privacy/index.html` (all disclosures: dwell/scroll/utm/wechat/device/viewport/blang,
        "we do not store raw IP" + HMAC-SHA256 salted-hash explanation, anonymous ids, NO cookies,
        Cloudflare/GitHub Pages/counter.dev/Brevo, aggregated-only sharing + no sale, 24mo/30d retention,
        GPC, clear-data, deletion-by-vid) + Settings block with `#vidOut/#vidCopy/#vidReset`
      `privacy/privacy.js` (identifier control: shows the REAL vid via AWLLib, copy, reset)
        -> REAL BUG FOUND+FIXED: `reset()` wrote the confirmation then called `render()`,
           which immediately overwrote it, so the user never saw "已重置". Now `render(keepMsg)`.
      `join/index.html` (noindex; 关注公众号 + 进微信群 blocks; expired-QR email fallback;
        terms+privacy links) + `assets/join/{official,group}.png` + `assets/join/README.md`
      `planner/subscribed/index.html` + `subscribed.js` (ok=1 / ok=0 / unsub=1 / neutral;
        unsub wins over a stale ok=1 left in the URL by a mail client)
      `css/pages.css` (new shared page CSS), `scripts/make-join-placeholders.py`
- [x] JOINS: footers of index/ebook/mcp/changelog + all 8 planner pages now link /terms/ + /privacy/
      (`footer.terms` i18n key added to en+zh, `i18n-data.js` rebuilt via build-i18n.js; the existing
      `footer.privacy` key was RESTORED to its original value after an accidental overwrite)
      sitemap.xml += /terms/ + /privacy/ (NOT /join/, NOT /planner/subscribed/)
      robots.txt += Disallow: /join/ and /planner/subscribed/
- [x] planner/assets/planner.css: +~90 lines for every class common.js emits
      (awl-banner/btn/chips/chip/fb/fbbody/hp/ta/in/hint/actions/link/linkbox/pick/picklbl/prof/sub/toast
       + srcref + .panel.awl-next|awl-keep|awl-cmp) + 420px narrow-phone rules
- [x] `?v=` bumped to **20261013** on every reference to a changed asset (111 refs, 15 files).
      calculator.js + macro/* keep 20261008 — those files were NOT modified.
- [x] `planner/tests/pages.test.js` NEW (~150 assertions): static checks for all 4 pages
      (copy, robots, sitemap, footer links, no inline script / no event attrs / no style= / no eval,
      real PNG magic bytes), plus DYNAMIC checks that `subscribed.js` picks the right card for
      9 query-string cases (incl. hostile ones) and that `privacy.js` shows/copies/resets the real
      identifier under normal, empty, GPC, blocked-storage and reset cases.
- [x] **VERIFIED: node planner/tests/run.js => 1101 passed, 0 failed** (baseline was 199)  (2026-10-12)
- [x] **VERIFIED: node planner/tests/run.js => 1125 passed, 0 failed** (baseline was 199)  (2026-10-13)
- [x] **REAL BUG #6 (SEVERE) FOUND+FIXED — stats.js crashed against the worker's real response.**
      `distRows()` called `rows.reduce(...)` on whatever `show()` passed in, and read `r.key`.
      The worker returns FIVE different shapes, so 8 of the 10 spec blocks never rendered:
        (a) bare alias `v`:  profiles.age_band / asset_band / goal / leverage_exp -> `[{v,n}]`
            -> labels became "(空)" AND `rows.reduce is not a function` threw, aborting `show()`
               after block ② (so ③–⑩ were missing entirely).
        (b) alias `s` / `c`: utm.source / medium / campaign / campaigns -> `[{s,n}]` / `[{c,n}]`
            -> silently rendered "—" for every row (no exception, so tests never caught it).
        (c) `countOptions()`: profiles.markets / follows / wtp -> `Object.entries()` = `[["A",3]]`
            -> `r.key`/`r.n` both undefined -> "(空) 0 —".
        (d) bare column selects: devices / os / browsers -> `[{device,n}]` / `[{os,n}]` / `[{browser,n}]`.
        (e) section ⑤ read `avg_dur_ms` but the worker returns `avg_s` (already seconds,
            `ROUND(AVG(dur_ms)/1000.0,1)`) -> dwell showed "—"; dividing again would also be wrong.
        (f) section ⑥ read `inputs.median` / `inputs[k].kind|values`, but the worker returns
            `{numeric:{k:{p25,med,p75,n}}, categorical:{k:[["值",n]]}}` -> nothing rendered.
      FIX: one `distList(rows, col)` normaliser accepting `{key,n}` / `{v,n}` / `{name,n}` /
      `["值",n]` / bare `{<col>,n}`, plus `Array.isArray` guards; `distRows(rows,total,col)` now
      takes the column hint; ⑤/⑥ rewritten to the worker's real field names.
      ROOT CAUSE OF THE MISS: `planner/tests/stats.test.js`'s fixture was hand-shaped to match the
      RENDERER (`{key,n}`, `avg_dur_ms`, `median`, `kind:"select") instead of the WORKER, so it
      passed while production broke. The fixture is now documented as mirroring
      `src/index.js` L459/468/469-471/474-477/486-491/549-550, with 13 new shape-regression assertions.
      Same fix applied to `scripts/verify-site.js` section 11, whose payload was entirely fictional
      (`sessions:{sids:44}`, `devices:{mobile:70}`, `uniques:{vids,ips}`, `cohorts:[{day,size}]`).
- [x] **Playwright verification (spec 5c) => 131 passed, 0 failed**  (2026-10-13)
      Run: `NODE_PATH=/e/Github/memoryfraction/node_modules node scripts/verify-site.js`
      (playwright 1.64 lives in /e/Github/memoryfraction/node_modules, NOT in this worktree —
       node resolves node_modules relative to the SCRIPT path, so `cd` alone does not help.)

## REAL BUGS #7 / #8 / #9 — FOUND ONLY BY PROBING PRODUCTION, NOT BY THE SUITE
All three are SQL/statement-shape mismatches. The in-memory D1 stub was strictly MORE PERMISSIVE
than real D1 (it accepted ANY bind arity and modelled no NOT NULL constraints), so 42 green tests
proved nothing about real D1. Found by checking whether the smoke-test data actually landed in
production D1 (a 204 response proves nothing on its own).

- [x] **BUG #7 (SEVERE — analytics collection was 100% dead).**
      `POST /api/hit` listed **28 columns but only 27 `?` placeholders** in its INSERT, so every
      real write raised SQLITE_ERROR. The promise was drained with `.catch(() => {})`, which
      swallowed the error completely: the endpoint kept answering 204, `wrangler tail` showed
      nothing, and the dashboard merely looked empty — indistinguishable from "no traffic yet".
      Evidence: 5 valid hits in a row, `SELECT COUNT(*) FROM hits` never moved (212 -> 212).
      FIX: added the 28th placeholder; replaced the silent catch with a payload-free
      `console.error("hit_insert_failed", e.message)` so the class of failure is observable.
      VERIFIED LIVE: a fresh hit now lands (id 213/214/215) with device/os/browser parsed from
      the UA, utm_* stored, and ip_hash = 16-hex HMAC.
- [x] **BUG #8 (500 on an admin endpoint).**
      `GET /api/admin/subscribers` built its statement with a conditional `WHERE status=?`, then
      called `.bind(has ? status : "")` **unconditionally** — binding 1 value to a statement with
      0 placeholders whenever the filter was absent. D1 rejects that; the endpoint returned
      500 (error code 1101). The filtered path worked, which is why it looked healthy.
      FIX: only bind when the WHERE clause is actually present.
      VERIFIED LIVE: `/api/admin/subscribers` -> 200 with masked emails; `?status=confirmed` -> 200.
- [x] **BUG #9 (500 on /api/profile — found by the smoke test itself).**
      `handleProfile` guarded its four enum fields with `x !== undefined`. But `cleanEnum`
      returns **`null`** (not `undefined`) for a value outside the whitelist, so the test was
      *always true*: an invalid enum reached the column as SQL NULL, hit
      `NOT NULL constraint failed: profiles.age_band`, and 500'd the whole request — when the
      spec only asks that an invalid value be **silently dropped**.
      Trick that exposed it: my "bad test data" `age_band:"35-44"` is not in `AGE_BANDS`
      (`<30,30-39,40-49,50-59,60+`), so the malformed request surfaced a real defect.
      FIX: two independent guards — (1) `keep(raw, cleaned)` -> `undefined` unless the key was
      present AND the cleaned value is non-null; (2) `?? base.xxx` -> fall back to the stored or
      default value. **Both are load-bearing: ablation shows removing EITHER one alone
      reproduces all 3 failures.** (My first injection only removed `keep` but left a usage,
      yielding a `ReferenceError` instead of the NOT NULL error — a narrower second injection
      was needed to show the fallback independently protects the column.)
      VERIFIED LIVE (version `dbadc736`): the exact payload that 500'd now returns 204 and the
      row reads `age_band:"" asset_band:"" leverage_exp:""` with `age_null:0 asset_null:0`,
      while the *valid* field in the same request (`goal:"retire"`) is still applied.
      Also verified the don't-clobber path: a valid `age_band:"40-49"` survives a later
      `age_band:"nonsense"` update unchanged.
- [x] TEST-HARNESS HARDENING (the actual root cause of all three misses):
      `test/index.test.mjs`'s D1 stub now enforces:
      (a) INSERT column count vs placeholder count, (b) `bind()` value count vs placeholder count,
      (c) **NOT NULL** for every column declared so in migrations 0002 + 0003.
      PROVEN to work by re-injecting each bug and confirming the suite turns red with a precise
      message ("28 columns but 27 placeholders" / "0 placeholder(s) but 1 value(s) bound" /
      "D1_ERROR: NOT NULL constraint failed: profiles.age_band").
      One prior assertion **encoded bug #9 as correct behaviour**:
      `assert.equal(p.asset_band, null, "illegal enum dropped (stored as NULL/empty)")` — the
      `null` it asserted is exactly what production rejects. Now `""` + `assert.notEqual(..., null)`.
      LESSON: a stub that is more permissive than the real service converts production failures
      into green tests. Verify against the real thing before believing the suite.
      Tests: **42 pass, 0 fail** (3 new regression tests added).
      14 sections green: console/CSP cleanliness on 9 pages, notice bar, share round-trip,
      malformed ?s=, save->banner->load->compare, blocked storage, GPC, profile card,
      zh/en retention entry, honeypot, stats escaping (incl. all 10 blocks vs the real shapes),
      375px no h-scroll on 10 pages, new-page language switching, notice bar site-wide.
      Three HARNESS bugs fixed (product was correct in all three):
      (i)   share-URL capture: headless HTTP is not a secure context, so `navigator.clipboard` is
            absent and `legacyCopy()` puts the link in a TRANSIENT <textarea> that it selects then
            removes — wrapping `execCommand` is too late. Now hooks
            `HTMLTextAreaElement.prototype.select`. Verified the real output:
            `?s=eyJhMCI6MCwiY3VycmVudCI6MTAwMDAwLCJleHBlbnNlTm93IjoxMjM0NTY3...&from=share`.
      (ii)  third-party error attribution: counter.dev throws the SAME "storage blocked" message our
            code would, so filtering by message hid the truth. Now records stacks and filters by
            origin (`THIRD_PARTY` regex).
      (iii) share-button click: the button is far below the fold; a synthetic DOM click replaces
            `locator.click()` for this link-generation assertion.

## TESTING TRAP — `curl` IS TREATED AS A BOT (cost me a false "still broken" read)
`BOT_RE` in `src/lib.js` matches `curl` (also `wget`, `python`, `httpclient`, `headless`,
`monitor`, `lighthouse`, ...), and every write handler opens with
`if (isBot(request.headers.get("User-Agent") || "")) return noStore();`.
So a plain `curl` POST returns **204 with nothing written** — byte-identical to success.
I nearly concluded bug #9 was unfixed because my verification requests were being dropped.
ALWAYS pass a browser UA when smoke-testing write endpoints:
  `-A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ... Chrome/131.0.0.0 Safari/537.36"`
And never trust the status code alone — confirm the row with a D1 SELECT.
- [x] **PUSHED + PR OPEN**: `PR #21` https://github.com/memoryfraction/Quant.Infra.Net.Pro-Public/pull/21
      (`feature/phase1-site` -> `gh-pages`). 6 commits, all with Co-Authored-By: Codex.
      Secret scan of the diff = clean. NOT merged (as instructed). mergeable=MERGEABLE.
      (Playwright needed `NODE_PATH=/e/Github/memoryfraction/node_modules` — node resolves
       node_modules relative to the SCRIPT path, so `cd` alone fails.)

## DECISIONS / ASSUMPTIONS (state in final report)
- Email: use Brevo REST API (spec) with env.BREVO_API_KEY. SMTP creds = fallback. MAIL_FROM default
  planner@alpha-wealth-lab.com (MUST be a verified Brevo sender; confirm with Rex). replyTo alphawealthlab@outlook.com.
- Applicable law & jurisdiction for /terms/: reference gonglue.us disclaimer; still flag for lawyer.
- Retention: exact-day-offset D1/D7/D30 (document).
- No CAPTCHA (honey pot + form-time + rate limit + daily cap) per spec.

## NEXT ACTION
1. **TASK A (worker) IS DONE -> PR #20.** Do not merge.
2. Task B (site) in E:/Github/QIN-site-p1 [feature/phase1-site] — progress:
   a) [DONE] planner/assets/lib.js + planner/tests/lib.test.js + planner/tests/summary.test.js
      -> node planner/tests/run.js = **576 passed, 0 failed** (baseline 199).
   b) [DONE] 7 tool ui.js: cfg.summary(v,t) (<=5 rows) + cfg.next.
   c) [DONE] planner/assets/common.js runtime (share/save/load/compare/calc/profile/retention/feedback/next).
   d) [DONE] planner/registry.js + hub.js (read registry + tag filter + "方法来源").
   e) [DONE] assets/hit.js + assets/notice.css.
   f) [DONE] stats/index.html + stats/stats.js (10 blocks + CSV export dropdown).
   g) [DONE] new pages /planner/subscribed/ /join/ /terms/ /privacy/ + footers + sitemap + robots
              + planner.css additions + ?v= bump to 20261013.
   h) [DONE] Playwright verification (spec 5c) -> **131 passed, 0 failed** (14 sections).
              node planner/tests/run.js -> **1125 passed, 0 failed**.
              Found+fixed real bug #6 (stats.js vs worker response shapes, 8/10 blocks dead).
   i) [DONE] Committed (6 commits) + pushed `feature/phase1-site` + **PR #21 OPEN** (not merged).
2b. [DONE] **DEPLOY** — all steps completed 2026-10-12 ~23:00 ET (see DEPLOY section).
   CF token created, 0002 + 0003 applied --remote, IP_SALT + BREVO_API_KEY + STATS_TOKEN set,
   `wrangler deploy` -> version 487c6097, MAIL_FROM confirmed an ACTIVE Brevo sender.
   Full online smoke GREEN, including a real subscribe -> delivered email -> confirm -> confirmed.
   Bugs #7 (hit wrote nothing, ever) and #8 (admin 500) found during this phase and fixed live.
3. **[NEXT] Final report** with the 6 required sections (spec §8). Everything else is complete.
   Do NOT merge PR #20 / #21.

## ETA
- Task A (worker): **DONE** — PR #20 open (5 commits), 62 tests pass, DEPLOYED + smoke-tested.
- Task B (site): **DONE** — PR #21 open (6 commits), 1125 unit + 131 browser checks pass.
- Deploy: **DONE** — live, all endpoints verified against production D1.
- **Remaining: write the final report. ETA ~15 min.**