// /join/ shows the group QR served by GET /api/join; join.js decides what to display.
module.exports = function (t) {
  const path = require("path");
  const J = require(path.join(__dirname, "..", "..", "join", "join.js"));
  const IMG = "data:image/png;base64,iVBORw0KGgo=";

  t.eq(J.decide({ group: { img: IMG, expires: "2026-10-20", name: "G" }, expired: false }).mode, "qr", "join: valid group -> qr");
  t.eq(J.decide({ group: { img: IMG, expires: "2026-10-20" } }).name, "", "join: missing name -> empty");
  t.eq(J.decide({ group: null, expired: true }).mode, "expired", "join: expired flag -> expired");
  t.eq(J.decide({ group: null, expired: false }).mode, "none", "join: nothing configured -> none");
  t.eq(J.decide(null).mode, "none", "join: null payload -> none");
  t.eq(J.decide(undefined).mode, "none", "join: undefined payload -> none");
  t.eq(J.decide({}).mode, "none", "join: empty object -> none");
  // never render anything that is not a real image data URL
  t.eq(J.decide({ group: { img: "javascript:alert(1)", expires: "2026-10-20" } }).mode, "none", "join: javascript: url rejected");
  t.eq(J.decide({ group: { img: "data:text/html;base64,PGI+", expires: "2026-10-20" } }).mode, "none", "join: html data url rejected");
  t.eq(J.decide({ group: { img: "https://evil.example/x.png", expires: "2026-10-20" } }).mode, "none", "join: remote url rejected");
  t.eq(J.decide({ group: { img: IMG, expires: "soon" } }).mode, "none", "join: bad date rejected");
  t.eq(J.decide({ group: { img: IMG, expires: "2026-10-20", name: "x".repeat(100) } }).name.length, 40, "join: name clipped to 40");
};
