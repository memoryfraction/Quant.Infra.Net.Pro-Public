// Tool hub: add a new tool by adding one entry here (and one menu item in index.html / i18n nav keys).
(function () {
  var TOOLS = [
    { href: "/planner/fi/", en: ["Financial Independence", "Target assets, yearly saving needed, years to FI"], zh: ["财务自由计算器", "需要多少资产、每年要投多少、还要工作几年"] },
    { href: "/planner/allocation/", en: ["433 Allocation & Beta", "Pick a mix, cash floor, household exposure"], zh: ["433 配置与 Beta 体检", "阵型选择、现金底线、全家资产曝险"] },
    { href: "/planner/margin/", en: ["Pledge Loan Margin", "How far can the market fall before a margin call"], zh: ["质押维持率与断头台", "借几成、跌多少会触线"] },
    { href: "/planner/rebalance/", en: ["Smart Rebalancing", "Lock gains in up years, add in down years"], zh: ["聪明再平衡执行器", "上涨年锁利、下跌年补仓"] },
    { href: "/planner/withdrawal/", en: ["Withdrawal Ladder", "Asset multiple, draw rate, rescue mix"], zh: ["退休提领率阶梯", "资产倍数、提领率、救援配置"] },
    { href: "/planner/mortgage/", en: ["Prepay Mortgage or Invest", "After-tax real rate, two paths compared"], zh: ["房贷：提前还还是去投资", "税后实际利率与两条路径对比"] },
    { href: "/planner/social-security/", en: ["Social Security Claiming Age", "Break-even ages for 62 / 67 / 70"], zh: ["美国社安金领取年龄", "62 / 67 / 70 岁盈亏平衡"] },
    { href: "/calculator/", en: ["All-Weather Compounding Calculator", "Allocation, signals and historical back-test"], zh: ["全天候复利组合计算器", "配置、信号与历史回测"] },
    { href: "/macro/", en: ["Macro Cycle Spectrum", "Recession odds and market stance, updated daily"], zh: ["宏观周期", "衰退概率与市场姿态，每日更新"] }
  ];
  var TXT = {
    en: { title: "Family Wealth Planner", sub: "Turn book-level personal-finance methods into calculators you can run on your own numbers.",
          disc: "This tool simply turns the published methods in “Wealth Shortcut” (by 硅谷居士) and the “CLEC Handbook” into calculators, for my own use and for anyone who finds them helpful. Results are for learning only and are not investment, tax or legal advice; please make your own decisions. This site is not affiliated with or endorsed by the authors, CLEC or James." },
    zh: { title: "家庭财富规划工具箱", sub: "把理财书里的方法变成可以直接算的工具。输入自己的数字，看结果和公式。",
          disc: "本工具只是把《财富捷径》（硅谷居士）与《CLEC 宝典》中的公开方法论做成计算器，方便大家和我自己使用。计算结果仅供学习参考，不构成任何投资、税务或法律建议；请结合自身情况独立判断，盈亏自负。本站与原作者、CLEC 及 James 老师均无关联，也未获其背书。" }
  };
  function render() {
    var l = window.SiteLang.get(), t = TXT[l], box = document.getElementById("cards");
    document.title = t.title + " | Alpha Wealth Lab";
    document.getElementById("pageTitle").textContent = t.title;
    document.getElementById("pageSub").textContent = t.sub;
    document.getElementById("disc").textContent = t.disc;
    box.textContent = "";
    TOOLS.forEach(function (x) {
      var a = document.createElement("a"); a.className = "card"; a.href = x.href;
      var h3 = document.createElement("h3"); h3.textContent = x[l][0];
      var p = document.createElement("p"); p.textContent = x[l][1];
      a.appendChild(h3); a.appendChild(p); box.appendChild(a);
    });
  }
  window.SiteLang.subscribe(render);
  render();
})();
