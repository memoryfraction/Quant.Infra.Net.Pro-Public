#!/usr/bin/env node
/*
 * build-changelog.js
 * ------------------
 * Renders the product CHANGELOG.md (single source of truth for release notes)
 * into the static, bilingual page changelog.html. Both languages are emitted;
 * CSS shows the one matching <html lang> (see .cl-en / .cl-zh in css/styles.css).
 *
 * Usage:
 *   node build-changelog.js [path/to/CHANGELOG.md]
 *
 * Default source: ../Quant.Infra.Net.Pro/CS 架构/CHANGELOG.md
 * Re-run after every release, then commit changelog.html.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(
  process.argv[2] || path.join(__dirname, '..', 'Quant.Infra.Net.Pro', 'CS 架构', 'CHANGELOG.md')
);
const OUT = path.join(__dirname, 'changelog.html');
const CJK = /[㐀-鿿]/;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

// Block-level render of one language's markdown lines (paragraphs + bullets).
function renderBlocks(lines) {
  const out = [];
  let list = null;
  let para = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flushPara(); continue; }
    if (/^- /.test(line)) { flushPara(); (list = list || []).push(line.slice(2).trim()); continue; }
    if (/^\s+\S/.test(line) && list) { list[list.length - 1] += ' ' + line.trim(); continue; }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return out.join('\n');
}

// Split "## [X.Y.Z] - date" sections out of the file.
const text = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');
const sections = [];
for (const chunk of text.split(/^## \[/m).slice(1)) {
  const m = chunk.match(/^([\d.]+)\] - (\S+)\n([\s\S]*)$/);
  if (!m) continue;
  const body = m[3].replace(/\n---[\s\S]*$/, '').trim(); // drop trailing rule + footer note
  sections.push({ version: m[1], date: m[2], body });
}
if (!sections.length) { console.error('build-changelog: no versions found in ' + SRC); process.exit(1); }

// The source repo is private: drop references to its internal paths from the public page.
function sanitize(body) {
  return body
    .replace(/ (?:See|详见) `CS 架构\/[^`]+`\.?/g, '')
    .split(/\n(?=- )/) // one chunk per bullet (continuation lines stay attached)
    .filter((blk) => !/`CS 架构\/scripts\//.test(blk))
    .join('\n');
}

function splitLangs(body) {
  const en = [];
  const zh = [];
  if (/^### English/m.test(body)) {
    let cur = null;
    for (const line of body.split('\n')) {
      if (/^### English/.test(line)) { cur = en; continue; }
      if (/^### 中文/.test(line)) { cur = zh; continue; }
      if (cur && !/^Chinese notes for this release/.test(line)) cur.push(line);
    }
  } else {
    // Short entries carry interleaved EN / ZH lines; split by script.
    for (const line of body.split('\n')) (CJK.test(line) ? zh : en).push(line);
  }
  return { en, zh };
}

// Versions that have a published GitHub release get an external link (skipped if gh is unavailable).
let tags = new Set();
try {
  const out = require('child_process').execSync(
    'gh release list --repo memoryfraction/Quant.Infra.Net.Pro-Public --limit 100 --json tagName -q ".[].tagName"',
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  tags = new Set(out.split(/\s+/).filter(Boolean));
} catch { /* offline: no external links */ }

const slug = (v) => 'v' + v.replace(/\./g, '-');
const entries = sections.map((s, i) => {
  const { en, zh } = splitLangs(sanitize(s.body));
  return `
      <article class="cl-entry fade-in" id="${slug(s.version)}">
        <header class="cl-head">
          <h2 class="cl-ver">v${s.version}</h2>
          <time class="cl-date" datetime="${s.date}">${s.date}</time>${tags.has('v' + s.version) ? `
          <a class="cl-ext" href="https://github.com/memoryfraction/Quant.Infra.Net.Pro-Public/releases/tag/v${s.version}" target="_blank" rel="noopener noreferrer" data-i18n="changelog.release">GitHub Release ↗</a>` : ''}${i === 0 ? '\n          <span class="cl-badge" data-i18n="changelog.latest">Latest</span>' : ''}
        </header>
        <div class="cl-body cl-en" lang="en">
${renderBlocks(en)}
        </div>
        <div class="cl-body cl-zh" lang="zh-CN">
${renderBlocks(zh)}
        </div>
      </article>`;
}).join('\n');

const chips = sections
  .map((s) => `<a href="#${slug(s.version)}" class="cl-chip">v${s.version}</a>`)
  .join('\n        ');

// Reuse the site chrome (nav/footer) from ebook.html so the pages stay consistent.
const ebook = fs.readFileSync(path.join(__dirname, 'ebook.html'), 'utf8');
const csp = ebook.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)[0];
const navStart = ebook.indexOf('<nav class="navbar"');
const navEnd = ebook.indexOf('</nav>') + '</nav>'.length;
const footStart = ebook.indexOf('<footer class="footer">');
const footEnd = ebook.indexOf('</footer>') + '</footer>'.length;
const nav = ebook
  .slice(navStart, navEnd)
  .replace('<li><a href="#book" data-i18n="nav.ebook">The E-Book</a></li>',
    '<li><a href="./changelog" data-i18n="nav.changelog">What\'s New</a></li>\n        <li><a href="./ebook" data-i18n="nav.ebook">The E-Book</a></li>');
const footer = ebook.slice(footStart, footEnd);

const latest = sections[0];
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>What's New - Version History | Quant.Infra.Net.Pro</title>
  <meta name="description" content="Release notes for every Quant.Infra.Net.Pro version, newest first. Latest: v${latest.version} (${latest.date}).">
  ${csp}
  <meta http-equiv="Strict-Transport-Security" content="max-age=31536000; includeSubDomains; preload">
  <meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
  <meta http-equiv="Permissions-Policy" content="camera=(), microphone=(), geolocation=(), payment=(), usb=()">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="https://www.alpha-wealth-lab.com/changelog">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Quant.Infra.Net.Pro">
  <meta property="og:title" content="What's New - Quant.Infra.Net.Pro Version History">
  <meta property="og:description" content="Release notes for every Quant.Infra.Net.Pro version. Latest: v${latest.version}.">
  <meta property="og:url" content="https://www.alpha-wealth-lab.com/changelog">
  <meta name="twitter:card" content="summary">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./css/styles.css">
  <script src="./js/i18n-data.js"></script>
  <script defer src="./js/app.js"></script>
</head>
<body>
  ${nav}

  <main>
    <section class="section cl-page">
      <div class="container">
        <div class="cl-intro">
          <div class="section-label" data-i18n="changelog.label">Version History</div>
          <h1 class="section-title" data-i18n="changelog.title">What's New</h1>
          <p class="section-sub" data-i18n="changelog.sub">Release notes for every version, newest first.</p>
        </div>
        <nav class="cl-chips" aria-label="Versions">
        ${chips}
        </nav>
${entries}
        <p class="cl-older">
          <span data-i18n="changelog.older">Versions 1.6.2 and earlier:</span>
          <a href="https://github.com/memoryfraction/Quant.Infra.Net.Pro-Public#version-history" target="_blank" rel="noopener noreferrer" data-i18n="changelog.olderLink">README version history</a>
          &middot;
          <a href="https://github.com/memoryfraction/Quant.Infra.Net.Pro-Public/releases" target="_blank" rel="noopener noreferrer" data-i18n="changelog.releases">All GitHub releases</a>
        </p>
      </div>
    </section>
  </main>

  ${footer}
</body>
</html>
`;

fs.writeFileSync(OUT, html);
console.log(`build-changelog: wrote ${path.basename(OUT)} with ${sections.length} versions (latest ${latest.version})`);
