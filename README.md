# Quant.Infra.Net.Pro — Public Site

Landing page for [Quant.Infra.Net.Pro](https://www.alpha-wealth-lab.com/) — a local,
any-language Charles Schwab API infrastructure.

## Multi-language (i18n)

The site supports multiple languages with **one source of truth** and **automatic
browser-language detection**, and is built to add more languages without touching
the page markup.

### How it works
- `i18n/<lang>.json` — the **single source of truth** for every language
  (currently `en`, `zh`).
- `js/i18n-data.js` — a **generated** bundle that inlines all languages so the
  page works from `file://` and needs no extra network request.
- `js/app.js` — the i18n runtime:
  - defaults to the **visitor's browser language** (`navigator.languages`),
    falling back to `en`;
  - remembers an explicit choice in `localStorage` and lets the visitor switch
    at any time via the language selector;
  - populates the selector and detects languages **from the data**, so new
    languages appear automatically.

### Add a language
1. Copy `i18n/en.json` to `i18n/<lang>.json` and translate every value
   (keep the exact same key tree).
2. Regenerate the bundle and validate consistency:
   ```
   node build-i18n.js
   ```
   This fails loudly if any key is missing/extra, so languages can't silently drift.
3. Commit `i18n/<lang>.json` **and** `js/i18n-data.js`.

That's it — no HTML or `app.js` changes required.

### Notes
- The `Content-Security-Policy` forbids inline scripts and inline event handlers
  (`script-src 'self'`). All interactivity therefore lives in `js/app.js` via
  `addEventListener`; do **not** re-add `onclick=`/`onchange=` attributes — the
  browser will silently block them.
- `js/i18n-data.js` is generated; treat `i18n/*.json` as canonical.
