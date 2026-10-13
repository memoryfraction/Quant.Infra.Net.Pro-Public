// Tool hub. The tool list lives in registry.js (window.AWL_TOOLS); this file
// only renders it and wires the tag filter. Add a tool by editing registry.js.
(function () {
  "use strict";

  var TXT = {
    en: {
      title: "Family Wealth Planner",
      sub: "Turn book-level personal-finance methods into calculators you can run on your own numbers.",
      disc: "This tool simply turns the published methods in “Wealth Shortcut” (by 硅谷居士) and the “CLEC Handbook” into calculators, for my own use and for anyone who finds them helpful. Results are for learning only and are not investment, tax or legal advice; please make your own decisions. This site is not affiliated with or endorsed by the authors, CLEC or James.",
      empty: "No tools in this category yet."
    },
    zh: {
      title: "家庭财富规划工具箱",
      sub: "把理财书里的方法变成可以直接算的工具。输入自己的数字，看结果和公式。",
      disc: "本工具只是把《财富捷径》（硅谷居士）与《CLEC 宝典》中的公开方法论做成计算器，方便大家和我自己使用。计算结果仅供学习参考，不构成任何投资、税务或法律建议；请结合自身情况独立判断，盈亏自负。本站与原作者、CLEC 及 James 老师均无关联，也未获其背书。",
      empty: "这个分类下暂时还没有工具。"
    }
  };

  var activeTag = "all";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function card(x, l, copy) {
    var a = el("a", "card");
    a.href = x.href;
    a.appendChild(el("h3", null, x[l][0]));
    a.appendChild(el("p", null, x[l][1]));
    if (x.source && x.source.name) {
      // Methodology attribution: name only, in plain text.
      a.appendChild(el("p", "src", copy.sourcePrefix + x.source.name));
    }
    return a;
  }

  function renderFilters(box, tags, copy, l, rerender) {
    box.textContent = "";
    box.appendChild(el("span", "flabel", copy.filterLabel));
    ["all"].concat(tags).forEach(function (id) {
      var b = el("button", "chip" + (id === activeTag ? " on" : ""), window.AWL_TAG_COPY[l][id] || id);
      b.type = "button";
      b.addEventListener("click", function () {
        activeTag = id;
        rerender();
      });
      box.appendChild(b);
    });
  }

  function render() {
    var l = window.SiteLang.get();
    var t = TXT[l] || TXT.en;
    var copy = window.AWL_REGISTRY_COPY[l] || window.AWL_REGISTRY_COPY.en;
    var tools = window.AWL_TOOLS || [];
    var box = document.getElementById("cards");
    if (!box) return;

    document.title = t.title + " | Alpha Wealth Lab";
    document.getElementById("pageTitle").textContent = t.title;
    document.getElementById("pageSub").textContent = t.sub;
    document.getElementById("disc").textContent = t.disc;

    // Only offer filters that some tool actually uses.
    var used = {};
    tools.forEach(function (x) { (x.tags || []).forEach(function (g) { used[g] = 1; }); });
    var tags = (window.AWL_TOOL_TAGS || []).filter(function (g) { return used[g]; });
    if (activeTag !== "all" && tags.indexOf(activeTag) < 0) activeTag = "all";

    var fbox = document.getElementById("filters");
    if (fbox) renderFilters(fbox, tags, copy, l, render);

    box.textContent = "";
    var shown = tools.filter(function (x) { return activeTag === "all" || (x.tags || []).indexOf(activeTag) >= 0; });
    if (!shown.length) {
      box.appendChild(el("p", "empty", t.empty));
      return;
    }
    shown.forEach(function (x) { box.appendChild(card(x, l, copy)); });
  }

  window.SiteLang.subscribe(render);
  render();
})();
