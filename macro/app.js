/* global echarts, I18N */
const $ = (id) => document.getElementById(id);
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const pct = (x, d = 1) => (x * 100).toFixed(d) + '%';
const signed = (x, d = 1) => (x >= 0 ? '+' : '') + (x * 100).toFixed(d) + '%';

const PHASES = ['Recovery', 'Overheat', 'Stagflation', 'Reflation'];
const PHASE_SLOT = { Recovery: 's1', Overheat: 's2', Stagflation: 's3', Reflation: 's4' };
const STANCE_STYLE = {
  offensive: { icon: '▲', color: '--good' },
  balanced: { icon: '■', color: '--warning' },
  defensive: { icon: '▼', color: '--critical' },
};

/* ---------------- language ---------------- */
function detectLang() {
  try { const saved = localStorage.getItem('lang'); if (saved === 'zh' || saved === 'en') return saved; } catch (e) { /* ignore */ }
  const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
  return langs.some((l) => /^zh\b/i.test(l)) && /^zh\b/i.test(langs[0]) ? 'zh' : 'en';
}
let LANG = detectLang();
const T = () => I18N[LANG];

function applyStaticText() {
  const t = T();
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  document.title = t.docTitle;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.innerHTML = t[el.dataset.i18n]; });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t[el.dataset.i18nAria]));
  $('langBtn').textContent = t.langName;
}

// The host zone sends a CSP with style-src 'self', which blocks style="" attributes in markup.
// Templates write data-style instead; this applies them through CSSOM, which CSP allows.
function applyDataStyles(root = document) {
  root.querySelectorAll('[data-style]').forEach((el) => {
    el.getAttribute('data-style').split(';').forEach((decl) => {
      const i = decl.indexOf(':');
      if (i > 0) el.style.setProperty(decl.slice(0, i).trim(), decl.slice(i + 1).trim());
    });
    el.removeAttribute('data-style');
  });
}

let D = null;
let CASH = 'standard';  // default: best Sharpe and Calmar of the three presets (see ⑥)
try { const c = localStorage.getItem('cashPreset'); if (c) CASH = c; } catch (e) { /* ignore */ }
let charts = [];

function theme() {
  return {
    text: css('--text-primary'), text2: css('--text-secondary'), muted: css('--text-muted'),
    grid: css('--grid'), surface: css('--surface-1'), rec: css('--rec-band'),
    s1: css('--series-1'), s2: css('--series-2'), s3: css('--series-3'), s4: css('--series-4'), critical: css('--critical'),
  };
}

function baseAxis(t, extra = {}) {
  return {
    axisLine: { lineStyle: { color: t.grid } }, axisTick: { show: false },
    axisLabel: { color: t.muted, fontSize: 11 }, splitLine: { lineStyle: { color: t.grid } }, ...extra,
  };
}

function tooltip(t, extra = {}) {
  return {
    trigger: 'axis', backgroundColor: t.surface, borderColor: t.grid,
    textStyle: { color: t.text, fontSize: 12 }, axisPointer: { type: 'line', lineStyle: { color: t.muted } }, ...extra,
  };
}

function recessionArea(t) {
  return { silent: true, itemStyle: { color: t.rec }, data: D.recessions.map(([a, b]) => [{ xAxis: a }, { xAxis: b }]) };
}

function mk(id, optFn) {
  const c = echarts.init($(id), null, { renderer: 'canvas' });
  const render = () => c.setOption(optFn(theme()), true);
  render();
  charts.push({ c, render });
}

/* ---------------- shadow rules ---------------- */
function renderShadow() {
  const L = T(); const sh = D.shadow; const st = D.paper.stats;
  $('shLede').innerHTML = L.shLede(sh.adoption, sh.start);
  const nowStance = { standard: D.summary.stance, shadow_v3: sh.base_v3_now, shadow_B: sh.now.B, shadow_C: sh.now.C, spy: null };
  const usd = (v) => '$' + Math.round(v).toLocaleString('en-US');
  const n = (v, d = 2) => (v == null ? '—' : Number(v).toFixed(d));
  $('tblShadow').innerHTML = `<tr>${L.shCols.map((c) => `<th>${c}</th>`).join('')}</tr>`
    + ['standard', 'shadow_v3', 'shadow_B', 'shadow_C', 'spy'].map((k) => {
      const x = st[k]; const lv = x.live || {};
      const name = `${L.shNames[k]}${L.shDefs[k] ? `<br><span class="note">${L.shDefs[k]}</span>` : ''}`;
      return `<tr class="${k === 'standard' ? 'headline' : ''}"><td class="wrapcell">${name}</td><td>${nowStance[k] ? pill(L, nowStance[k]) : '—'}</td>
        <td>${usd(x.final_value)}</td><td>${pct(x.cagr, 2)}</td><td>${pct(x.max_dd, 1)}</td><td>${n(x.sharpe)}</td><td>${n(x.calmar)}</td>
        <td>${lv.days ?? 0}</td><td>${signed(lv.return || 0, 2)}</td><td>${n(lv.sharpe)}</td><td>${n(lv.calmar)}</td></tr>`;
    }).join('');
}

/* ---------------- core indicator + live record ---------------- */
function renderCore() {
  const L = T(); const lv = D.live; const bt = D.backtest; const w = bt.presets[CASH].weights;
  const cur = w[D.summary.stance];
  $('coreHead').innerHTML = `<div class="core-stat">${L.coreNow(pct(cur, 0), L.cashPresets[CASH], lv.end)}</div>
    <div class="core-stat">${L.coreLiveStat('$' + Math.round(D.paper.stats[CASH].final_value).toLocaleString('en-US'), L.cashPresets[CASH], lv.trading_days)}</div>`;
  const back = bt.stance_history.map(([d, s]) => [d, w[s] * 100]);
  const liveE = lv.exposure.map((r) => [r[0], r[1 + ['standard', 'moderate', 'mild'].indexOf(CASH)] * 100]);
  mk('chCore', (t) => ({
    legend: { top: 0, left: 0, textStyle: { color: t.text2, fontSize: 12 } },
    grid: { left: 44, right: 16, top: 34, bottom: 28 },
    tooltip: tooltip(t, { valueFormatter: (v) => (v == null ? '—' : v.toFixed(0) + '%') }),
    xAxis: baseAxis(t, { type: 'time', splitLine: { show: false } }),
    yAxis: baseAxis(t, { type: 'value', min: 0, max: 100, interval: 20, axisLabel: { color: t.muted, formatter: '{value}%' } }),
    dataZoom: [{ type: 'inside', zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false }],
    series: [
      { name: L.coreBack, type: 'line', step: 'end', showSymbol: false, data: back, lineStyle: { width: 1.5, color: t.muted }, itemStyle: { color: t.muted },
        areaStyle: { color: t.muted, opacity: 0.08 }, markArea: recessionArea(t),
        markLine: { silent: true, symbol: 'none', lineStyle: { color: t.s1, type: 'dashed' }, label: { color: t.s1, formatter: L.coreStart, position: 'insideEndTop' },
          data: [{ xAxis: lv.start }] } },
      { name: L.coreLive, type: 'line', step: 'end', showSymbol: true, symbolSize: 6, data: liveE, lineStyle: { width: 3, color: t.s1 }, itemStyle: { color: t.s1 } },
    ],
  }));
  // paper portfolio: $100k from the first month with data, three presets and buy & hold
  const P = D.paper; const keys = ['v4', 'standard', 'moderate', 'mild', 'spy']; const shadowKeys = ['shadow_v3', 'shadow_B', 'shadow_C'];
  const name = (k) => (k === 'v4' ? L.v4Paper : k === 'spy' ? L.liveSpy : L.shNames[k] && k.startsWith('shadow') ? L.shNames[k] : L.cashPresets[k]);
  const usd = (v) => '$' + Math.round(v).toLocaleString('en-US');
  mk('chLive', (t) => {
    const col = { v4: t.critical, standard: t.s1, moderate: t.s3, mild: t.s4, spy: t.s2, shadow_v3: t.text2, shadow_B: t.muted, shadow_C: t.text };
    return {
      grid: { left: 72, right: 16, top: 34, bottom: 28 },
      tooltip: tooltip(t, { valueFormatter: (v) => usd(v) }),
      xAxis: baseAxis(t, { type: 'time', splitLine: { show: false } }),
      yAxis: baseAxis(t, { type: 'log', min: (v) => v.min * 0.9, axisLabel: { color: t.muted, formatter: (v) => (v >= 1e6 ? '$' + v / 1e6 + 'M' : '$' + v / 1e3 + 'k') } }),
      dataZoom: [{ type: 'inside', zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false }],
      legend: { top: 0, left: 0, textStyle: { color: t.text2, fontSize: 12 }, selected: Object.fromEntries(shadowKeys.map((k) => [name(k), false])) },
      series: [...keys, ...shadowKeys].map((k, i) => ({
        name: name(k), type: 'line', showSymbol: false, data: P.curves[k],
        lineStyle: { width: k === CASH || k === 'v4' ? 3 : 1.5, color: col[k] || t.muted, type: k === 'spy' ? 'dashed' : k.startsWith('shadow') ? 'dotted' : 'solid' }, itemStyle: { color: col[k] || t.muted },
        ...(i === 0 ? { markArea: recessionArea(t), markLine: { silent: true, symbol: 'none', lineStyle: { color: t.muted, type: 'dashed' },
          label: { color: t.muted, formatter: L.coreStart, position: 'insideEndTop' }, data: [{ xAxis: P.live_start }] } } : {}),
      })),
    };
  });
  $('liveNote').textContent = L.liveNote(P);
  const st = P.stats;
  $('tblLive').innerHTML = `<tr>${L.liveCols.map((c) => `<th>${c}</th>`).join('')}</tr>`
    + keys.map((k) => { const x = st[k]; return `<tr class="${k === 'v4' ? 'headline' : ''}"><td>${name(k)}</td><td>${usd(x.final_value)}</td><td>${x.multiple}×</td>
      <td>${pct(x.cagr, 2)}</td><td>${pct(x.vol, 1)}</td><td>${x.sharpe}</td><td>${x.sortino ?? '—'}</td><td>${x.calmar ?? '—'}</td>
      <td>${pct(x.max_dd, 1)}</td><td>${L.monthsUnit(x.longest_dd_months, x.longest_dd_ongoing)}</td><td>${pct(x.current_dd, 1)}</td>
      <td>${x.worst_year[0]} ${pct(x.worst_year[1], 1)}</td></tr>`; }).join('');
  $('paperDD').textContent = L.paperDD(keys.map((k) => L.ddSpan(name(k), st[k].dd_peak.slice(0, 7), st[k].dd_trough.slice(0, 7), st[k].dd_recovered && st[k].dd_recovered.slice(0, 7))).join('；'));
  $('predNote').textContent = L.predNote(lv.predictions);
  $('reportsNote').innerHTML = L.reportsNote(lv.reports);
}

/* ---------------- quantified conclusion (hero) ---------------- */
function quantBlock(L, s, pr, w) {
  const a = D.scorecard.analog; const boot = D.audit.bootstrap; const sc = D.scenarios; const o = D.outlook;
  const ci = a.stance === 'offensive' && !a.shock ? boot.offensive_p_up.map((x) => pct(x, 0)).join('–') : null;
  const f = sc.fan; const anchor = sc.anchor; const rp = ruleParams();
  // equity / cash bar with the preset's three stance levels marked
  const ticks = ['defensive', 'balanced', 'offensive'].map((k) => `<span class="q-tick ${k === s.stance ? 'cur' : ''}" data-style="left:${pr.weights[k] * 100}%">${L.qTick(L.stance[k], pct(pr.weights[k], 0))}</span>`).join('');
  const bar = `<div class="q-bar"><div class="q-eq" data-style="width:${w * 100}%">${L.qEquity(pct(w, 0))}</div><div class="q-cash">${L.qCash(pct(1 - w, 0))}</div></div><div class="q-ticks">${ticks}</div>`;
  const tile = (k, v, d) => `<div class="q-tile"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;
  const tiles = [
    tile(L.qUp, pct(a.p_pos, 0), L.qUpD2(ci, a.episodes, pct(sc.p_up_12m, 0))),
    tile(L.qMed, f.p50[12].toFixed(0), L.qMedD(signed(f.p50[12] / anchor - 1, 1), f.p5[12].toFixed(0), f.p95[12].toFixed(0))),
    tile(L.qDD, pct(a.p_dd10, 0), L.qDDD2(pct(sc.p_drawdown_10, 0))),
    tile(L.qRec, pct(s.recession_prob, 1), L.qRecD(pct(rp.lo, 0))),
  ].join('');
  const segs = SC.map((k) => `<div class="q-seg sc-${k}" data-style="width:${sc.posterior[k] * 100}%" title="${L.sc[k]} ${pct(sc.posterior[k], 0)}"></div>`).join('');
  const legend = SC.map((k) => `<span><i class="sw sc-${k}"></i>${L.sc[k]} ${pct(sc.posterior[k], 0)}</span>`).join('');
  const c = o.shock.cpi.horizons.filter((h) => h.mom_needed != null).slice(-1)[0];
  const dist = [
    L.distTrend(pct(-o.trend.pct_to_threshold / 100, 1), o.trend.threshold, rp.confirm),
    L.distP(pct(s.recession_prob, 1), pct(rp.lo, 0)),
    L.distShock(o.shock.on, c ? `${c.mom_needed}%` : '—'),
  ].map((x) => `<li>${x}</li>`).join('');
  return `<div class="quant"><h4>${L.qH}</h4>${bar}<div class="q-tiles">${tiles}</div>
    <div class="q-sc"><div class="q-sch">${L.qScen}</div><div class="q-stack">${segs}</div><div class="q-legend">${legend}</div></div>
    <div class="q-dist"><div class="q-sch">${L.qDist}</div><ul>${dist}</ul></div><p class="note">${L.qSources}</p></div>`;
}

/* ---------------- hero + KPIs ---------------- */
function renderHero() {
  const L = T(); const s = D.summary; const st = STANCE_STYLE[s.stance];
  const hero = $('hero');
  hero.style.setProperty('--stance', css(st.color));
  // WHAT: stance + cash share of the selected preset
  const pr = D.backtest.presets[CASH];
  const w = pr.weights[s.stance];
  // WHY 1: today's evidence
  const steps = D.recession.steps; const nOn = steps.filter((x) => x.on).length;
  const bt = D.backtest; const gap = (bt.spy_last / bt.spy_sma10 - 1);
  // WHY 2: what followed the same state historically; WHY 3: this preset's backtest
  const a = D.scorecard.analog; const boot = D.audit.bootstrap;
  const ci = a.stance === 'offensive' && !a.shock ? boot.offensive_p_up.map((x) => pct(x, 0)).join('–') : null;
  const crash = Object.fromEntries(D.scorecard.crashes.map((c) => [c.from.slice(0, 4), c]));
  hero.innerHTML = `
    <div class="hero-head">
      <div class="badge"><span class="ico" aria-hidden="true">${st.icon}</span>${L.stanceLabel}${LANG === 'zh' ? '：' : ': '}${L.stance[s.stance]}<span class="badge-v">${D.rule_schedule.active !== D.rule_schedule.next ? L.ruleSched(D.rule_schedule.active, D.rule_schedule.next, D.rule_schedule.effective) : L.ruleBadge(D.rule_version)}</span></div>
      <div class="cash-big">${L.heroCash(pct(1 - w, 0), pct(w, 0))}</div>
    </div>
    <p class="hero-text">${L.stanceText[s.stance]}</p>
    <div class="cashbar">${L.cashLabel} ${Object.keys(L.cashPresets).map((k) => `<button type="button" data-preset="${k}" class="${k === CASH ? 'sel' : ''}">${L.cashPresets[k]}</button>`).join('')}
      <span>${L.cashTable(Object.fromEntries(['offensive', 'balanced', 'defensive'].map((x) => [x, pct(1 - pr.weights[x], 0)])))}</span></div>
    ${quantBlock(L, s, pr, w)}
    <div class="why">
      <div class="why-col"><h4>${L.whyNowH}</h4><ul>
        <li>${L.whyP(pct(s.recession_prob), nOn, steps.length, pct(ruleParams().lo, 0))}</li>
        <li>${L.whyTrend(bt.spy_last, bt.spy_sma10, signed(gap, 1), s.trend_up)}</li>
        <li>${L.whyShock(s.shock, s.shock_detail)}</li></ul></div>
      <div class="why-col"><h4>${L.whySameH(L.stance[a.stance])}</h4>
        <div class="why-big">${L.whySameBig(pct(a.p_pos, 0), signed(a.f12_mean, 1))}</div>
        <div class="note">${L.whySameSmall(a.n, a.episodes, pct(a.p_dd10, 0), pct(a.worst_dd12, 0), ci)}</div></div>
      <div class="why-col"><h4>${L.whyBtH(L.cashPresets[CASH], bt.start, bt.end)}</h4>
        <div class="why-big">${L.whyBtBig(pct(pr.net.cagr), pct(pr.net.max_dd, 0))}</div>
        <div class="note">${L.whyBtSmall(pct(bt.buy_hold.cagr), pct(bt.buy_hold.max_dd, 0), pct(pr.dd_2008, 0), pct(crash['2007'].spy_dd, 0), pct(pr.dd_2022, 0), pct(crash['2021'].spy_dd, 0))}</div></div>
    </div>
    <p class="note">${L.stanceNote}</p>`;
  const last6 = D.clock.history.slice(-6).map((h) => L.phase[h[1]]).join('→');
  const k = [
    [L.kRec, pct(s.recession_prob), L.kRecD(pct(D.recession.prior), D.recession.asof)],
    [L.kClock, L.phase[s.clock_phase], L.kClockD(L.phaseHint[s.clock_phase], s.growth_yoy, s.infl_yoy, s.clock_asof, last6)],
    [L.kTrend, s.trend_up ? L.up : L.down, L.kTrendD(D.backtest.spy_last, D.backtest.spy_sma10)],
    [L.kShock, s.shock ? L.shockOn : L.shockOff, L.kShockD(s.shock_detail)],
    [L.kFed, L.fedLevel[D.fed_capacity.level], L.kFedD(D.fed_capacity)],
    [L.kCredit, (s.credit_gap > 0 ? '+' : '') + s.credit_gap + 'pp', L.kCreditD(s.credit_level, s.credit_asof)],
  ];
  $('kpis').innerHTML = k.map(([a, b, c]) => `<div class="kpi"><div class="k">${a}</div><div class="v">${b}</div><div class="d">${c}</div></div>`).join('');
  $('updated').textContent = L.updated(D.generated_utc);
}

/* ---------------- ① Bayes ---------------- */
function renderBayes() {
  const L = T(); const r = D.recession;
  const w = (p) => Math.min(100, p * 100 / 0.6);
  const rows = r.steps.map((s) => `
    <div class="step">
      <div>${L.sig[s.key]}</div>
      <span class="st ${s.on ? 'on' : ''}">${s.on ? L.on : L.off}</span>
      <div class="lr" title="${L.lrTitle(s.lr_on, s.lr_off)}">×${s.lr_used.toFixed(2)}</div>
      <div class="pwrap"><div class="pbar"><i data-style="width:${w(s.posterior_after)}%"></i></div>
      <div class="pv">${L.after(pct(s.posterior_after))}</div></div>
    </div>`).join('');
  $('bayesSteps').innerHTML = `
    <div class="steps">
      <div class="step head"><div>${L.colSignal}</div><div>${L.colState}</div><div>${L.colLR}</div><div>${L.colPost}</div></div>
      <div class="step"><div><b>${L.prior}</b></div><span></span><div class="lr"></div>
        <div class="pwrap"><div class="pbar"><i data-style="width:${w(r.prior)}%"></i></div><div class="pv">${pct(r.prior)}</div></div></div>
      ${rows}
    </div>
    <p class="note">${L.bayesNote(pct(r.posterior), pct(r.posterior_nb), pct(r.posterior_logit))}</p>`;
  const b = r.brier;
  $('brierNote').textContent = L.brier(b.ensemble, b.base_rate, ((1 - b.ensemble / b.base_rate) * 100).toFixed(0), r.n_recessions_in_sample);

  mk('chRecProb', (t) => ({
    grid: { left: 44, right: 16, top: 16, bottom: 28 },
    tooltip: tooltip(t, { valueFormatter: (v) => pct(v) }),
    xAxis: baseAxis(t, { type: 'time', splitLine: { show: false } }),
    yAxis: baseAxis(t, { type: 'value', max: 1, axisLabel: { color: t.muted, formatter: (v) => v * 100 + '%' } }),
    series: [{
      name: L.recProb, type: 'line', showSymbol: false, data: r.history, lineStyle: { width: 2, color: t.s1 },
      itemStyle: { color: t.s1 }, areaStyle: { color: t.s1, opacity: 0.08 }, markArea: recessionArea(t),
      markLine: { silent: true, symbol: 'none', lineStyle: { color: t.muted, type: 'dashed' },
        label: { color: t.muted, formatter: '{b}', position: 'insideStartTop' }, data: [{ yAxis: ruleParams().lo, name: L.lineOff(pct(ruleParams().lo, 0)) }, { yAxis: 0.5, name: L.lineDef }] },
    }],
  }));
}

/* ---------------- ② clock ---------------- */
function phaseBands(t) {
  const h = D.clock.history; const out = [];
  let start = h[0][0]; let cur = h[0][1];
  for (let i = 1; i <= h.length; i++) {
    if (i === h.length || h[i][1] !== cur) {
      out.push([{ xAxis: start, itemStyle: { color: t[PHASE_SLOT[cur]], opacity: 0.16 } }, { xAxis: h[i - 1][0] }]);
      if (i < h.length) { start = h[i][0]; cur = h[i][1]; }
    }
  }
  return out;
}

function renderClock() {
  const L = T();
  mk('chClock', (t) => ({
    grid: { left: 40, right: 16, top: 56, bottom: 56 },
    legend: { top: 0, left: 0, textStyle: { color: t.text2 }, data: [L.ipYoy, L.cpiYoy] },
    tooltip: tooltip(t, {
      formatter: (ps) => {
        const d = ps[0].axisValueLabel.slice(0, 7);
        const ph = D.clock.history.find((x) => x[0] === d);
        return `${d}${ph ? ' · ' + L.phase[ph[1]] : ''}<br>` + ps.map((p) => `${p.marker}${p.seriesName} ${p.value[1]}%`).join('<br>');
      },
    }),
    dataZoom: [{ type: 'slider', height: 18, bottom: 6, start: 60, borderColor: t.grid, textStyle: { color: t.muted } },
      { type: 'inside', zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false }],
    xAxis: baseAxis(t, { type: 'time', splitLine: { show: false } }),
    yAxis: baseAxis(t, { type: 'value', axisLabel: { color: t.muted, formatter: '{value}%' } }),
    series: [
      { name: L.ipYoy, type: 'line', showSymbol: false, data: D.clock.growth, lineStyle: { width: 2, color: t.text2 }, itemStyle: { color: t.text2 },
        markArea: { silent: true, data: phaseBands(t) } },
      { name: L.cpiYoy, type: 'line', showSymbol: false, data: D.clock.inflation, lineStyle: { width: 2, type: 'dashed', color: t.text }, itemStyle: { color: t.text } },
    ],
    graphic: [{
      type: 'group', left: 0, top: 28,
      children: PHASES.map((p, i) => ({
        type: 'group', x: i * (LANG === 'zh' ? 88 : 96), children: [
          { type: 'rect', shape: { width: 10, height: 10, r: 2 }, style: { fill: t[PHASE_SLOT[p]], opacity: 0.6 } },
          { type: 'text', x: 14, y: -1, style: { text: L.phase[p], fill: t.text2, fontSize: 11 } }],
      })),
    }],
  }));

  // phase table
  const rows = D.rotation.rows;
  const tick = [...new Set(rows.map((r) => r.ticker))];
  const cur = D.summary.clock_phase;
  const pos = css('--div-pos'); const neg = css('--div-neg');
  const cell = (r) => {
    if (!r) return '<td>—</td>';
    const a = Math.min(1, Math.abs(r.ann_excess) / 0.15);
    const bg = `color-mix(in oklab, ${r.ann_excess >= 0 ? pos : neg} ${Math.round(a * 55)}%, transparent)`;
    return `<td class="cell ${Math.abs(r.t) >= 2 ? 'sig' : ''}" data-style="background:${bg}" title="${L.cellTitle(r.t, r.n, pct(r.hit, 0))}">${signed(r.ann_excess)}<br><span class="note">t=${r.t}</span></td>`;
  };
  const spy = Object.fromEntries(D.rotation.spy.map((s) => [s.phase, s]));
  $('tblPhase').innerHTML = `
    <tr><th>${L.asset}</th>${PHASES.map((p) => `<th>${p === cur ? '▶ ' : ''}${L.phase[p]}<br><span class="note">${L.phaseHint[p]}</span></th>`).join('')}</tr>
    <tr><td><b>${L.spyAbs}</b></td>${PHASES.map((p) => `<td><b>${pct(spy[p].ann_ret)}</b><br><span class="note">n=${spy[p].n}</span></td>`).join('')}</tr>
    ${tick.map((tk) => `<tr><td>${tk} <span class="note">${L.tick[tk] || ''}</span></td>${PHASES.map((p) => cell(rows.find((r) => r.ticker === tk && r.phase === p))).join('')}</tr>`).join('')}`;

  // momentum table
  const m = D.momentum;
  const maxAbs = Math.max(...m.map((r) => Math.abs(r.rel6)));
  const bar = (v) => {
    const w = Math.round(Math.abs(v) / maxAbs * 60);
    return v >= 0
      ? `<span data-style="display:inline-block;width:60px"></span><span class="bar" data-style="width:${w}px;background:${pos}"></span>`
      : `<span data-style="display:inline-block;width:${60 - w}px"></span><span class="bar neg" data-style="width:${w}px;background:${neg}"></span><span data-style="display:inline-block;width:60px"></span>`;
  };
  $('tblMom').innerHTML = `
    <tr><th>${L.colSector}</th><th>${L.m3}</th><th>${L.m6}</th><th data-style="text-align:center">${L.m6bar}</th><th>${L.m12}</th><th>${L.aboveSma}</th></tr>
    ${m.map((r) => `<tr><td>${r.ticker} <span class="note">${L.tick[r.ticker] || ''}</span></td><td>${signed(r.rel3)}</td><td>${signed(r.rel6)}</td>
      <td data-style="text-align:left">${bar(r.rel6)}</td><td>${signed(r.rel12)}</td><td>${r.above_sma10 ? L.yes : L.no}</td></tr>`).join('')}`;
}

/* ---------------- ③ Fourier ---------------- */
function renderSpectrum() {
  const L = T();
  D.spectrum.forEach((s, i) => {
    mk('chSpec' + i, (t) => ({
      title: { text: L.specLabel[s.label], subtext: `${s.start} – ${s.end} · ${s.years} ${L.years} · AR(1) φ=${s.ar1_phi}`, left: 0, top: 0,
        textStyle: { color: t.text, fontSize: 13 }, subtextStyle: { color: t.muted, fontSize: 11 } },
      grid: { left: 52, right: 16, top: 78, bottom: 36 },
      legend: { top: 44, left: 0, textStyle: { color: t.text2, fontSize: 11 }, itemWidth: 16 },
      tooltip: tooltip(t, { formatter: (ps) => `${L.periodTip(ps[0].value[0])}<br>` + ps.map((p) => `${p.marker}${p.seriesName} ${p.value[1].toPrecision(3)}`).join('<br>') }),
      xAxis: baseAxis(t, { type: 'log', name: L.periodYears, nameLocation: 'middle', nameGap: 22, nameTextStyle: { color: t.muted }, min: 1.5, max: 60, logBase: 10, splitLine: { show: false } }),
      yAxis: baseAxis(t, { type: 'log', name: L.power, nameTextStyle: { color: t.muted } }),
      series: [
        { name: L.specObs, type: 'line', showSymbol: false, data: s.points.map((p) => [p.period, p.power]), lineStyle: { width: 2, color: t.s1 }, itemStyle: { color: t.s1 } },
        { name: L.spec95, type: 'line', showSymbol: false, data: s.points.map((p) => [p.period, p.local95]), lineStyle: { width: 2, type: 'dashed', color: t.s2 }, itemStyle: { color: t.s2 } },
        { name: L.specMed, type: 'line', showSymbol: false, data: s.points.map((p) => [p.period, p.null_median]), lineStyle: { width: 1.5, type: 'dotted', color: t.muted }, itemStyle: { color: t.muted } },
      ],
    }));
  });
  const sig = D.spectrum.flatMap((s) => s.significant_periods);
  $('specVerdict').innerHTML = (sig.length ? L.specSig(sig.join(', ')) : L.specNone)
    + `<br><span class="note">${L.specRes(D.spectrum[0].years, D.spectrum[0].resolvable_periods.join(' / '))}</span>`;
}

/* ---------------- ④ bands ---------------- */
function renderBands() {
  const L = T(); const b = D.bands.series;
  const keys = ['trend', 'medium', 'business', 'noise'];
  const n = keys.length;
  mk('chBands', (t) => {
    const h = 100 / n;
    return {
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      tooltip: tooltip(t, { valueFormatter: (v) => (typeof v === 'number' ? v.toFixed(2) : v) }),
      dataZoom: [{ type: 'inside', xAxisIndex: [0, 1, 2, 3], start: 40, zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false }],
      grid: keys.map((_, i) => ({ left: 48, right: 16, top: `${i * h + 5}%`, height: `${h - 10}%` })),
      title: keys.map((k, i) => ({ text: L.band[k], left: 48, top: `${i * h + 0.5}%`, textStyle: { color: t.text2, fontSize: 12, fontWeight: 500 } })),
      xAxis: keys.map((_, i) => baseAxis(t, { type: 'time', gridIndex: i, splitLine: { show: false }, axisLabel: { show: i === n - 1, color: t.muted } })),
      yAxis: keys.map((_, i) => baseAxis(t, { type: 'value', gridIndex: i, scale: true, splitNumber: 2 })),
      series: keys.map((k, i) => ({
        name: L.band[k], type: 'line', xAxisIndex: i, yAxisIndex: i, showSymbol: false, data: b[k],
        lineStyle: { width: k === 'noise' ? 1 : 2, color: t.s1 }, itemStyle: { color: t.s1 }, markArea: recessionArea(t),
      })).concat([{
        name: L.realtime, type: 'line', xAxisIndex: 2, yAxisIndex: 2, showSymbol: false,
        data: D.bands.reliability.realtime.map(([d, v]) => [d, v * 100]), lineStyle: { width: 1.5, type: 'dashed', color: t.s2 }, itemStyle: { color: t.s2 },
      }]),
    };
  });
  const r = D.bands.reliability; const s = D.summary;
  $('relNote').innerHTML = L.relNote(r.n, pct(r.sign_agreement, 0), pct(r.slope_agreement, 0), r.corr,
    s.business_band_now, (s.business_band_slope > 0 ? '+' : '') + s.business_band_slope);
}

/* ---------------- ⑤ long cycle ---------------- */
function renderLong() {
  const L = T();
  mk('chCredit', (t) => ({
    title: { text: L.debtGdp, left: 0, textStyle: { color: t.text, fontSize: 13 } },
    legend: { top: 22, left: 0, textStyle: { color: t.text2, fontSize: 11 } },
    grid: { left: 44, right: 16, top: 56, bottom: 28 },
    tooltip: tooltip(t, { valueFormatter: (v) => v + '%' }),
    xAxis: baseAxis(t, { type: 'time', splitLine: { show: false } }),
    yAxis: baseAxis(t, { type: 'value' }),
    series: [
      { name: L.privCredit, type: 'line', showSymbol: false, data: D.credit.level, lineStyle: { width: 2, color: t.s1 }, itemStyle: { color: t.s1 }, markArea: recessionArea(t) },
      { name: L.fedDebt, type: 'line', showSymbol: false, data: D.credit.fed_debt, lineStyle: { width: 2, color: t.s2 }, itemStyle: { color: t.s2 } },
    ],
  }));
  mk('chGap', (t) => ({
    title: { text: L.gapTitle, left: 0, textStyle: { color: t.text, fontSize: 13 } },
    grid: { left: 44, right: 16, top: 40, bottom: 28 },
    tooltip: tooltip(t, { valueFormatter: (v) => v + 'pp' }),
    xAxis: baseAxis(t, { type: 'time', splitLine: { show: false } }),
    yAxis: baseAxis(t, { type: 'value' }),
    series: [{
      name: L.gap, type: 'bar', data: D.credit.gap, barWidth: '70%',
      itemStyle: { color: (p) => (p.value[1] >= 0 ? css('--div-neg') : css('--div-pos')) },
      markArea: recessionArea(t),
      markLine: { silent: true, symbol: 'none', lineStyle: { color: t.muted, type: 'dashed' }, label: { color: t.muted, formatter: '{b}', position: 'insideStartTop' },
        data: [{ yAxis: 10, name: L.bisWarn }, { yAxis: 2, name: '+2' }] },
    }],
  }));
}

/* ---------------- ⑥ backtest ---------------- */
function renderBacktest() {
  const L = T(); const bt = D.backtest;
  mk('chBT', (t) => ({
    legend: { top: 0, left: 0, textStyle: { color: t.text2 } },
    grid: { left: 48, right: 16, top: 40, bottom: 28 },
    tooltip: tooltip(t, { valueFormatter: (v) => v.toFixed(2) + '×' }),
    xAxis: baseAxis(t, { type: 'time', splitLine: { show: false } }),
    yAxis: baseAxis(t, { type: 'log', min: (v) => v.min * 0.9, axisLabel: { color: t.muted, formatter: (v) => v + '×' } }),
    series: [
      { name: `${L.btStrat} · ${L.cashPresets[CASH]}`, type: 'line', showSymbol: false, data: bt.presets[CASH].equity, lineStyle: { width: 2, color: t.s1 }, itemStyle: { color: t.s1 }, markArea: recessionArea(t) },
      { name: L.btBH, type: 'line', showSymbol: false, data: bt.equity_buy_hold, lineStyle: { width: 2, color: t.s2 }, itemStyle: { color: t.s2 } },
    ],
  }));
  const a = bt.presets[CASH].net; const b = bt.buy_hold;
  const row = (name, x) => `<tr><td>${name}</td><td>${pct(x.cagr)}</td><td>${pct(x.vol)}</td><td>${pct(x.max_dd)}</td><td>${x.sharpe_like}</td><td>${(x.cagr / Math.abs(x.max_dd)).toFixed(2)}</td></tr>`;
  $('tblBT').innerHTML = `<tr><th>${bt.start} – ${bt.end}</th><th>${L.cagr}</th><th>${L.vol}</th><th>${L.mdd}</th><th>${L.sharpe}</th><th>${L.calmar}</th></tr>${row(`${L.btStrat} · ${L.cashPresets[CASH]}${L.netTag}`, a)}${row(L.btBH, b)}`;
}

/* ---------------- outlook: what would change the stance ---------------- */
// Mirrors pipeline/rules.py stance_v2(); used only for "what if" displays.
function ruleParams() {
  const r = D.rule_schedule; const p = r.params[r.active] || {};
  return { lo: p.lo ?? 0.25, mid: p.mid ?? 0.3, confirm: p.confirm ?? 1 };
}
function stanceOf(p, trendUp, shock) {
  const { lo, mid } = ruleParams();
  if (!trendUp && (p >= mid || shock)) return 'defensive';
  if (p >= lo || shock || !trendUp) return 'balanced';
  return 'offensive';
}

function pill(L, st) {
  return `<span class="pill ${st}">${STANCE_STYLE[st].icon} ${L.stance[st]}</span>`;
}

function renderOutlook() {
  const L = T(); const o = D.outlook; const s = D.summary;
  const cur = o.stance; const up = s.trend_up; const sh = o.shock.on;
  $('olLede').innerHTML = L.olLede(cur, { icon: STANCE_STYLE[cur].icon, name: L.stance[cur], prob: pct(o.p) });
  const fmt = (w) => (w.unit === 'ratio' ? pct(w.value, 0) : w.value + (w.unit === 'pp' ? 'pp' : w.unit === '%' ? '%' : ''));
  const fmtThr = (w) => (w.unit === 'ratio' ? pct(w.threshold, 0) : w.threshold + (w.unit === 'pp' ? 'pp' : w.unit === '%' ? '%' : ''));
  const rows = [];
  // single signals, most influential first; skip ones already on
  [...o.whatif].filter((w) => !w.on).sort((a, b) => b.p_if_flipped - a.p_if_flipped).slice(0, 3).forEach((w) => {
    const res = stanceOf(w.p_if_flipped, up, sh);
    rows.push([L.sig[w.key], fmt(w), L.olTrigSig(fmtThr(w), w.direction, pct(w.p_if_flipped, 0)), res]);
  });
  o.whatif_pairs.slice(0, 1).forEach((pr) => {
    rows.push([L.olPair(L.sig[pr.keys[0]], L.sig[pr.keys[1]]), '—', L.olPairTrig(pct(pr.p, 0)), stanceOf(pr.p, up, sh)]);
  });
  const tr = o.trend;
  rows.push([L.olTrend, L.olTrendNow(tr.price), L.olTrendTrig(tr.threshold, tr.pct_to_threshold, tr.month), stanceOf(o.p, !up, sh)]);
  rows.push([L.olShock, L.olShockNow(o.shock), sh ? L.olShockOnNow : L.olShockTrig(o.shock.cpi), stanceOf(o.p, up, !sh)]);
  $('tblOutlook').innerHTML = `<tr>${L.olCols.map((c) => `<th>${c}</th>`).join('')}</tr>`
    + rows.map(([a, b, c, res]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td><td class="res">${res === cur ? '<span class="note">=</span> ' : '→ '}${pill(L, res)}</td></tr>`).join('');
  const curve = o.whatif.find((w) => w.key === 'curve');
  $('olHike').innerHTML = L.olHike(o.shock, curve.value, pct(curve.p_if_flipped, 0), pill(L, stanceOf(curve.p_if_flipped, up, sh)));
}

/* ---------------- stance timeline ---------------- */
function renderTimeline() {
  const L = T(); const tl = D.timeline;
  const rows = tl.rows.map((r) => Object.fromEntries(tl.cols.map((c, i) => [c, r[i]])));
  const byDate = Object.fromEntries(rows.map((r) => [r.date, r]));
  const stColor = { offensive: css('--good'), balanced: css('--warning'), defensive: css('--critical') };
  const bands = [];
  let start = rows[0]; let prev = rows[0];
  rows.slice(1).concat([null]).forEach((r) => {
    if (!r || r.stance !== start.stance) {
      bands.push([{ xAxis: start.date, itemStyle: { color: stColor[start.stance], opacity: 0.16 } }, { xAxis: r ? r.date : prev.date }]);
      start = r;
    }
    if (r) prev = r;
  });
  const shockBands = rows.map((r, i) => [r, rows[i + 1]]).filter(([r, n]) => r.shock && n).map(([r, n]) => [{ xAxis: r.date }, { xAxis: n.date }]);
  const events = Object.entries(L.tlEvents).filter(([d]) => byDate[d]);
  mk('chTimeline', (t) => ({
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    tooltip: tooltip(t, {
      formatter: (ps) => { const r = byDate[ps[0].axisValueLabel.slice(0, 7)]; return r ? L.tlTip(r, L) : ''; },
    }),
    dataZoom: [{ type: 'slider', xAxisIndex: [0, 1, 2], height: 18, bottom: 4, borderColor: t.grid, textStyle: { color: t.muted } },
      { type: 'inside', xAxisIndex: [0, 1, 2], zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false }],
    grid: [{ left: 52, right: 16, top: 34, height: '46%' }, { left: 52, right: 16, top: '60%', height: '12%' }, { left: 52, right: 16, top: '77%', height: '12%' }],
    xAxis: [0, 1, 2].map((i) => baseAxis(t, { type: 'time', gridIndex: i, splitLine: { show: false }, axisLabel: { show: i === 2, color: t.muted } })),
    yAxis: [
      baseAxis(t, { type: 'log', gridIndex: 0, min: (v) => v.min * 0.9 }),
      baseAxis(t, { type: 'value', gridIndex: 1, max: 1, splitNumber: 2, axisLabel: { color: t.muted, formatter: (v) => v * 100 + '%' } }),
      baseAxis(t, { type: 'value', gridIndex: 2, splitNumber: 2, axisLabel: { color: t.muted, formatter: '{value}%' } }),
    ],
    graphic: [{
      type: 'group', left: 52, top: 6,
      children: ['offensive', 'balanced', 'defensive'].map((k, i) => ({
        type: 'group', x: i * (LANG === 'zh' ? 84 : 110), children: [
          { type: 'rect', shape: { width: 12, height: 12, r: 2 }, style: { fill: stColor[k], opacity: 0.45 } },
          { type: 'text', x: 16, y: 0, style: { text: `${STANCE_STYLE[k].icon} ${L.stance[k]}`, fill: t.text2, fontSize: 12 } }],
      })),
    }],
    series: [
      { name: L.tlPrice, type: 'line', xAxisIndex: 0, yAxisIndex: 0, showSymbol: false, data: rows.map((r) => [r.date, r.spy]),
        lineStyle: { width: 2, color: t.text }, itemStyle: { color: t.text },
        markArea: { silent: true, data: bands },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: t.muted, type: 'dashed', width: 1 },
          label: { color: t.text2, fontSize: 11, formatter: '{b}', position: 'insideEndTop' },
          data: events.map(([d, name]) => ({ xAxis: d, name })) } },
      { name: L.tlSma, type: 'line', xAxisIndex: 0, yAxisIndex: 0, showSymbol: false, data: rows.map((r) => [r.date, r.sma10]),
        lineStyle: { width: 1, type: 'dashed', color: t.muted }, itemStyle: { color: t.muted } },
      { name: L.tlP, type: 'line', xAxisIndex: 1, yAxisIndex: 1, showSymbol: false, data: rows.map((r) => [r.date, r.p]),
        lineStyle: { width: 1.5, color: t.s1 }, itemStyle: { color: t.s1 }, areaStyle: { color: t.s1, opacity: 0.1 },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: t.muted, type: 'dotted' }, label: { show: false },
          data: [{ yAxis: 0.25 }, { yAxis: 0.5 }] } },
      { name: L.tlFF, type: 'line', xAxisIndex: 2, yAxisIndex: 2, showSymbol: false, data: rows.map((r) => [r.date, r.ff]),
        lineStyle: { width: 1.5, color: t.s1 }, itemStyle: { color: t.s1 },
        markArea: { silent: true, itemStyle: { color: css('--critical'), opacity: 0.35 }, data: shockBands } },
      { name: L.tlCPI, type: 'line', xAxisIndex: 2, yAxisIndex: 2, showSymbol: false, data: rows.map((r) => [r.date, r.cpi]),
        lineStyle: { width: 1.5, type: 'dashed', color: t.s2 }, itemStyle: { color: t.s2 } },
    ],
  }));
  const bs = D.scorecard.by_stance;
  const tot = Object.values(bs).reduce((a, x) => a + x.n, 0);
  $('tblTlStats').innerHTML = `<tr>${L.tlStatsCols.map((c) => `<th>${c}</th>`).join('')}</tr>`
    + ['offensive', 'balanced', 'defensive'].map((k) => `<tr><td>${pill(L, k)}</td><td>${pct(bs[k].n / tot, 0)}</td>
      <td>${signed(bs[k].f12_mean)}</td><td>${pct(bs[k].p_pos, 0)}</td><td>${pct(bs[k].worst_dd12, 0)}</td></tr>`).join('');
}

/* ---------------- QQQ backtest ---------------- */
function renderQQQ() {
  const L = T(); const q = D.backtest_qqq;
  $('qqqNote').textContent = L.qqqNote(q.start, q.end);
  const show = ['spy_bh', 'spy_rule', 'qqq_bh', 'qqq_rule'];
  mk('chQQQ', (t) => {
    const col = { spy_bh: t.s2, spy_rule: t.s1, qqq_bh: t.s4, qqq_rule: t.s3 };
    return {
      legend: { top: 0, left: 0, textStyle: { color: t.text2, fontSize: 11 } },
      grid: { left: 48, right: 16, top: 52, bottom: 28 },
      tooltip: tooltip(t, { valueFormatter: (v) => v.toFixed(2) + '×' }),
      xAxis: baseAxis(t, { type: 'time', splitLine: { show: false } }),
      yAxis: baseAxis(t, { type: 'log', min: (v) => v.min * 0.9, axisLabel: { color: t.muted, formatter: (v) => v + '×' } }),
      series: show.map((k) => ({ name: L.qqqNames[k], type: 'line', showSymbol: false, data: q.curves[k],
        lineStyle: { width: 2, color: col[k], type: k.endsWith('bh') ? 'dashed' : 'solid' }, itemStyle: { color: col[k] },
        markArea: k === 'spy_rule' ? recessionArea(t) : undefined })),
    };
  });
  $('tblQQQ').innerHTML = `<tr>${L.qqqCols.map((c) => `<th>${c}</th>`).join('')}</tr>`
    + q.rows.map((r) => `<tr><td>${L.qqqNames[r.key]}</td><td>${pct(r.cagr)}</td><td>${pct(r.vol)}</td><td>${pct(r.max_dd)}</td>
      <td>${r.sharpe_like}</td><td>${pct(r.dd_2000, 0)}</td><td>${pct(r.dd_2008, 0)}</td><td>${pct(r.dd_2020, 0)}</td>
      <td>${pct(r.dd_2022, 0)}</td><td>${r.final_multiple}×</td></tr>`).join('');
}

/* ---------------- sell-off panel ---------------- */
function renderDips() {
  const L = T(); const rows = D.dip_episodes; const w = D.rescue_watch;
  $('tblWatch').innerHTML = `<tr>${L.watchCols.map((c) => `<th>${c}</th>`).join('')}</tr>`
    + L.watchRows(w).map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="wrapcell">${r[2]}</td></tr>`).join('');
  const f = (v) => (v == null ? '—' : signed(v, 0));
  $('tblDips').innerHTML = `<tr>${L.dipCols.map((c) => `<th>${c}</th>`).join('')}</tr>`
    + rows.map((r) => `<tr class="${r.next12 != null && r.next12 < 0 ? 'bad' : ''}"><td>${r.month}</td><td>${r.peak}</td><td>${r.cpi}%</td><td>${r.fed_cut}</td>
      <td>${r.y2_chg3}</td><td>${r.credit_chg6}</td><td>${r.recession ? '✓' : ''}</td><td>${f(r.next3)}</td><td>${f(r.next6)}</td><td><b>${f(r.next12)}</b></td><td>${pct(r.further_dd, 0)}</td></tr>`).join('');
  const done = rows.filter((r) => r.next12 != null);
  const bad = done.filter((r) => r.next12 < 0).map((r) => r.month).join(', ');
  $('dipSummary').textContent = L.dipSummary(done.length, done.filter((r) => r.next12 > 0).length, bad);
}

/* ---------------- scenarios (Bayes) + fan chart ---------------- */
const SC = ['calm', 'v_shock', 'grind', 'recession'];
const SC_SLOT = { calm: 's1', v_shock: 's2', grind: 's3', recession: 's4' };
function renderScenarios() {
  const L = T(); const s = D.scenarios;
  mk('chScProb', (t) => ({
    legend: { top: 0, left: 0, textStyle: { color: t.text2, fontSize: 11 } },
    grid: { left: 110, right: 40, top: 30, bottom: 20 },
    tooltip: tooltip(t, { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => pct(v) }),
    xAxis: baseAxis(t, { type: 'value', max: 1, axisLabel: { color: t.muted, formatter: (v) => v * 100 + '%' } }),
    yAxis: baseAxis(t, { type: 'category', inverse: true, data: SC.map((k) => L.sc[k]), axisLabel: { color: t.text2, fontSize: 11 } }),
    series: [
      { name: L.scPrior, type: 'bar', data: SC.map((k) => s.prior[k]), barGap: '10%', itemStyle: { color: t.muted, borderRadius: [0, 4, 4, 0] } },
      { name: L.scPost, type: 'bar', data: SC.map((k) => ({ value: s.posterior[k], itemStyle: { color: t[SC_SLOT[k]], borderRadius: [0, 4, 4, 0] } })),
        label: { show: true, position: 'right', color: t.text2, fontSize: 11, formatter: (p) => pct(p.value, 0) } },
    ],
  }));
  const f = s.fan; const months = [...Array(13).keys()];
  const x = months.map((m) => (m === 0 ? L.fanNow : `+${m}`));
  // Fan chart: median line + 50% and 90% ranges (stacked areas on an invisible lower edge).
  // Only three legend entries; per-scenario numbers live in the table below.
  mk('chFan', (t) => ({
    legend: { top: 0, left: 0, textStyle: { color: t.text2, fontSize: 12 }, data: [L.fanMed, L.fanBand50, L.fanBand90] },
    grid: { left: 56, right: 24, top: 36, bottom: 28 },
    tooltip: tooltip(t, {
      formatter: (ps) => {
        const i = ps[0].dataIndex;
        return `<b>${x[i]}</b><br>${L.fanMed} ${f.p50[i].toFixed(0)}<br>${L.fanBand50} ${f.p25[i].toFixed(0)} – ${f.p75[i].toFixed(0)}<br>${L.fanBand90} ${f.p5[i].toFixed(0)} – ${f.p95[i].toFixed(0)}`;
      },
    }),
    xAxis: baseAxis(t, { type: 'category', data: x, boundaryGap: false, splitLine: { show: false } }),
    yAxis: baseAxis(t, { type: 'value', scale: true, axisLabel: { color: t.muted, formatter: (v) => v.toFixed(0) } }),
    series: [
      { name: 'lo90', type: 'line', data: f.p5, stack: 'b90', symbol: 'none', lineStyle: { opacity: 0 }, silent: true },
      { name: L.fanBand90, type: 'line', data: f.p95.map((v, i) => v - f.p5[i]), stack: 'b90', symbol: 'none',
        lineStyle: { opacity: 0 }, areaStyle: { color: t.s1, opacity: 0.12 }, itemStyle: { color: t.s1, opacity: 0.35 } },
      { name: 'lo50', type: 'line', data: f.p25, stack: 'b50', symbol: 'none', lineStyle: { opacity: 0 }, silent: true },
      { name: L.fanBand50, type: 'line', data: f.p75.map((v, i) => v - f.p25[i]), stack: 'b50', symbol: 'none',
        lineStyle: { opacity: 0 }, areaStyle: { color: t.s1, opacity: 0.25 }, itemStyle: { color: t.s1, opacity: 0.6 } },
      { name: L.fanMed, type: 'line', data: f.p50, symbol: 'none', lineStyle: { width: 2.5, color: t.s1 }, itemStyle: { color: t.s1 },
        endLabel: { show: true, color: t.text2, fontSize: 11, formatter: (p) => p.value.toFixed(0) },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: t.muted, type: 'dashed' },
          label: { color: t.muted, fontSize: 11, formatter: `${L.fanNow} {c}`, position: 'insideStartTop' },
          data: [{ yAxis: s.anchor }] } },
    ],
  }));
  const a = s.anchor;
  $('scSummary').textContent = L.scSummary({ med: f.p50[12].toFixed(0), medr: signed(f.p50[12] / a - 1, 1), lo: f.p5[12].toFixed(0), hi: f.p95[12].toFixed(0), pdd: pct(s.p_drawdown_10, 0) });
  $('tblScen').innerHTML = `<tr>${L.scCols.map((c) => `<th>${c}</th>`).join('')}</tr>`
    + SC.map((k) => { const o = s.outcomes[k]; return `<tr><td>${L.sc[k]}</td><td>${pct(s.prior[k], 0)}</td><td><b>${pct(s.posterior[k], 0)}</b></td>
      <td>${signed(o.r12_median, 0)} ${LANG === 'zh' ? '（' : '('}${signed(o.r12_p10, 0)} – ${signed(o.r12_p90, 0)}${LANG === 'zh' ? '）' : ')'}</td><td>${pct(o.maxdd_median, 0)}</td>
      <td>${o.n_months} / ${o.n_years}${LANG === 'zh' ? ' 年' : ' yrs'}</td><td>${o.examples.join(', ')}</td></tr>`; }).join('');
  $('tblScEv').innerHTML = `<tr>${L.scEvCols.map((c) => `<th>${c}</th>`).join('')}${SC.map((k) => `<th>${L.sc[k]}</th>`).join('')}</tr>`
    + s.steps.map((st) => `<tr><td>${L.scFeat[st.feature]}</td><td>${st.on ? L.yn.y : L.yn.n}</td>${SC.map((k) => { const v = st.lr[k]; return `<td class="${v >= 1.25 || v <= 0.8 ? 'sig' : ''}">×${v.toFixed(2)}</td>`; }).join('')}</tr>`).join('');
  $('scNote').textContent = L.scNote({ imp: pct(s.oos_logloss.improvement, 1), tau: s.tau, sample: s.sample });
}

/* ---------------- walk-forward + drawdown episodes ---------------- */
function renderWalkForward() {
  const L = T(); const w = D.walkforward; const d = D.drawdowns;
  $('wfLede').textContent = L.wfLede(w);
  const isC = (g) => g.confirm === w.chosen.confirm && g.lo === w.chosen.lo && g.dd_guard === w.chosen.dd_guard;
  $('tblWF').innerHTML = `<tr>${L.wfCols.map((c) => `<th>${c}</th>`).join('')}</tr>`
    + w.grid.map((g) => `<tr class="${isC(g) ? 'headline' : ''}"><td>${g.confirm}</td><td>${pct(g.lo, 0)}</td><td>${g.dd_guard ? L.yn.y : L.yn.n}</td>
      <td>${g.train_sharpe_exact.toFixed(3)}</td><td>${pct(g.train.cagr)}</td><td>${pct(g.train.max_dd, 0)}</td>
      <td>${g.test_sharpe_exact.toFixed(3)}</td><td>${pct(g.test.cagr)}</td><td>${pct(g.test.max_dd, 0)}</td><td>${g.switches_per_year}</td></tr>`).join('');
  $('wfVerdict').textContent = L.wfVerdict(w, D.rule_schedule.effective);
  $('tblDD').innerHTML = `<tr>${L.ddCols.map((c) => `<th>${c}</th>`).join('')}</tr>`
    + d.rows.map((r) => `<tr><td>${r.peak}</td><td>${r.trough}</td><td>${pct(r.depth, 0)}</td><td>${r.months_down}</td><td>${r.months_to_recover ?? '—'}</td>
      <td class="${r.cpi_at_peak >= 3 ? 'sig' : ''}">${r.cpi_at_peak}%</td><td>${r.fed_cut}</td><td>${r.recession ? '✓' : ''}</td></tr>`).join('');
  $('ddNote').textContent = L.ddNote(d.median_total_months);
}

/* ---------------- analogs ---------------- */
function renderAnalogs() {
  const L = T(); const a = D.analogs;
  const rows = D.timeline.rows.map((r) => Object.fromEntries(D.timeline.cols.map((c, i) => [c, r[i]])));
  const by = Object.fromEntries(rows.map((r) => [r.date, r]));
  const after = rows.filter((r) => r.date >= '2000-03' && r.date <= '2003-12');
  const firstNonOff = after.find((r) => r.stance !== 'offensive');
  const firstDef = after.find((r) => r.stance === 'defensive');
  const defEnd = firstDef ? after.filter((r) => r.date >= firstDef.date).find((r) => r.stance !== 'defensive') : null;
  $('anRecon').innerHTML = L.anRecon2({ top: by['2000-03'] ? L.stance[by['2000-03'].stance] : '—', bal: firstNonOff ? firstNonOff.date : '—',
    def: firstDef ? firstDef.date : '—', end: defEnd ? defEnd.date : '—', p0: firstDef ? firstDef.spy.toFixed(0) : '—', p1: defEnd ? defEnd.spy.toFixed(0) : '—',
    rule: D.rule_schedule.active });
  $('anLede').textContent = L.anLede(a.sample);
  const c = a.current; const p0 = (x) => pct(x, 0);
  const row = (label, r, cur) => `<tr class="${cur ? 'cur' : ''}"><td>${label}</td><td>${cur ? '—' : r.distance}</td><td>${r.ff}%</td><td>${r.cpi}%</td>
    <td>${r.unrate}%</td><td>${r.term}pp</td><td>${Math.round(r.spx_36m)}%</td>
    <td>${cur ? '?' : signed(r.fwd6, 0)}</td><td>${cur ? '?' : signed(r.fwd9, 0)}</td><td>${cur ? '?' : signed(r.fwd12, 0)}</td><td>${cur ? '?' : pct(r.maxdd12, 0)}</td></tr>`;
  $('tblAnalogs').innerHTML = `<tr>${L.anCols.map((x) => `<th>${x}</th>`).join('')}</tr>`
    + row(L.anCur, c, true) + a.rows.map((r) => row(r.month, r, false)).join('');
  const f = (x) => ({ median: signed(x.median, 0), share_up: p0(x.share_up) });
  $('anSummary').textContent = L.anSummary({ fwd6: f(a.summary.fwd6), fwd9: f(a.summary.fwd9), fwd12: f(a.summary.fwd12) });
}

/* ---------------- sector buying test ---------------- */
function renderSectorTest() {
  const L = T(); const t = D.sector_test;
  $('secLede').textContent = L.secLede(t.start);
  const cell = (look, hold) => { const g = t.grid.find((x) => x.lookback === look && x.hold === hold); return `<td class="${Math.abs(g.t) >= 2 ? 'sig' : ''}">${signed(g.spread, 1)}<br><span class="note">t=${g.t}</span></td>`; };
  $('tblSector').innerHTML = `<tr>${L.secCols.map((x) => `<th>${x}</th>`).join('')}</tr>`
    + [1, 6, 12, 36].map((lk) => `<tr><td>${L.secLook(lk)}</td>${[1, 3, 6, 12].map((h) => cell(lk, h)).join('')}</tr>`).join('');
  const b = t.by_stance; const f = (x) => (x.spread == null ? '—' : LANG === 'zh' ? `${signed(x.spread, 1)}（${x.years} 年）` : `${signed(x.spread, 1)} (${x.years} yrs)`);
  $('secByStance').innerHTML = L.secByStance({ offensive: f(b.offensive), balanced: f(b.balanced), defensive: f(b.defensive) });
}

/* ---------------- cash presets ---------------- */
function renderPresets() {
  const L = T(); const bt = D.backtest;
  $('tblPresets').innerHTML = `<tr>${L.presetCols.map((x) => `<th>${x}</th>`).join('')}</tr>`
    + Object.entries(bt.presets).map(([k, v]) => `<tr class="${k === CASH ? 'headline' : ''}"><td>${L.cashPresets[k]}</td><td>${pct(v.gross.cagr)}</td><td>${pct(v.net.cagr)}</td>
      <td>${pct(v.gross.max_dd)}</td><td>${v.gross.sharpe_like}</td><td>${pct(v.dd_2008, 0)}</td><td>${pct(v.dd_2022, 0)}</td><td>${pct(v.avg_equity, 0)}</td></tr>`).join('');
  $('presetNote').textContent = L.presetNote(bt.cost_bps);
}

/* ---------------- since 2020 ---------------- */
function renderSince2020() {
  const L = T(); const s = D.since_2020;
  const rows = [];
  ['pre', 'post'].forEach((per) => {
    const P = s.periods[per];
    rows.push(`<tr><th colspan="5">${L.s20Period[per]}</th></tr>`);
    ['v1', 'v2', 'trend_only', 'buy_hold'].forEach((k) => {
      const x = P[k];
      rows.push(`<tr class="${k === 'v2' ? 'headline' : ''}"><td>${L.s20Rows[k]}</td><td>${pct(x.cagr)}</td><td>${pct(x.max_dd, 0)}</td>
        <td>${x.switches_per_year ?? '—'}</td><td>${x.defensive_share != null ? pct(x.defensive_share, 0) : '—'}</td></tr>`);
    });
  });
  $('tblS20').innerHTML = `<tr>${L.s20Cols.map((x) => `<th>${x}</th>`).join('')}</tr>` + rows.join('');
  const fmt = (c) => Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, n]) => { const [st, cause] = k.split(':'); return `${L.stance[st]}·${L.causeName[cause] || cause} ${n}`; }).join('；');
  $('s20Causes').textContent = `${L.s20Causes('v1', fmt(s.causes.v1))}　${L.s20Causes('v2', fmt(s.causes.v2))}`;
}

/* ---------------- ⑩ audit ---------------- */
function renderAudit() {
  const L = T(); const a = D.audit; const bt = D.backtest;
  $('tblAblation').innerHTML = `<tr>${L.ablCols.map((x) => `<th>${x}</th>`).join('')}</tr>`
    + a.ablation.map((r) => `<tr class="${r.key === 'announced' ? 'headline' : ''}"><td>${L.abl[r.key]}</td><td>${r.brier}</td><td>${pct(r.skill, 0)}</td><td>${r.auc}</td>
      <td>${pct(r.cagr)}</td><td>${pct(r.max_dd, 0)}</td><td>${r.sharpe_like}</td><td>${pct(r.stance_agree_with_headline, 0)}</td>
      <td>${pct(r.p_now)}</td><td>${pill(L, r.stance_now)}</td></tr>`).join('');
  const b = a.bootstrap; const pp = (v) => v.map((x) => pct(x, 0));
  $('bootText').textContent = L.boot({ ...b, brier_skill: pp(b.brier_skill), offensive_p_up: pp(b.offensive_p_up),
    offensive_mean_12m: b.offensive_mean_12m.map((x) => signed(x, 1)), cagr_rule_minus_buyhold: b.cagr_rule_minus_buyhold.map((x) => signed(x, 1)) });
  $('costText').textContent = L.cost({ cost_bps: bt.cost_bps, turnover_per_year: bt.turnover_per_year, g: pct(bt.strategy.cagr, 2), n: pct(bt.strategy_net.cagr, 2) });
  $('gapsText').textContent = L.gaps(D.gaps.map((g) => `${g.series} ${g.month}`).join(', '));
  $('paramsText').textContent = JSON.stringify(a.model_params, null, 2);
  const g = D.scorecard.robust;
  $('gridH').textContent = L.gridH(g.n);
  $('tblGrid').innerHTML = `<tr>${L.gridCols.map((x) => `<th>${x}</th>`).join('')}</tr>`
    + g.rows.map((r) => `<tr><td>${pct(r.offensive_below, 0)}</td><td>${pct(r.defensive_p, 0)}</td><td>${r.shock}</td><td>${pct(r.cagr)}</td><td>${pct(r.max_dd)}</td><td>${r.sharpe_like}</td></tr>`).join('');
}

/* ---------------- exposure test (Sharpe / Calmar) ---------------- */
function renderExposure() {
  const L = T(); const e = D.walkforward.exposure;
  const w = (x) => x.map((v) => pct(v, 0)).join(' / ');
  const row = (name, g, cls) => `<tr class="${cls}"><td>${name}</td><td>${w(g.weights)}</td><td>${g.train.sharpe.toFixed(2)}</td><td>${g.train.calmar.toFixed(2)}</td>
    <td>${g.test.sharpe.toFixed(2)}</td><td>${g.test.calmar.toFixed(2)}</td><td>${pct(g.test.cagr, 1)}</td><td>${pct(g.test.max_dd, 0)}</td></tr>`;
  $('tblExp').innerHTML = `<tr>${L.expCols.map((c) => `<th>${c}</th>`).join('')}</tr>` + row(L.expStd, e.standard, 'headline') + row(L.expBest, e.best, '');
  $('expNote').textContent = L.expNote(e);
}

/* ---------------- ⑦ track record ---------------- */
function renderScorecard() {
  const L = T(); const c = D.scorecard;
  const p0 = (x) => pct(x, 0);
  const a = c.analog;
  $('analog').innerHTML = L.analog({ ...a, p_pos: p0(a.p_pos), p_beat_bills: p0(a.p_beat_bills), f12_mean: signed(a.f12_mean),
    p_dd10: p0(a.p_dd10), worst_dd12: pct(a.worst_dd12, 0) }, L.stance[a.stance]);

  const statRow = (label, x) => `<tr><td>${label}</td><td>${x.n} (${x.episodes})</td><td>${signed(x.f12_mean)}</td><td>${p0(x.p_pos)}</td>
    <td>${p0(x.p_beat_bills)}</td><td>${p0(x.p_dd10)}</td><td>${pct(x.worst_dd12, 0)}</td></tr>`;
  const statHead = (first) => `<tr><th>${first}</th><th>${L.colMonths}</th><th>${L.colMean}</th><th>${L.colPos}</th><th>${L.colBills}</th><th>${L.colDD10}</th><th>${L.colWorst}</th></tr>`;
  $('tblStance').innerHTML = statHead(L.colStance)
    + ['offensive', 'balanced', 'defensive'].map((k) => statRow(`${STANCE_STYLE[k].icon} ${L.stance[k]}`, c.by_stance[k])).join('');

  const r = c.recession;
  const lead = (m) => (m == null ? L.never : L.monthsAhead(m));
  $('tblCalls').innerHTML = `<tr><th>${L.colRecStart}</th><th>${L.colMaxP}</th><th>${L.colLead25}</th><th>${L.colLead50}</th></tr>`
    + r.calls.map((x) => `<tr><td>${x.start}</td><td>${p0(x.max_p)}</td><td>${lead(x.lead25)}</td><td>${lead(x.lead50)}</td></tr>`).join('');
  $('recNote').textContent = L.recNote(r.auc, p0(r.precision['0.25'].precision), p0(r.precision['0.5'].precision));
  $('alarmChips').innerHTML = r.alarms.map((x) => `<span class="chip ${x.outcome}">${x.from}${x.to !== x.from ? '→' + x.to : ''} · ${L.alarm[x.outcome]}</span>`).join('');

  $('tblCmp').innerHTML = `<tr><th>${L.colMethod}</th><th>${L.colCagr}</th><th>${L.colVol}</th><th>${L.colMdd}</th><th>${L.colSharpe}</th><th>${L.colAvgEq}</th><th>${L.colDD22}</th></tr>`
    + c.compare.map((x) => `<tr><td>${L.cmp[x.key]}</td><td>${pct(x.cagr)}</td><td>${pct(x.vol)}</td><td>${pct(x.max_dd)}</td>
      <td>${x.sharpe_like}</td><td>${p0(x.avg_equity)}</td><td>${pct(x.dd_2022)}</td></tr>`).join('');
  const rb = c.robust; const rng = (v, f) => `${f(v[0])} – ${f(v[1])}`;
  $('robustNote').textContent = L.robust(rb.n, rng(rb.cagr, pct), rng(rb.max_dd, pct), rng(rb.sharpe, (v) => v.toFixed(2)));

  $('tblCrash').innerHTML = `<tr><th>${L.colPeriod}</th><th>${L.colSpyDD}</th><th>${L.colRuleDD}</th><th>${L.colStart}</th><th>${L.colDefMonths}</th></tr>`
    + c.crashes.map((x) => `<tr><td>${x.from} → ${x.to}</td><td>${pct(x.spy_dd, 0)}</td><td>${pct(x.rule_dd, 0)}</td>
      <td>${x.stance_start ? L.stance[x.stance_start] : '—'}</td><td>${x.defensive} / ${x.balanced} (${x.months})</td></tr>`).join('');

  $('tblRate').innerHTML = statHead(`${c.regimes_start} –`)
    + ['all', 'hiking', 'hiking_hot', 'hiking_cool', 'not_hiking'].map((k) => statRow(L.regime[k], c.regimes[k])).join('');
}

/* ---------------- ⑧ sources ---------------- */
function renderSources() {
  const L = T(); const S = D.sources;
  $('srcLede').innerHTML = L.srcLede(S.fred_method);
  $('tblFred').innerHTML = `<tr><th>${L.colId}</th><th>${L.colName}</th><th>${L.colOrigin}</th><th>${L.colFreq}</th><th>${L.colSince}</th><th>${L.colLast}</th><th>${L.colUse}</th></tr>`
    + S.fred.map((f) => {
      const [name, origin, fq, use] = L.fred[f.id];
      return `<tr><td><a href="https://fred.stlouisfed.org/series/${f.id}" target="_blank" rel="noopener">${f.id}</a></td>
        <td>${name}</td><td>${origin}</td><td class="nw">${L.freq[fq]}</td><td class="nw">${f.first.slice(0, 7)}</td><td class="nw">${f.last}</td><td class="wrapcell">${use}</td></tr>`;
    }).join('');
  const use = (id) => (id === 'SPY' || id === '^GSPC' ? L.pxUse.spy : /^XL/.test(id) ? L.pxUse.sector : L.pxUse.other);
  $('tblPx').innerHTML = `<tr><th>${L.colId}</th><th>${L.colName}</th><th>${L.colSince}</th><th>${L.colLast}</th><th>${L.colUse}</th></tr>`
    + S.prices.map((p) => `<tr><td><a href="https://finance.yahoo.com/quote/${encodeURIComponent(p.id)}" target="_blank" rel="noopener">${p.id}</a></td>
        <td>${L.tick[p.id] || ''}</td><td class="nw">${p.first}</td><td class="nw">${p.last}</td><td class="wrapcell">${use(p.id)}</td></tr>`).join('');
}

/* ---------------- v4: reserve and panic (primary) ---------------- */
const ZONES = ['cheap', 'fair', 'rich', 'expensive'];
const PANIC = ['normal', 'correction', 'bear', 'panic'];
const ECON = ['healthy', 'weakening', 'recession'];
const r5 = (x) => Math.round(x * 20) / 20;  // fuzzy: nearest 5 points

function strip(L, names, labels, cur) {
  const lv = names.length === 3 ? [0, 2, 3] : [0, 1, 2, 3];
  return `<div class="g-strip">${names.map((k, i) => `<div class="g-seg ${k === cur ? `on l${lv[i]}` : ''}">${labels[k]}</div>`).join('')}</div>`;
}

function renderV4() {
  const L = T(); const v = D.v4; const n = v.now; const val = v.valuation;
  const tgt = n.reserve_target; const lo = Math.max(0, tgt - 0.05);
  const range = tgt > 0 ? `${Math.round(lo * 100)}–${Math.round(tgt * 100)}%` : '0%';
  const flex = 1 - v.core - tgt;  // equity above the core when the reserve is below 30%
  const bar = `<div class="v4-bar"><div class="v4-core" data-style="width:${v.core * 100}%">${L.v4Core(pct(v.core, 0))}</div>`
    + (flex > 0.001 ? `<div class="v4-flex" data-style="width:${flex * 100}%"></div>` : '')
    + (tgt > 0 ? `<div class="v4-res range" data-style="width:${tgt * 100}%">${L.v4Res(range)}</div>` : '') + '</div>';
  const f = v.forward_10y[v.zone_method][val.zone] || {};
  const nextTier = v.tiers.find((x) => n.drawdown > x);
  const on = Object.entries(n.hard).filter(([, x]) => x).map(([k]) => L.hardName[k]);
  $('v4hero').innerHTML = `
    <div class="v4-top"><div class="v4-title">${L.v4Title}</div><div class="note">${L.v4Eff(v.effective, D.generated_utc.slice(0, 10))}</div></div>
    <div class="v4-action">${L.v4Action[n.deploy_signal](range, n.slow_deploy)}</div>
    <p class="v4-sub">${L.v4Sub(pct(v.core, 0), range)}</p>
    ${bar}
    <div class="gauges">
      <div class="gauge"><h4>${L.gValH}</h4>${strip(L, ZONES, L.zone, val.zone)}
        <div class="d">${L.gValD(Math.round(val.cape_rule), val.percentile, Math.round(val.median_cape), val.asof)}</div></div>
      <div class="gauge"><h4>${L.gPanicH}</h4>${strip(L, PANIC, L.panic, n.panic)}
        <div class="d">${L.gPanicD(Math.round(n.drawdown * 100), nextTier != null ? Math.round(nextTier * 100) : null, n.drawdown_asof)}</div></div>
      <div class="gauge"><h4>${L.gEconH}</h4>${strip(L, ECON, L.econ, n.economy)}
        <div class="d">${L.gEconD(on, n.credit_widening, v.signals_asof)}</div></div>
    </div>
    <div class="v4-do">
      <div><h4>${L.v4NowH}</h4><ul>${L.v4Now(n, tgt, range, v.core).map((x) => `<li>${x}</li>`).join('')}</ul></div>
      <div><h4>${L.v4ChangeH}</h4><ul>${L.v4Change(v, val).map((x) => `<li>${x}</li>`).join('')}</ul></div>
    </div>
    <p class="note">${L.v4Long(L.zone[val.zone], f)} <a href="#longview">${L.v4More}</a></p>`;
}

const PERM_KEYS = ['buy_hold', 'v4', 'v4_other', 'static_70_30', 'trend'];
function renderLongView() {
  const L = T(); const v = D.v4; const val = v.valuation; const C = v.compare; const m = v.zone_method;
  const other = m === 'pctl' ? 'fixed' : 'pctl';
  const key = (k) => (k === 'v4' ? `v4_${m}` : k === 'v4_other' ? `v4_${other}` : k);
  $('lvLede').innerHTML = L.lvLede;
  const fp = v.forward_10y.pctl[val.zone_pctl] || {}; const ff = v.forward_10y.fixed[val.zone_fixed] || {};
  $('lvFwd').innerHTML = L.lvFwd(L.zone[val.zone], fp, ff, Math.round(val.cape_rule), v.valuation.fixed_levels[2]);
  const te = C.test; const al = C.all;
  $('lvCost').innerHTML = L.lvCost(te[key('v4')], te.buy_hold, te.trend, al[key('v4')], al.buy_hold, al.trend, te.period, al.period);
  $('lvCapeNote').innerHTML = L.lvCapeNote(val);
  mk('chCape', (t) => ({
    legend: { top: 0, left: 0, textStyle: { color: t.text2, fontSize: 12 } },
    grid: { left: 40, right: 16, top: 34, bottom: 28 },
    tooltip: tooltip(t, { valueFormatter: (x) => (x == null ? '—' : x.toFixed(1)) }),
    xAxis: baseAxis(t, { type: 'time', splitLine: { show: false } }),
    yAxis: baseAxis(t, { type: 'value', min: 0 }),
    dataZoom: [{ type: 'inside', zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false }],
    series: [
      { name: 'CAPE', type: 'line', showSymbol: false, data: v.history.cape, lineStyle: { width: 1.8, color: t.s1 }, itemStyle: { color: t.s1 }, markArea: recessionArea(t) },
      ...[['q85', L.thr.q85, t.s4], ['q60', L.thr.q60, t.muted], ['q25', L.thr.q25, t.s3]].map(([k, nm, c]) => ({
        name: nm, type: 'line', showSymbol: false, data: v.history.thresholds[k], lineStyle: { width: 1.2, type: 'dashed', color: c }, itemStyle: { color: c } })),
    ],
  }));
  const usd = (x) => '$' + (x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : Math.round(x / 1e3) + 'k');
  mk('chWealth', (t) => {
    const col = { buy_hold: t.s2, v4: t.s1, static_70_30: t.muted, trend: t.s3 };
    return {
      legend: { top: 0, left: 0, textStyle: { color: t.text2, fontSize: 12 } },
      grid: { left: 60, right: 16, top: 34, bottom: 28 },
      tooltip: tooltip(t, { valueFormatter: (x) => usd(x) }),
      xAxis: baseAxis(t, { type: 'time', splitLine: { show: false } }),
      yAxis: baseAxis(t, { type: 'log', axisLabel: { color: t.muted, formatter: (x) => usd(x) } }),
      dataZoom: [{ type: 'inside', zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false }],
      series: Object.keys(v.history.wealth).map((k, i) => ({
        name: L.permNames[k], type: 'line', showSymbol: false, data: v.history.wealth[k],
        lineStyle: { width: k === 'v4' ? 3 : 1.5, color: col[k], type: k === 'buy_hold' ? 'dashed' : 'solid' }, itemStyle: { color: col[k] },
        ...(i === 0 ? { markArea: recessionArea(t) } : {}) })),
    };
  });
  const p0 = (x) => pct(x, 0); const p1 = (x) => pct(x, 1);
  $('tblPerm').innerHTML = `<tr><th rowspan="2">${L.permCols[0]}</th><th colspan="6">${te.period[0].slice(0, 4)}–${te.period[1].slice(0, 4)} ${L.permTest}</th><th colspan="3">${al.period[0].slice(0, 4)}–${al.period[1].slice(0, 4)}</th></tr>
    <tr>${L.permCols.slice(1).map((c) => `<th>${c}</th>`).join('')}</tr>`
    + PERM_KEYS.map((k) => { const a = te[key(k)]; const b = al[key(k)];
      const nm = k === 'v4' ? `${L.permNames.v4} (${L.zoneMethod[m]})` : k === 'v4_other' ? `${L.permNames.v4_other} (${L.zoneMethod[other]})` : L.permNames[k];
      return `<tr class="${k === 'v4' ? 'headline' : ''}"><td class="wrapcell">${nm}</td><td>${p1(a.real_cagr)}</td><td>${p0(a.ten_year.p_negative)}</td><td>${p1(a.ten_year.worst)}</td>
        <td>${a.sold_low_episodes}</td><td>${a.rebound_capture == null ? '—' : p0(a.rebound_capture)}</td><td>${p0(a.max_dd)}</td>
        <td>${p1(b.real_cagr)}</td><td>${p0(b.ten_year.p_negative)}</td><td>${b.sold_low_episodes}</td></tr>`; }).join('');
  $('lvSel').innerHTML = L.lvSel(v.selection, C.train.period);
}

/* ---------------- boot ---------------- */
function renderAll() {
  charts.forEach(({ c }) => c.dispose());
  charts = [];
  applyStaticText();
  if (!D) return;
  renderV4(); renderLongView(); renderHero(); renderCore(); renderShadow(); renderOutlook(); renderScenarios(); renderDips(); renderTimeline(); renderAnalogs(); renderBayes(); renderClock(); renderSpectrum(); renderBands(); renderLong(); renderBacktest(); renderPresets(); renderQQQ(); renderScorecard(); renderSince2020(); renderWalkForward(); renderExposure(); renderAudit(); renderSectorTest(); renderSources();
  applyDataStyles();
}

function applyTheme(mode) {
  if (mode) document.documentElement.setAttribute('data-theme', mode);
  charts.forEach((c) => c.render());
  if (D) { renderV4(); renderHero(); applyDataStyles(); }
}

$('hero').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-preset]');
  if (!b) return;
  CASH = b.dataset.preset;
  try { localStorage.setItem('cashPreset', CASH); } catch (e) { /* storage unavailable */ }
  renderAll();
});
$('langBtn').addEventListener('click', () => {
  LANG = LANG === 'zh' ? 'en' : 'zh';
  try { localStorage.setItem('lang', LANG); } catch (e) { /* storage unavailable */ }
  renderAll();
});
$('themeBtn').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme')
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ }
  applyTheme(next);
});
try { const saved = localStorage.getItem('theme'); if (saved) document.documentElement.setAttribute('data-theme', saved); } catch (e) { /* ignore */ }
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
addEventListener('resize', () => charts.forEach(({ c }) => c.resize()));

applyStaticText();
fetch('data/dashboard.json', { cache: 'no-cache' })
  .then((r) => r.json())
  .then((d) => { D = d; renderAll(); })
  .catch((e) => { $('updated').textContent = T().loadFail(e.message); });
