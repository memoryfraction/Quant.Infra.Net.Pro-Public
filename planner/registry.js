/*
 * planner/registry.js — the single source of truth for the tool list.
 *
 * hub.js renders from this, and each tool page shows its "方法论参考"
 * (methodology reference) from here. Add a tool by adding one entry.
 *
 *   window.AWL_TOOLS = [{
 *     slug,                       // matches /planner/<slug>/
 *     author,                     // id from AWL_AUTHORS: whose method this tool implements
 *     href,                       // canonical page
 *     en: [title, desc], zh: [title, desc],
 *     source: { name, url, kind },// kind: "book" | "video" | "author"
 *     tags: [...]                 // used by the hub filter
 *   }]
 *
 * Only names and public home pages are recorded — no cover art, no book text.
 * `source.url` points at the author's public site (or the hub section), never
 * at a copy of the material.
 */
(function () {
  "use strict";

  // Tag ids are language-neutral; the copy lives in TAGS below.
  var TAG_IDS = ["fi", "allocation", "leverage", "retirement", "debt", "tax", "us"];

  var TOOLS = [
    {
      slug: "fi",
      author: "silicon_valley",
      href: "/planner/fi/",
      en: ["Financial Independence", "Target assets, how much to invest each year, how many years of work remain"],
      zh: ["财务自由计算器", "需要多少资产、每年要投多少、还要工作几年"],
      source: { name: "Wealth Shortcut / 硅谷居士", url: "/planner/", kind: "book" },
      tags: ["fi", "allocation", "retirement"]
    },
    {
      slug: "allocation",
      author: "clec",
      href: "/planner/allocation/",
      en: ["433 Allocation & Beta", "Split index fund, leveraged ETF and cash; see the portfolio's beta and the cash floor"],
      zh: ["433 配置与 Beta 体检", "指数基金、杠杆 ETF、现金怎么配，整体波动是大盘的几倍"],
      source: { name: "CLEC Handbook / CLEC 宝典", url: "/planner/", kind: "book" },
      tags: ["allocation", "leverage", "fi"]
    },
    {
      slug: "margin",
      author: "clec",
      href: "/planner/margin/",
      en: ["Pledge Loan Margin", "How far the market can fall before a pledged-stock loan is called"],
      zh: ["质押维持率与断头台", "借几成、跌多少会触线"],
      source: { name: "CLEC Handbook / CLEC 宝典", url: "/planner/", kind: "book" },
      tags: ["leverage", "allocation"]
    },
    {
      slug: "rebalance",
      author: "clec",
      href: "/planner/rebalance/",
      en: ["Smart Rebalancing", "Lock gains in up years, add in down years"],
      zh: ["聪明再平衡执行器", "上涨年锁利、下跌年补仓"],
      source: { name: "CLEC Handbook / CLEC 宝典", url: "/planner/", kind: "book" },
      tags: ["allocation", "leverage"]
    },
    {
      slug: "withdrawal",
      author: "clec",
      href: "/planner/withdrawal/",
      en: ["Withdrawal Ladder", "Asset multiple, draw rate and the rescue mix for a bad year"],
      zh: ["退休提领率阶梯", "资产倍数、提领率、救援配置"],
      source: { name: "CLEC Handbook / CLEC 宝典 · Wealth Shortcut / 硅谷居士 (4% rule)", url: "/planner/", kind: "book" },
      tags: ["retirement", "allocation", "fi"]
    },
    {
      slug: "mortgage",
      author: "silicon_valley",
      href: "/planner/mortgage/",
      en: ["Prepay Mortgage or Invest", "After-tax real rate, and the two paths compared"],
      zh: ["房贷：提前还还是去投资", "税后实际利率与两条路径对比"],
      source: { name: "Wealth Shortcut / 硅谷居士", url: "/planner/", kind: "book" },
      tags: ["debt", "tax", "allocation"]
    },
    {
      slug: "social-security",
      author: "silicon_valley",
      href: "/planner/social-security/",
      en: ["Social Security Claiming Age", "Monthly amounts and break-even ages for 62 / 67 / 70"],
      zh: ["美国社安金领取年龄", "62 / 67 / 70 岁的每月金额与盈亏平衡"],
      source: { name: "Wealth Shortcut / 硅谷居士", url: "/planner/", kind: "book" },
      tags: ["retirement", "us", "tax"]
    },
    // Non-planner pages keep their own cards on the hub.
    {
      slug: "calculator",
      author: "mine",
      href: "/calculator/",
      en: ["All-Weather Compounding Calculator", "Allocation, signals and historical back-test"],
      zh: ["全天候复利组合计算器", "配置、信号与历史回测"],
      source: null,
      tags: ["allocation"]
    },
    {
      slug: "macro",
      author: "mine",
      href: "/macro/",
      en: ["Macro Cycle Spectrum", "Recession odds and market stance, updated daily"],
      zh: ["宏观周期", "衰退概率与市场姿态，每日更新"],
      source: null,
      tags: []
    }
  ];

  // Whose methodology a tool implements. Display order = array order.
  //   soon:   no tool yet — the hub shows a "coming soon" placeholder
  //   hidden: reserved for the future — not shown anywhere until a tool uses it
  // "mine" = the site's own original tools (not a borrowed method).
  var AUTHORS = [
    { id: "clec", en: "CLEC · James", zh: "CLEC · James 老师",
      descEn: "Allocation, leverage and pledge-loan discipline from the CLEC Handbook.",
      descZh: "来自《CLEC 宝典》的配置、杠杆与质押纪律。" },
    { id: "silicon_valley", en: "硅谷居士 · Wealth Shortcut", zh: "硅谷居士 · 《财富捷径》",
      descEn: "Financial independence, mortgage and Social Security maths from the book.",
      descZh: "来自《财富捷径》的财务自由、房贷与社安金算法。" },
    { id: "mine", en: "Original tools", zh: "原创工具",
      descEn: "Built by this site, not taken from any one author.",
      descZh: "本站自己做的组合与宏观工具，不属于任何一位作者。" },
    { id: "beiban", en: "Beiban (贝版)", zh: "贝版", soon: true,
      descEn: "Tools based on Beiban's methods are planned.",
      descZh: "基于贝版方法的工具正在规划中。" },
    { id: "adam_khoo", en: "Adam Khoo", zh: "Adam Khoo", hidden: true,
      descEn: "Reserved.", descZh: "预留。" }
  ];

  // Filter labels (the hub renders one chip per tag that is actually used).
  var TAGS = {
    en: {
      all: "All",
      fi: "Financial independence", allocation: "Asset allocation", leverage: "Leverage",
      retirement: "Retirement", debt: "Debt", tax: "Tax", us: "US-specific"
    },
    zh: {
      all: "全部",
      fi: "财务自由", allocation: "资产配置", leverage: "杠杆",
      retirement: "退休", debt: "债务", tax: "税务", us: "美国"
    }
  };

  var COPY = {
    en: { sourcePrefix: "Method source: ", filterLabel: "Filter:", soon: "Coming soon", ask: "Which one would you like first? Tell us at", count: " tools" },
    zh: { sourcePrefix: "方法论参考：", filterLabel: "筛选：", soon: "即将推出", ask: "最想先要哪一个？欢迎来信：", count: " 个工具" }
  };

  window.AWL_TOOLS = TOOLS;
  window.AWL_AUTHORS = AUTHORS;
  window.AWL_TOOL_TAGS = TAG_IDS;
  window.AWL_TAG_COPY = TAGS;
  window.AWL_REGISTRY_COPY = COPY;
})();
