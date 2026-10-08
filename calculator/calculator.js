// ENGINE START
const CF_STATES = {
  rich:   {S:1.5},
  retired:{S:1.0},
  none:   {S:0.5}
};
const Y_SPLIT = [["QQQM",.4],["IBIT",.2],["VNQ",.1],["XLE",.1],["IAUM",.1],["URAN",.1]];

function targetWeights(p){
  // p: {total, expense, S, age, ageBase, pe}
  const Z = 10 * p.S;
  const X = Math.max(0, 40 + (1 - p.S) * 40);
  const cashAge = Math.max(0, 100 - (p.ageBase - p.age));
  const cashExp = 12 * p.expense / p.total * 100;
  let adj = 0;
  if (p.pe != null && p.pe > 28) adj = 5;
  if (p.pe != null && p.pe < 20) adj = -5;
  const C = Math.max(cashExp, Math.max(cashAge, cashExp) + adj);
  const Y = 100 - X - Z - C;
  const tickers = {QQQI: X*.8, LEAPS: Z, SGOV: C + X*.2};
  Y_SPLIT.forEach(([k,w]) => tickers[k] = Y*w);
  return {X, Y, Z, C, tickers};
}

function parseCSV(text){
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(",").map(s => s.trim());
  const rows = lines.slice(1).map(l => l.split(","));
  const dates = rows.map(r => r[0].trim());
  const cols = {};
  head.slice(1).forEach((h,i) => cols[h] = rows.map(r => parseFloat(r[i+1])));
  return {dates, cols};
}

// map portfolio tickers to CSV columns
const COLMAP = {QQQI:"QQQI", QQQM:"QQQ", IBIT:"IBIT", VNQ:"VNQ", XLE:"XLE", IAUM:"IAUM", URAN:"URAN", LEAPS:"LEAPS", SGOV:"SGOV"};

function simulate(data, weights, opt){
  // weights: {ticker: pct}, opt: {initial, monthly, threshold}
  const keys = Object.keys(weights).filter(k => weights[k] > 1e-9);
  const w = {}; keys.forEach(k => w[k] = weights[k] / 100);
  const n = data.dates.length;
  const px = k => data.cols[COLMAP[k] || k];
  let h = {}; keys.forEach(k => h[k] = opt.initial * w[k]);
  const values = [opt.initial], rets = [];
  let invested = opt.initial, rebalances = 0;
  for (let t = 1; t < n; t++){
    let prev = 0, V = 0;
    keys.forEach(k => { prev += h[k]; h[k] *= px(k)[t] / px(k)[t-1]; V += h[k]; });
    rets.push(prev > 0 ? V / prev - 1 : 0);
    if (opt.monthly > 0){ keys.forEach(k => h[k] += opt.monthly * w[k]); V += opt.monthly; invested += opt.monthly; }
    const month = parseInt(data.dates[t].slice(5,7), 10);
    let drift = false;
    keys.forEach(k => { if (Math.abs(h[k] / V - w[k]) * 100 > opt.threshold) drift = true; });
    if (month % 3 === 0 || drift){ keys.forEach(k => h[k] = V * w[k]); rebalances++; }
    values.push(V);
  }
  return {values, rets, invested, rebalances};
}

function metrics(dates, rets, rfRets){
  const n = rets.length, years = n / 12;
  let idx = 1, peak = 1, mdd = 0, uw = 0, maxUw = 0;
  const index = [1];
  rets.forEach(r => {
    idx *= 1 + r; index.push(idx);
    if (idx >= peak){ peak = idx; uw = 0; } else { uw++; maxUw = Math.max(maxUw, uw); }
    mdd = Math.min(mdd, idx / peak - 1);
  });
  const cagr = Math.pow(idx, 1 / years) - 1;
  const mean = rets.reduce((a,b) => a+b, 0) / n;
  const sd = Math.sqrt(rets.reduce((a,b) => a + (b-mean)**2, 0) / (n - 1));
  const vol = sd * Math.sqrt(12);
  const ex = rets.map((r,i) => r - (rfRets ? rfRets[i] : 0));
  const exMean = ex.reduce((a,b) => a+b, 0) / n;
  const sharpe = sd > 0 ? exMean * 12 / vol : 0;
  const down = rets.filter(r => r < 0);
  const dsd = Math.sqrt(down.reduce((a,b) => a + b*b, 0) / n) * Math.sqrt(12);
  const sortino = dsd > 0 ? exMean * 12 / dsd : 0;
  const years_ = {};
  rets.forEach((r,i) => { const y = dates[i+1].slice(0,4); years_[y] = (years_[y] ?? 1) * (1 + r); });
  const worstYear = Math.min(...Object.values(years_)) - 1;
  const posMonths = rets.filter(r => r > 0).length / n;
  return {cagr, total: idx - 1, mdd, vol, sharpe, sortino, calmar: mdd < 0 ? cagr / -mdd : 0, maxUw, worstYear, posMonths, index};
}

function runBacktest(data, weights, opt){
  const rf = data.cols.SGOV.slice(1).map((v,i) => v / data.cols.SGOV[i] - 1);
  const strat = simulate(data, weights, opt);
  const spy = simulate(data, {SPY:100}, opt);
  const qqq = simulate(data, {QQQ:100}, opt);
  return {
    strat: {...strat, m: metrics(data.dates, strat.rets, rf)},
    spy:   {...spy,   m: metrics(data.dates, spy.rets, rf)},
    qqq:   {...qqq,   m: metrics(data.dates, qqq.rets, rf)}
  };
}
// ENGINE END

const I18N = {
  zh:{
    title:"全天候复利组合计算器",
    subtitle:"选择你的现金流状态，算出目标配比、需要买卖的金额，并用历史数据看看这套配置和直接定投标普 500 相比如何。",
    inputsTitle:"你的情况",
    inputsHint:"金额单位为美元。",
    total:"可投资资产",
    totalHint:"打算放进这套组合的全部资金，包括准备作为现金仓的短债和货币基金。不含自住房和你不打算动用的资产。",
    cfTitle:"你的现金流状态",
    cf:{
      rich:["工作收入充裕","每月收入付完所有开支后还有明显结余，不需要从组合里取钱。"],
      retired:["已退休","养老金等收入大致覆盖开支，偶尔需要组合补贴一部分。"],
      none:["暂时没有收入","失业、创业早期或空档期，生活开支要靠组合和存款支撑。"]
    },
    expense:"每月刚性开支",dca:"每月定投金额（回测用）",age:"年龄",
    ageBase:"年龄规则基数（基数 − 年龄 = 权益上限）",pe:"NDX forward PE",threshold:"再平衡阈值",
    sLine:(s)=>`按你的现金流状态，系统使用 S = <b>${s}</b>。收入越稳定，S 越高，组合越偏进攻。`,
    sigTitle:"市场信号",sigHint:"示例值为 2026-10-07 收盘数据，使用前请更新为最新值。",
    zeroG:"SPX Zero Gamma",qqqHigh:"QQQ 52 周高点",aaii:"AAII 看空 %",pe500:"S&P forward PE",y10:"10 年期美债 %",
    allocTitle:"目标配比",
    bucket:{X:"现金流引擎",Y:"增长与对冲",Z:"主动期权",C:"现金"},
    btTitle:"历史回测：这套配置 vs 直接定投",
    btRange:(a,b,n)=>`${a} 至 ${b}，共 ${n} 个月，月度数据，含分红再投资。每季度再平衡，偏离超过阈值时提前再平衡。`,
    btLoading:"正在加载历史数据…",
    btMissing:"没有找到历史数据文件 prices.csv。站长需要运行 build_prices.py 生成它，并和本页放在同一目录。你也可以在下面手动选择一个 CSV 文件。",
    btUpload:"选择 prices.csv：",
    btBadCsv:(cols)=>`CSV 缺少这些列：${cols}`,
    mName:{strat:"全天候组合",spy:"定投标普 500（SPY）",qqq:"定投纳指 100（QQQ）"},
    mRows:{cagr:"年化收益率",total:"累计收益率",final:"期末资产",invested:"投入本金",mdd:"最大回撤",vol:"年化波动率",
      sharpe:"夏普比率",sortino:"索提诺比率",calmar:"卡玛比率",maxUw:"最长水下期（月）",worstYear:"最差年度",posMonths:"上涨月份占比"},
    metric:"指标",
    takeaway:(r)=>{
      const s=r.strat.m, p=r.spy.m, q=r.qqq.m;
      const ret = s.cagr>=p.cagr ? `年化收益比标普 500 高 ${pp(s.cagr-p.cagr)}` : `年化收益比标普 500 低 ${pp(p.cagr-s.cagr)}`;
      const dd = s.mdd>=p.mdd ? `最大回撤浅 ${pp(s.mdd-p.mdd)}` : `最大回撤深 ${pp(p.mdd-s.mdd)}`;
      const sh = s.sharpe>=p.sharpe ? "每承担一单位波动换来的收益更多" : "每承担一单位波动换来的收益更少";
      const vq = s.cagr>=q.cagr ? `也跑赢了纳指 100（${pc(q.cagr)}）` : `但跑输纳指 100（${pc(q.cagr)}）`;
      return `在这段时间里，这套配置${ret}，${dd}，${sh}；${vq}。判断它是否值得用，看你更在意收益还是更在意回撤和现金流。`;
    },
    caveats:[
      "回测期间正好是科技股和比特币的大牛市，这对这套配置有利，未来不一定重复。",
      "QQQI、IBIT、IAUM、URAN、SGOV 上市较晚，上市前用替代品拼接：QYLD、比特币现货、GLD、URA、BIL。QYLD 比 QQQI 保守，可能低估了现金流引擎的表现。",
      "主动期权仓用 2 倍纳指 ETF（QLD）近似，不等于真实的 LEAPS 择时操作。",
      "回测用的是固定的目标配比，没有模拟按市场信号分批入场。",
      "不计交易成本和税。"
    ],
    tableTitle:"逐个标的",
    tableHint:"填入每个标的当前市值，就能看到偏离和需要买卖的金额。",
    colTicker:"标的",colTarget:"目标 %",colTargetUsd:"目标金额",colCurrent:"当前市值",colDev:"偏离",colAction:"动作",
    groupX:"现金流引擎 X",groupY:"增长与对冲 Y",groupZ:"主动期权 Z",groupC:"现金（含 X 中的 20%）",
    buy:"买入",sell:"卖出",hold:"不动",
    rebalYes:(n)=>`有 <b>${n}</b> 个标的偏离超过阈值，需要再平衡。`,
    rebalNo:"所有标的都在阈值以内，按季度再平衡即可。",
    rebalEmpty:"还没有填写当前市值。",
    coverage:(m)=>`现金可覆盖 <b>${m}</b> 个月刚性开支。`,
    errNeg:(name,v)=>`${name} 算出来是 ${v}%，配比不成立。现金要求太高时会出现这种情况，请检查可投资资产和每月刚性开支。`,
    errInput:"请填写大于 0 的可投资资产和每月刚性开支。",
    okSum:"配比校验通过，合计 100%。",
    trigTitle:"入场条件",
    trigHint:"工资定投照常进行。下面这些条件只决定存量现金（SGOV）什么时候转入。",
    t1:"SGOV 第 1 笔：SPX 收盘 ≤ MA50，或 QQQ 回撤 ≥ 5%",
    p1:"恐慌：CNN F&G < 25",p2:"恐慌：AAII 看空 > 50%",p3:"恐慌：VIX / VIX3M > 1",
    p4:"恐慌：QQQ RSI < 35",p5:"恐慌：SPX < min(Zero Gamma, MA50)",
    erp:"ERP（1 / PE − 10 年期）≥ 0.5%",
    met:"已满足",notMet:"未满足",gap:"距离",
    vNone:"现在不动用 SGOV。现金继续拿短债收益，工资照常定投。",
    v1:"可以转入第 1 笔 SGOV，优先买 QQQI。",
    v23:"恐慌条件已满足 2 条以上。再等到反转确认（单日涨 ≥ 3% 放量，或站回 MA20/MA50），就可以转入第 2、3 笔。",
    leapsYes:"LEAPS 条件满足：QQQ RSI < 35，且至少 1 条恐慌条件成立。",
    leapsNo:"LEAPS 条件未满足。",
    erpNote:(v)=>`当前 ERP ${v}%。低于 0.5% 时，不动用 SGOV 一次性加仓。`,
    disclaimer:"本计算器仅用于教育和研究用途，不构成投资建议。计算按作者自定的规则进行，历史回测不代表未来表现。市场数据需要手动输入，计算结果的正确性取决于输入。"
  },
  en:{
    title:"All-Weather Compounding Portfolio Calculator",
    subtitle:"Pick your cash-flow situation to get target weights and the amounts to buy or sell, then see how this setup would have done against simply dollar-cost averaging into the S&P 500.",
    inputsTitle:"Your situation",
    inputsHint:"Amounts in USD.",
    total:"Investable assets",
    totalHint:"Everything you plan to put into this portfolio, including short-term Treasuries or money-market funds meant as the cash sleeve. Leave out your home and anything you don't intend to touch.",
    cfTitle:"Your cash-flow situation",
    cf:{
      rich:["Earning with a solid surplus","Your income covers every expense with money left over. You don't draw from the portfolio."],
      retired:["Retired","Pension and similar income roughly cover expenses, with the portfolio topping up now and then."],
      none:["No income right now","Between jobs, early in a business, or taking a break. Living costs come from the portfolio and savings."]
    },
    expense:"Monthly fixed expenses",dca:"Monthly contribution (for backtest)",age:"Age",
    ageBase:"Age rule base (base − age = equity cap)",pe:"NDX forward P/E",threshold:"Rebalance threshold",
    sLine:(s)=>`Based on your cash-flow situation, the calculator uses S = <b>${s}</b>. Steadier income means a higher S and a more growth-oriented mix.`,
    sigTitle:"Market signals",sigHint:"Sample values are 2026-10-07 closing data. Update them before use.",
    zeroG:"SPX zero gamma",qqqHigh:"QQQ 52-week high",aaii:"AAII bearish %",pe500:"S&P forward P/E",y10:"10-year Treasury %",
    allocTitle:"Target allocation",
    bucket:{X:"Cash-flow engine",Y:"Growth & hedge",Z:"Active options",C:"Cash"},
    btTitle:"Backtest: this setup vs plain DCA",
    btRange:(a,b,n)=>`${a} to ${b}, ${n} months of monthly data with dividends reinvested. Rebalanced quarterly, or earlier when a holding drifts past the threshold.`,
    btLoading:"Loading historical data…",
    btMissing:"Historical data file prices.csv wasn't found. The site owner needs to run build_prices.py and place the output next to this page. You can also pick a CSV file below.",
    btUpload:"Choose prices.csv:",
    btBadCsv:(cols)=>`The CSV is missing these columns: ${cols}`,
    mName:{strat:"All-weather portfolio",spy:"DCA into S&P 500 (SPY)",qqq:"DCA into Nasdaq-100 (QQQ)"},
    mRows:{cagr:"Annualized return",total:"Cumulative return",final:"Ending value",invested:"Amount invested",mdd:"Max drawdown",vol:"Annualized volatility",
      sharpe:"Sharpe ratio",sortino:"Sortino ratio",calmar:"Calmar ratio",maxUw:"Longest underwater (months)",worstYear:"Worst calendar year",posMonths:"Share of up months"},
    metric:"Metric",
    takeaway:(r)=>{
      const s=r.strat.m, p=r.spy.m, q=r.qqq.m;
      const ret = s.cagr>=p.cagr ? `returned ${pp(s.cagr-p.cagr)} a year more than the S&P 500` : `returned ${pp(p.cagr-s.cagr)} a year less than the S&P 500`;
      const dd = s.mdd>=p.mdd ? `with a max drawdown ${pp(s.mdd-p.mdd)} shallower` : `with a max drawdown ${pp(p.mdd-s.mdd)} deeper`;
      const sh = s.sharpe>=p.sharpe ? "and more return per unit of volatility" : "and less return per unit of volatility";
      const vq = s.cagr>=q.cagr ? `It also beat the Nasdaq-100 (${pc(q.cagr)}).` : `It trailed the Nasdaq-100 (${pc(q.cagr)}).`;
      return `Over this period the setup ${ret}, ${dd}, ${sh}. ${vq} Whether it's worth using depends on whether you care more about return or about drawdowns and cash flow.`;
    },
    caveats:[
      "This window was a big bull market for tech and Bitcoin, which flatters this setup. It may not repeat.",
      "QQQI, IBIT, IAUM, URAN and SGOV launched recently, so earlier data is spliced from stand-ins: QYLD, spot Bitcoin, GLD, URA and BIL. QYLD is more conservative than QQQI and may understate the cash-flow engine.",
      "The active options sleeve is approximated with a 2x Nasdaq-100 ETF (QLD), not actual LEAPS timing.",
      "The backtest holds fixed target weights and does not simulate signal-based staged entries.",
      "Trading costs and taxes are ignored."
    ],
    tableTitle:"By holding",
    tableHint:"Enter each holding's current market value to see deviations and how much to buy or sell.",
    colTicker:"Ticker",colTarget:"Target %",colTargetUsd:"Target $",colCurrent:"Current $",colDev:"Deviation",colAction:"Action",
    groupX:"Cash-flow engine X",groupY:"Growth & hedge Y",groupZ:"Active options Z",groupC:"Cash (incl. 20% of X)",
    buy:"Buy",sell:"Sell",hold:"Hold",
    rebalYes:(n)=>`<b>${n}</b> holding(s) are past the threshold. Rebalance now.`,
    rebalNo:"Every holding is within the threshold. Rebalance on the quarterly schedule.",
    rebalEmpty:"No current values entered yet.",
    coverage:(m)=>`Cash covers <b>${m}</b> months of fixed expenses.`,
    errNeg:(name,v)=>`${name} comes out at ${v}%, so these weights don't work. This happens when the cash requirement is too high. Check investable assets and monthly fixed expenses.`,
    errInput:"Enter investable assets and monthly fixed expenses above 0.",
    okSum:"Weights check out and add up to 100%.",
    trigTitle:"Entry conditions",
    trigHint:"Keep dollar-cost averaging from salary as usual. These conditions only decide when idle cash (SGOV) moves in.",
    t1:"SGOV tranche 1: SPX close ≤ MA50, or QQQ drawdown ≥ 5%",
    p1:"Panic: CNN F&G < 25",p2:"Panic: AAII bearish > 50%",p3:"Panic: VIX / VIX3M > 1",
    p4:"Panic: QQQ RSI < 35",p5:"Panic: SPX < min(zero gamma, MA50)",
    erp:"ERP (1 / P/E − 10-year) ≥ 0.5%",
    met:"Met",notMet:"Not met",gap:"Gap",
    vNone:"Leave SGOV alone for now. Cash keeps earning short-term Treasury yield and salary DCA continues.",
    v1:"Tranche 1 of SGOV can move in. QQQI first.",
    v23:"Two or more panic conditions are met. Once a reversal is confirmed (a 3%+ up day on heavy volume, or a close back above MA20/MA50), move tranches 2 and 3.",
    leapsYes:"LEAPS conditions met: QQQ RSI below 35 and at least one panic condition holds.",
    leapsNo:"LEAPS conditions not met.",
    erpNote:(v)=>`ERP is ${v}%. Below 0.5%, don't deploy SGOV as a lump sum.`,
    disclaimer:"This calculator is for education and research purposes only and is not investment advice. It applies the author's own rules, and past backtest results don't predict future returns. Market data is entered by hand, so results are only as good as the inputs."
  }
};

const COLORS = {X:"#0F5C55",Y:"#4F6D8F",Z:"#6B4E8C",C:"#B8892B"};
const LINE = {strat:"#0F5C55", spy:"#B8892B", qqq:"#4F6D8F"};
// Language preference comes from the shared site module (js/site-lang.js), same as the rest of the site.
let lang = SiteLang.get(), cfState = "rich", priceData = null, dataError = null;
const current = {};
const $ = id => document.getElementById(id);
const num = id => { const v = parseFloat($(id).value); return isNaN(v) ? null : v; };
const fmtPct = v => (Math.round(v*10)/10).toFixed(1);
const fmtUsd = v => (v<0?"−$":"$") + Math.abs(Math.round(v)).toLocaleString("en-US");
const pc = v => (v*100).toFixed(1) + "%";
const pp = v => (Math.abs(v)*100).toFixed(1) + (lang === "zh" ? " 个百分点" : " pts");

function inputs(){
  return {total:num("total"), expense:num("expense"), S:CF_STATES[cfState].S, age:num("age"),
          ageBase:parseFloat($("ageBase").value), pe:num("pe")};
}

function renderCF(){
  const t = I18N[lang];
  $("cf").innerHTML = Object.keys(CF_STATES).map(k =>
    `<label><input type="radio" name="cf" value="${k}" ${k===cfState?"checked":""}><span><b>${t.cf[k][0]}</b><small>${t.cf[k][1]}</small></span></label>`).join("");
  $("cf").querySelectorAll("input").forEach(i => i.addEventListener("change", e => { cfState = e.target.value; render(); }));
}

function applyLang(){
  const t = I18N[lang];
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.title = t.title + " | Alpha Wealth Lab";
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const v = t[el.dataset.i18n];
    if (typeof v === "string") el.textContent = v;
  });
  renderCF();
  render();
}

function render(){
  const t = I18N[lang];
  const p = inputs();
  const bar = $("bar"), legend = $("legend"), val = $("validation"), rows = $("rows");
  const clear = () => { bar.innerHTML = ""; legend.innerHTML = ""; rows.innerHTML = ""; $("rebalLine").innerHTML = ""; $("btBody").innerHTML = ""; $("btRange").textContent = ""; };
  if (!p.total || p.total <= 0 || !p.expense || p.expense <= 0){
    val.innerHTML = `<div class="alert bad">${t.errInput}</div>`; $("sLine").innerHTML = ""; clear(); renderSignals(); return;
  }
  $("sLine").innerHTML = t.sLine(p.S.toFixed(1));
  const r = targetWeights(p);
  const parts = [["X",r.X],["Y",r.Y],["Z",r.Z],["C",r.C]];
  const neg = parts.find(x => x[1] < -0.0001);
  if (neg){
    val.innerHTML = `<div class="alert bad">${t.errNeg(t.bucket[neg[0]], fmtPct(neg[1]))}</div>`; clear(); renderSignals(); return;
  }
  bar.innerHTML = parts.map(([k,v]) =>
    `<div class="seg seg-${k}" data-w="${v}" title="${t.bucket[k]} ${fmtPct(v)}%">${v >= 9 ? fmtPct(v)+"%" : ""}</div>`).join("");
  bar.querySelectorAll("[data-w]").forEach(d => { d.style.flex = `0 0 ${d.dataset.w}%`; });
  legend.innerHTML = parts.map(([k,v]) =>
    `<div><div class="k"><span class="sw seg-${k}"></span>${t.bucket[k]}</div>
     <div class="v">${fmtPct(v)}%</div><div class="d">${fmtUsd(p.total*v/100)}</div></div>`).join("");
  val.innerHTML = `<div class="alert ok">${t.okSum}</div>`;

  renderTable(p, r);
  renderBacktest(p, r);
  renderSignals();
}

function renderTable(p, r){
  const t = I18N[lang];
  const lines = [
    {g:t.groupX},{k:"QQQI"},
    {g:t.groupY}, ...Y_SPLIT.map(([k]) => ({k})),
    {g:t.groupZ},{k:"LEAPS", label:"QQQ LEAPS"},
    {g:t.groupC},{k:"SGOV"}
  ];
  const th = parseFloat($("threshold").value);
  const anyCurrent = Object.values(current).some(v => v > 0);
  let flagged = 0;
  $("rows").innerHTML = lines.map(l => {
    if (l.g) return `<tr class="group"><td colspan="6">${l.g}</td></tr>`;
    const pct = r.tickers[l.k];
    const tgtUsd = p.total * pct / 100;
    const cur = current[l.k] ?? 0;
    const dev = cur / p.total * 100 - pct;
    let tag = `<span class="tag hold">${t.hold}</span>`, devTxt = "—";
    if (anyCurrent){
      devTxt = (dev >= 0 ? "+" : "") + fmtPct(dev) + "%";
      if (Math.abs(dev) > th){
        flagged++;
        const diff = tgtUsd - cur;
        tag = diff > 0 ? `<span class="tag buy">${t.buy} ${fmtUsd(diff)}</span>` : `<span class="tag sell">${t.sell} ${fmtUsd(-diff)}</span>`;
      }
    }
    return `<tr><td>${l.label || l.k}</td><td>${fmtPct(pct)}%</td><td>${fmtUsd(tgtUsd)}</td>
      <td><input type="number" min="0" step="100" data-k="${l.k}" value="${current[l.k] ?? ""}" aria-label="${l.label || l.k} ${t.colCurrent}"></td>
      <td>${devTxt}</td><td>${tag}</td></tr>`;
  }).join("");
  $("rows").querySelectorAll("input[data-k]").forEach(inp => inp.addEventListener("change", e => {
    const v = parseFloat(e.target.value); current[e.target.dataset.k] = isNaN(v) ? 0 : v; render();
  }));
  const sgovUsd = anyCurrent ? (current.SGOV ?? 0) : p.total * r.tickers.SGOV / 100;
  $("rebalLine").innerHTML = (anyCurrent ? (flagged ? t.rebalYes(flagged) : t.rebalNo) : t.rebalEmpty) + " " + t.coverage((sgovUsd / p.expense).toFixed(1));
}

const REQUIRED = ["SPY","QQQ","QQQI","IBIT","VNQ","XLE","IAUM","URAN","LEAPS","SGOV"];
let lastBt = null;

function renderBacktest(p, r){
  const t = I18N[lang], body = $("btBody");
  if (!priceData){
    $("btRange").textContent = "";
    const msg = dataError ? (dataError.missing ? t.btBadCsv(dataError.missing) : t.btMissing) : t.btLoading;
    body.innerHTML = `<div class="alert info">${msg}</div>
      <div class="upload"><label for="csvFile" class="inl">${t.btUpload}</label> <input id="csvFile" type="file" accept=".csv,text/csv"></div>`;
    $("csvFile").addEventListener("change", e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(txt => loadCSV(txt));
    });
    return;
  }
  const d = priceData;
  $("btRange").textContent = t.btRange(d.dates[0], d.dates[d.dates.length-1], d.dates.length - 1);
  const res = runBacktest(d, r.tickers, {initial:p.total, monthly:num("dca") || 0, threshold:parseFloat($("threshold").value)});
  lastBt = res;
  const keys = ["strat","spy","qqq"];
  const rowsDef = [
    ["cagr", m => pc(m.cagr), "max"],
    ["total", m => pc(m.total), "max"],
    ["final", (m,x) => fmtUsd(x.values[x.values.length-1]), null],
    ["invested", (m,x) => fmtUsd(x.invested), null],
    ["mdd", m => pc(m.mdd), "max"],
    ["vol", m => pc(m.vol), "min"],
    ["sharpe", m => m.sharpe.toFixed(2), "max"],
    ["sortino", m => m.sortino.toFixed(2), "max"],
    ["calmar", m => m.calmar.toFixed(2), "max"],
    ["maxUw", m => m.maxUw, "min"],
    ["worstYear", m => pc(m.worstYear), "max"],
    ["posMonths", m => pc(m.posMonths), "max"]
  ];
  const tbl = rowsDef.map(([k, f, best]) => {
    let winner = null;
    if (best){
      const vals = keys.map(x => res[x].m[k]);
      const target = best === "max" ? Math.max(...vals) : Math.min(...vals);
      winner = keys[vals.indexOf(target)];
    }
    return `<tr><td>${t.mRows[k]}</td>${keys.map(x => `<td class="${x===winner?"win":""}">${f(res[x].m, res[x])}</td>`).join("")}</tr>`;
  }).join("");
  body.innerHTML = `
    <div class="chartbox"><canvas id="chart" role="img" aria-label="${t.btTitle}"></canvas></div>
    <div class="chartlegend">${keys.map(k => `<span class="ln-${k}">${t.mName[k]}</span>`).join("")}</div>
    <div class="tablewrap mt14"><table>
      <thead><tr><th>${t.metric}</th>${keys.map(k => `<th>${t.mName[k]}</th>`).join("")}</tr></thead>
      <tbody>${tbl}</tbody></table></div>
    <p class="takeaway">${t.takeaway(res)}</p>
    <ul class="caveats">${t.caveats.map(c => `<li>${c}</li>`).join("")}</ul>`;
  drawChart();
}

function drawChart(){
  const cv = $("chart"); if (!cv || !lastBt || !priceData) return;
  const dpr = window.devicePixelRatio || 1, rect = cv.getBoundingClientRect();
  cv.width = rect.width * dpr; cv.height = rect.height * dpr;
  const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height, L = 64, R = 12, T = 10, B = 26;
  const series = ["strat","spy","qqq"].map(k => ({k, v:lastBt[k].values}));
  const all = series.flatMap(s => s.v);
  const lo = Math.log(Math.min(...all)), hi = Math.log(Math.max(...all));
  const n = series[0].v.length;
  const x = i => L + (W - L - R) * i / (n - 1);
  const y = v => T + (H - T - B) * (1 - (Math.log(v) - lo) / (hi - lo || 1));
  ctx.font = "12px IBM Plex Sans, Noto Sans SC, sans-serif"; ctx.fillStyle = "#5B6B69"; ctx.strokeStyle = "#E3E9E6"; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++){
    const v = Math.exp(lo + (hi - lo) * i / 4), yy = y(v);
    ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(W - R, yy); ctx.stroke();
    ctx.textAlign = "right"; ctx.fillText(v >= 1e6 ? "$" + (v/1e6).toFixed(2) + "M" : "$" + Math.round(v/1000) + "k", L - 8, yy + 4);
  }
  ctx.textAlign = "center";
  const dates = priceData.dates; let lastYear = null;
  dates.forEach((d, i) => {
    const yr = d.slice(0,4);
    if (yr !== lastYear && d.slice(5,7) === "01" && (+yr % 2 === 0)){ ctx.fillText(yr, x(i), H - 6); }
    lastYear = yr;
  });
  series.slice().reverse().forEach(s => {
    ctx.strokeStyle = LINE[s.k]; ctx.lineWidth = s.k === "strat" ? 2.5 : 1.5;
    ctx.beginPath(); s.v.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))); ctx.stroke();
  });
}

function loadCSV(txt){
  try{
    const d = parseCSV(txt);
    const missing = REQUIRED.filter(c => !d.cols[c]);
    if (missing.length){ dataError = {missing: missing.join(", ")}; priceData = null; }
    else { priceData = d; dataError = null; }
  } catch(e){ dataError = {}; priceData = null; }
  render();
}

function renderSignals(){
  const t = I18N[lang];
  const spx = num("spx"), ma50 = num("spxMa50"), zg = num("zeroG"), qqq = num("qqq"), hi = num("qqqHigh"),
        rsi = num("rsi"), fng = num("fng"), aaii = num("aaii"), vix = num("vix"), vix3m = num("vix3m"),
        pe500 = num("pe500"), y10 = num("y10");
  const dd = (qqq && hi) ? (qqq / hi - 1) * 100 : null;
  const t1 = (spx !== null && ma50 !== null && spx <= ma50) || (dd !== null && dd <= -5);
  const lvl = (zg !== null && ma50 !== null) ? Math.min(zg, ma50) : null;
  const ratio = (vix && vix3m) ? vix / vix3m : null;
  const panic = [
    {txt:t.p1, on: fng !== null && fng < 25, m: fng !== null ? `${fng} / 25` : "—"},
    {txt:t.p2, on: aaii !== null && aaii > 50, m: aaii !== null ? `${aaii}% / 50%` : "—"},
    {txt:t.p3, on: ratio !== null && ratio > 1, m: ratio !== null ? `${ratio.toFixed(3)} / 1.000` : "—"},
    {txt:t.p4, on: rsi !== null && rsi < 35, m: rsi !== null ? `${rsi} / 35` : "—"},
    {txt:t.p5, on: spx !== null && lvl !== null && spx < lvl, m: (spx !== null && lvl !== null) ? `${spx} / ${lvl.toFixed(2)} (${t.gap} ${((lvl/spx-1)*100).toFixed(2)}%)` : "—"}
  ];
  const erp = (pe500 && y10 !== null) ? (100 / pe500 - y10) : null;
  const t1m = [
    (spx !== null && ma50 !== null) ? `SPX ${spx} / MA50 ${ma50} (${t.gap} ${((ma50/spx-1)*100).toFixed(2)}%)` : "",
    dd !== null ? `QQQ ${dd.toFixed(2)}% / −5%` : ""
  ].filter(Boolean).join(" · ");
  const items = [{txt:t.t1, on:t1, m:t1m}, ...panic, {txt:t.erp, on: erp !== null && erp >= 0.5, m: erp !== null ? `${erp.toFixed(2)}%` : "—"}];
  $("signals").innerHTML = items.map(i =>
    `<div class="sig ${i.on ? "on" : "off"}"><span class="t">${i.txt}</span><span class="state">${i.on ? t.met : t.notMet}</span><span class="m">${i.m}</span></div>`).join("");
  const nPanic = panic.filter(p => p.on).length;
  const v = nPanic >= 2 ? t.v23 : (t1 ? t.v1 : t.vNone);
  const leaps = (rsi !== null && rsi < 35 && nPanic >= 1) ? t.leapsYes : t.leapsNo;
  $("verdict").innerHTML = `<b>${v}</b>${leaps}${erp !== null ? " " + t.erpNote(erp.toFixed(2)) : ""}`;
}

SiteLang.subscribe(l => { lang = l; applyLang(); });
document.querySelectorAll("input:not([data-k]):not([type=radio]):not([type=file]),select").forEach(el => el.addEventListener("input", render));
let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(drawChart, 150); });
applyLang();
fetch("prices.csv", {cache:"no-cache"})
  .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
  .then(loadCSV)
  .catch(() => { dataError = {}; render(); });
