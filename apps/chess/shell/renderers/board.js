// A position, small. The shelf shows four boards standing and a thumbnail is
// what tells them apart at a glance — but sixty-four cells per row is not a
// column a template can bind, and it is not worth sixty-four rows per game
// either.
//
// So it is a renderer: one FEN in, sixty-four nodes out, drawn by the screen's
// own stylesheet off the classes below. The node schema admits no style
// attribute — deliberately — which is exactly why the colours stay in CSS
// where the design tokens already live.
(value) => {
  const GLYPH = {
    K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟",
    k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
  };
  const rows = String(value ?? "").split(" ")[0].split("/");
  const cells = [];
  for (let r = 0; r < 8; r += 1) {
    let f = 0;
    for (const ch of rows[r] ?? "8") {
      if (ch >= "1" && ch <= "9") {
        for (let i = 0; i < Number(ch); i += 1) {
          cells.push({ r, f, piece: "" });
          f += 1;
        }
      } else {
        cells.push({ r, f, piece: ch });
        f += 1;
      }
    }
  }
  const node = (c) => {
    const shade = (c.r + c.f) % 2 === 0 ? "mc light" : "mc dark";
    if (c.piece === "") return { tag: "span", attrs: { class: shade } };
    const white = c.piece === c.piece.toUpperCase();
    return {
      tag: "span",
      attrs: { class: shade },
      children: [{ tag: "span", attrs: { class: white ? "mp w" : "mp b" }, children: [GLYPH[c.piece]] }],
    };
  };
  return [{ tag: "div", attrs: { class: "mini" }, children: cells.map(node) }];
};
