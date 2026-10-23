// planner/assets/qr.js — vendored encoder (MIT) plus our AWLQR wrapper.
module.exports = function (t) {
  const fs = require("fs"), path = require("path");
  const file = path.join(__dirname, "..", "assets", "qr.js");
  const Q = require(file);

  const url = "https://www.alpha-wealth-lab.com/planner/allocation/?s=abc&from=share&via=Rex";
  const m = Q.encode(url);
  t.ok(m.size >= 21 && (m.size - 21) % 4 === 0, "qr: valid module count (21 + 4n), got " + m.size);

  // three finder patterns: 7x7 dark ring, light ring, 3x3 dark core, in three corners
  const finder = (ox, oy) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const edge = x === 0 || x === 6 || y === 0 || y === 6, core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      if (m.at(ox + x, oy + y) !== (edge || core)) return false;
    }
    return true;
  };
  t.ok(finder(0, 0), "qr: top-left finder pattern");
  t.ok(finder(m.size - 7, 0), "qr: top-right finder pattern");
  t.ok(finder(0, m.size - 7), "qr: bottom-left finder pattern");

  t.eq(m.at(-1, 0), false, "qr: at() outside the grid is false (negative)");
  t.eq(m.at(0, m.size), false, "qr: at() outside the grid is false (past the end)");

  // deterministic, and different text gives a different symbol
  const again = Q.encode(url), other = Q.encode(url + "x");
  let same = true;
  for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.at(x, y) !== again.at(x, y)) same = false;
  t.ok(same, "qr: encoding is deterministic");
  let diff = other.size !== m.size;
  for (let y = 0; !diff && y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.at(x, y) !== other.at(x, y)) { diff = true; break; }
  t.ok(diff, "qr: different input gives a different symbol");

  // no network, license kept
  const src = fs.readFileSync(file, "utf8");
  t.ok(/MIT license/i.test(src) && /Kazuhiko Arase/.test(src), "qr: license notice kept in the vendored file");
  t.ok(!/XMLHttpRequest|fetch\(|sendBeacon|https?:\/\/[^\s"')]*\.(js|json)\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), "qr: makes no network requests");
};
