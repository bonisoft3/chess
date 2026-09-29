// The rating fit, plain arithmetic over finished games: logistic
// (Bradley–Terry) Elo with the Stockfish anchors fixed at their nominal
// UCI_Elo, a draw half a win to each side. One virtual draw is added to every
// pairing that was played, so a perfect or zero score stays finite. ± is one
// standard error from the inverse observed-information matrix of the free
// ratings. `shown` is what the app prints (ir decision-30): the fit rounded to
// fifty, or, for a bot scoring nine in ten against the strongest anchor it met,
// that anchor with a plus.
export const BOTS = ["nell", "otto", "vera", "magnus", "sable"];
const PRIOR = 1;
const isAnchor = (p) => /^sf\d+$/.test(p);
const E = (d) => 1 / (1 + 10 ** (-d / 400));
const C = Math.log(10) / 400;
const round50 = (x) => Math.round(x / 50) * 50;

export const rate = (games) => {
  const players = [...new Set(games.flatMap((g) => [g.white, g.black]))];
  const free = players.filter((p) => !isAnchor(p));
  const fixed = Object.fromEntries(players.filter(isAnchor).map((p) => [p, Number(p.slice(2))]));

  // Pairwise tallies: n games, s = score of the first (sorted) player.
  const pairs = {};
  for (const g of games) {
    const [a, b] = [g.white, g.black].sort();
    const sa = g.white === a ? g.result : 1 - g.result;
    const k = `${a}|${b}`;
    pairs[k] ??= { a, b, n: 0, s: 0, w: 0, d: 0, l: 0 };
    pairs[k].n += 1; pairs[k].s += sa;
    if (sa === 1) pairs[k].w += 1; else if (sa === 0) pairs[k].l += 1; else pairs[k].d += 1;
  }

  const R = Object.fromEntries(players.map((p) => [p, fixed[p] ?? 1500]));
  const idx = Object.fromEntries(free.map((p, i) => [p, i]));
  // The log-likelihood's gradient and negative Hessian at the current ratings.
  const assemble = () => {
    const g = new Array(free.length).fill(0);
    const H = free.map(() => new Array(free.length).fill(0));
    for (const { a, b, n, s } of Object.values(pairs)) {
      const N = n + PRIOR, S = s + PRIOR / 2;
      const e = E(R[a] - R[b]);
      const grad = C * (S - N * e);       // d logL / d R_a
      const h = C * C * N * e * (1 - e);  // -d2 logL / d R_a^2
      if (a in idx) { g[idx[a]] += grad; H[idx[a]][idx[a]] += h; }
      if (b in idx) { g[idx[b]] -= grad; H[idx[b]][idx[b]] += h; }
      if (a in idx && b in idx) { H[idx[a]][idx[b]] -= h; H[idx[b]][idx[a]] -= h; }
    }
    return { g, H };
  };
  for (let it = 0; it < 200; it += 1) {
    const { g, H } = assemble();
    const step = solve(H, g);
    let max = 0;
    free.forEach((p, i) => { const d = Math.max(-400, Math.min(400, step[i])); R[p] += d; max = Math.max(max, Math.abs(d)); });
    if (max < 1e-6) break;
  }
  // Covariance = H^-1 at the optimum.
  const cov = invert(assemble().H);
  const se = Object.fromEntries(free.map((p, i) => [p, Math.sqrt(cov[i][i])]));

  // Per-bot raw record, and per-anchor performance (the anchor rating plus the
  // logistic inverse of the score, with the same half-draw prior) as a
  // consistency check between anchors.
  const record = {};
  for (const p of BOTS) {
    const rows = Object.values(pairs).filter((x) => x.a === p || x.b === p).map((x) => {
      const mine = x.a === p;
      return { vs: mine ? x.b : x.a, n: x.n, score: mine ? x.s : x.n - x.s, w: mine ? x.w : x.l, d: x.d, l: mine ? x.l : x.w };
    });
    const tot = rows.reduce((t, r) => ({ n: t.n + r.n, score: t.score + r.score, w: t.w + r.w, d: t.d + r.d, l: t.l + r.l }), { n: 0, score: 0, w: 0, d: 0, l: 0 });
    const perf = Object.fromEntries(rows.filter((r) => isAnchor(r.vs)).map((r) => {
      const f = (r.score + 0.5) / (r.n + 1);
      return [r.vs, Math.round(fixed[r.vs] + 400 * Math.log10(f / (1 - f)))];
    }));
    record[p] = { total: tot, vs: rows.sort((x, y) => x.vs.localeCompare(y.vs)), performance_vs_anchor: perf };
  }
  const shown = (p) => {
    const top = record[p].vs.filter((r) => isAnchor(r.vs)).sort((x, y) => fixed[y.vs] - fixed[x.vs])[0];
    return top !== undefined && top.score / top.n >= 0.9 ? `${fixed[top.vs]}+` : String(round50(R[p]));
  };
  const terminations = {};
  for (const g of games) terminations[g.termination] = (terminations[g.termination] ?? 0) + 1;
  return {
    method: {
      model: "Bradley-Terry / logistic Elo, P = 1/(1+10^(-(Ri-Rj)/400)), draws = 1/2",
      anchors_fixed: fixed,
      prior: `${PRIOR} virtual draw per played pairing`,
      error: "1 s.e. from inverse observed information",
      games: games.length,
    },
    ratings: Object.fromEntries(BOTS.filter((p) => p in R).map((p) => [p, { elo: Math.round(R[p]), se: Math.round(se[p]), shown: shown(p) }])),
    record,
    terminations,
  };
};

function solve(A, b) {
  const n = b.length; const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c += 1) {
    let piv = c; for (let r = c + 1; r < n; r += 1) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r += 1) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k += 1) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
function invert(A) {
  const n = A.length;
  return A.map((_, j) => solve(A, A.map((__, i) => (i === j ? 1 : 0)))).reduce((inv, col, j) => { col.forEach((v, i) => { inv[i][j] = v; }); return inv; }, A.map(() => new Array(n).fill(0)));
}
