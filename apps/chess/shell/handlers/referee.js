// referee — the game plays itself out of its own rows.
//
// The rules of chess: move generation, king safety, castling, en passant,
// promotion, the draw conditions, SAN, and the house's reply. Rows in,
// updates out — no DOM, no clock, no randomness of its own, so the same
// reduce that drives the board is the one the perft suite counts.
//
// Two derived tables hang off the game row and are recomputed absolutely on
// every wake: `square`, the sixty-four cells the board is drawn from, and
// `legal`, every move that may be played from the position now standing.
// Only rows that actually differ are written, which is what stops a mutation
// wake from waking itself.
//
// `legal` is the load-bearing one. A move is not a function the screen calls:
// it is a row carrying the position it leads to, so playing one is copying that
// position's columns onto the game. That makes "is this move legal" a question
// about data rather than about code — and it is the same question a perft count
// asks, which is why the oracle needs no test-only surface to reach.

const FILES = "abcdefgh";
const PROMOS = ["Q", "R", "B", "N"];
const WHITE = "PNBRQK";
const BLACK = "pnbrqk";

// Rank 0 is rank EIGHT: the board array reads in FEN order, so parsing and
// rendering are the same walk.
const algOf = (sq) => `${FILES[sq & 7]}${8 - (sq >> 3)}`;
const sqOf = (a) => (8 - Number(a[1])) * 8 + FILES.indexOf(a[0]);
const onBoard = (r, f) => r >= 0 && r < 8 && f >= 0 && f < 8;
const mineOf = (white) => (p) => p !== "" && (white ? WHITE : BLACK).includes(p);

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KINGV = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// One glyph per piece KIND, in the solid figures. Which side it belongs to is
// a colour, not a codepoint: the outline figures read as white on paper and as
// white again on the dark stock, where the solid ones in the paper colour do
// too — so the pair stops distinguishing anything the moment the ground moves.
// A white piece is this figure filled with the ground and stroked in ink,
// which is how a printed diagram draws one and inverts correctly.
const GLYPH = {
  K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

// What a square is called out loud. Sixty-four buttons whose only content is
// a coordinate strip on the edge ones are sixty-four buttons named "button",
// and the board is now a single tab stop a reader arrives on blind.
const KIND = {k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn"};

// A dot where nothing stands, so a board is sixty-four characters and a square
// is an index into it. The rules below hold an empty square as the empty
// string, which is the whole of what the two converters either side translate.
const EMPTY = ".";

// The suffix the columns of a position wear. A game row names the position now
// standing; a move row and a legal row each name the one it reached.
const NOW = "";
const AFTER = "_after";

const boardOf = (p) => p.b.map((c) => (c === "" ? EMPTY : c)).join("");

const toFen = (p) => {
  let board = "";
  for (let r = 0; r < 8; r += 1) {
    let gap = 0;
    for (let f = 0; f < 8; f += 1) {
      const piece = p.b[r * 8 + f];
      if (piece === "") { gap += 1; continue; }
      if (gap > 0) { board += String(gap); gap = 0; }
      board += piece;
    }
    if (gap > 0) board += String(gap);
    if (r < 7) board += "/";
  }
  const castle = p.castle === "" ? "-" : p.castle;
  const ep = p.ep < 0 ? "-" : algOf(p.ep);
  return `${board} ${p.w ? "w" : "b"} ${castle} ${ep} ${p.half} ${p.full}`;
};

// The whole of what the wire format admits: eight ranks of run lengths and
// pieces, the side to move, the rights, the square a pawn may be taken on in
// passing, and the two counters.
const FEN = /^([1-8pnbrqkPNBRQK]+(?:\/[1-8pnbrqkPNBRQK]+){7}) ([wb]) (-|K?Q?k?q?) (-|[a-h][36]) (\d{1,3}) (\d{1,4})$/;

// A position read out of the wire format. Run lengths expand to sixty-four
// squares or the string names a board no game can be played on — the one place
// that count is in question, and it is answered before anything indexes it.
const fromFen = (fen) => {
  const said = FEN.exec(String(fen));
  if (said === null) throw new Error(`not a position: ${fen}`);
  const b = [];
  for (const ch of said[1]) {
    if (ch === "/") continue;
    if (ch >= "1" && ch <= "8") {
      for (let i = 0; i < Number(ch); i += 1) b.push("");
    } else b.push(ch);
  }
  if (b.length !== 64) throw new Error(`a board of ${b.length} squares: ${fen}`);
  return {
    b,
    w: said[2] === "w",
    castle: said[3] === "-" ? "" : said[3],
    ep: said[4] === "-" ? -1 : sqOf(said[4]),
    half: Number(said[5]),
    full: Number(said[6]),
  };
};

// The position a row carries. Its columns ARE the position, each one wide
// enough for exactly what it means and no wider; a row that names its position
// in the wire format alone is imported here, and the recompute below writes it
// back in the columns.
const positionOf = (row, at) => {
  const board = row[`board${at}`];
  if (board === undefined) return fromFen(row[`fen${at}`]);
  const ep = String(row[`ep${at}`]);
  return {
    b: String(board).split("").map((c) => (c === EMPTY ? "" : c)),
    w: row[`turn${at}`] === "white",
    castle: String(row[`castling${at}`]),
    ep: ep === "" ? -1 : sqOf(ep),
    half: Number(row[`halfmove${at}`]),
    full: Number(row[`fullmove${at}`]),
  };
};

// And the columns a row states one in. The wire spelling rides along because
// that is the format every other board reads a position in, and because a
// template binds a field and cannot assemble one.
const columnsOf = (p, at) => {
  const row = {};
  row[`board${at}`] = boardOf(p);
  row[`turn${at}`] = p.w ? "white" : "black";
  row[`castling${at}`] = p.castle;
  row[`ep${at}`] = p.ep < 0 ? "" : algOf(p.ep);
  row[`halfmove${at}`] = p.half;
  row[`fullmove${at}`] = p.full;
  row[`fen${at}`] = toFen(p);
  return row;
};

const START = fromFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

const kingSq = (b, white) => b.indexOf(white ? "K" : "k");

// Is `sq` attacked by the side `byWhite`? Read outward from the square rather
// than over every enemy piece: the cost is the geometry, not the position.
const attacked = (b, sq, byWhite) => {
  const r = sq >> 3;
  const f = sq & 7;
  const pr = byWhite ? r + 1 : r - 1;
  const pawn = byWhite ? "P" : "p";
  for (const df of [-1, 1]) {
    if (onBoard(pr, f + df) && b[pr * 8 + f + df] === pawn) return true;
  }
  const knight = byWhite ? "N" : "n";
  for (const [dr, df] of KNIGHT) {
    if (onBoard(r + dr, f + df) && b[(r + dr) * 8 + f + df] === knight) return true;
  }
  const king = byWhite ? "K" : "k";
  for (const [dr, df] of KINGV) {
    if (onBoard(r + dr, f + df) && b[(r + dr) * 8 + f + df] === king) return true;
  }
  const rays = [[DIAG, byWhite ? "BQ" : "bq"], [ORTH, byWhite ? "RQ" : "rq"]];
  for (const [dirs, hitters] of rays) {
    for (const [dr, df] of dirs) {
      let rr = r + dr;
      let ff = f + df;
      while (onBoard(rr, ff)) {
        const piece = b[rr * 8 + ff];
        if (piece !== "") {
          if (hitters.includes(piece)) return true;
          break;
        }
        rr += dr;
        ff += df;
      }
    }
  }
  return false;
};

// Every move one piece makes, legality aside. A square at a time, because
// "has this side a reply at all" is settled by the first piece that has one and
// must not cost the whole set.
const movesOf = (p, sq, mine, theirs) => {
  const out = [];
  const piece = p.b[sq];
  if (piece === "" || !mine(piece)) return out;
  const r = sq >> 3;
  const f = sq & 7;
  const kind = piece.toUpperCase();
  if (kind === "P") {
    const dir = p.w ? -1 : 1;
    const home = p.w ? 6 : 1;
    const crown = p.w ? 0 : 7;
    const one = r + dir;
    if (onBoard(one, f) && p.b[one * 8 + f] === "") {
      if (one === crown) {
        for (const q of PROMOS) out.push({ from: sq, to: one * 8 + f, promo: q });
      } else {
        out.push({ from: sq, to: one * 8 + f, promo: "" });
        const two = r + 2 * dir;
        if (r === home && p.b[two * 8 + f] === "") {
          out.push({ from: sq, to: two * 8 + f, promo: "", dbl: true });
        }
      }
    }
    for (const df of [-1, 1]) {
      if (!onBoard(one, f + df)) continue;
      const to = one * 8 + f + df;
      if (theirs(p.b[to])) {
        if (one === crown) {
          for (const q of PROMOS) out.push({ from: sq, to, promo: q });
        } else out.push({ from: sq, to, promo: "" });
      } else if (to === p.ep && p.b[to] === "") {
        out.push({ from: sq, to, promo: "", epTake: true });
      }
    }
    return out;
  }
  if (kind === "N" || kind === "K") {
    for (const [dr, df] of kind === "N" ? KNIGHT : KINGV) {
      if (!onBoard(r + dr, f + df)) continue;
      const to = (r + dr) * 8 + f + df;
      if (!mine(p.b[to])) out.push({ from: sq, to, promo: "" });
    }
    return out;
  }
  const dirs = kind === "B" ? DIAG : kind === "R" ? ORTH : DIAG.concat(ORTH);
  for (const [dr, df] of dirs) {
    let rr = r + dr;
    let ff = f + df;
    while (onBoard(rr, ff)) {
      const to = rr * 8 + ff;
      const there = p.b[to];
      if (mine(there)) break;
      out.push({ from: sq, to, promo: "" });
      if (there !== "") break;
      rr += dr;
      ff += df;
    }
  }
  return out;
};

// Castling, which belongs to the position rather than to a square. The rights
// say the king and rook have not moved; the rest is read off the board,
// including the three squares the king may not be attacked on — the one rule
// that cannot wait for the legality filter, because the square it is about is
// not the one the king ends on.
const castles = (p) => {
  const out = [];
  const home = p.w ? 60 : 4;
  if (p.b[home] !== (p.w ? "K" : "k")) return out;
  const short = p.w ? "K" : "k";
  const long = p.w ? "Q" : "q";
  const foe = !p.w;
  if (
    p.castle.includes(short) && p.b[home + 1] === "" && p.b[home + 2] === "" &&
    !attacked(p.b, home, foe) && !attacked(p.b, home + 1, foe) && !attacked(p.b, home + 2, foe)
  ) out.push({ from: home, to: home + 2, promo: "", castle: "short" });
  if (
    p.castle.includes(long) && p.b[home - 1] === "" && p.b[home - 2] === "" && p.b[home - 3] === "" &&
    !attacked(p.b, home, foe) && !attacked(p.b, home - 1, foe) && !attacked(p.b, home - 2, foe)
  ) out.push({ from: home, to: home - 2, promo: "", castle: "long" });
  return out;
};

const pseudo = (p) => {
  const mine = mineOf(p.w);
  const theirs = mineOf(!p.w);
  const out = [];
  for (let sq = 0; sq < 64; sq += 1) {
    for (const m of movesOf(p, sq, mine, theirs)) out.push(m);
  }
  for (const m of castles(p)) out.push(m);
  return out;
};

// The four corners whose occupant is the right it stands for: a rook leaving
// one, or being taken on one, is the right ending either way.
const CORNER = { 63: "K", 56: "Q", 7: "k", 0: "q" };

const make = (p, m) => {
  const b = p.b.slice();
  const piece = b[m.from];
  const kind = piece.toUpperCase();
  const took = b[m.to] !== "" || m.epTake === true;
  b[m.from] = "";
  if (m.epTake === true) b[p.w ? m.to + 8 : m.to - 8] = "";
  b[m.to] = m.promo === "" ? piece : (p.w ? m.promo : m.promo.toLowerCase());
  if (m.castle === "short") { b[m.from + 3] = ""; b[m.from + 1] = p.w ? "R" : "r"; }
  if (m.castle === "long") { b[m.from - 4] = ""; b[m.from - 1] = p.w ? "R" : "r"; }
  let castle = p.castle;
  const drop = (ch) => { castle = castle.split("").filter((c) => c !== ch).join(""); };
  if (kind === "K") { drop(p.w ? "K" : "k"); drop(p.w ? "Q" : "q"); }
  if (CORNER[m.from] !== undefined) drop(CORNER[m.from]);
  if (CORNER[m.to] !== undefined) drop(CORNER[m.to]);
  return {
    b,
    w: !p.w,
    castle,
    ep: m.dbl === true ? (m.from + m.to) / 2 : -1,
    half: kind === "P" || took ? 0 : p.half + 1,
    full: p.w ? p.full : p.full + 1,
  };
};

const inCheck = (p) => {
  const k = kingSq(p.b, p.w);
  return k >= 0 && attacked(p.b, k, !p.w);
};

const lawful = (p) => (m) => {
  const n = make(p, m);
  const k = kingSq(n.b, p.w);
  return k >= 0 && !attacked(n.b, k, !p.w);
};

const legal = (p) => pseudo(p).filter(lawful(p));

// Whether the side to move has a reply at all, which is the whole of what mate
// asks. The first piece with one settles it: a position is not mate the moment
// a single move answers it, and naming a check must not cost a move list.
const answerable = (p) => {
  const mine = mineOf(p.w);
  const theirs = mineOf(!p.w);
  const holds = lawful(p);
  // The king first, because a check is most often answered by walking out of
  // it, and because the square it stands on is already known.
  const k = kingSq(p.b, p.w);
  if (k >= 0 && movesOf(p, k, mine, theirs).some(holds)) return true;
  for (let sq = 0; sq < 64; sq += 1) {
    if (sq === k || !mine(p.b[sq])) continue;
    if (movesOf(p, sq, mine, theirs).some(holds)) return true;
  }
  return castles(p).some(holds);
};

// The moves of a legal set that could wear the same name, by the square they
// land on and the figure that lands there. Built once for the set, because
// disambiguation is a question about every other move to the same square and
// asking the list per move would cost the list per move.
const rivalsIn = (p, all) => {
  const by = {};
  for (const m of all) {
    const k = `${m.to}${p.b[m.from]}`;
    if (by[k] === undefined) by[k] = [];
    by[k].push(m);
  }
  return by;
};

// SAN, disambiguated against the legal set it belongs to. Mate is only asked
// about when the move gives check, which is what keeps naming a move cheaper
// than searching from it.
const sanOf = (p, m, by, after) => {
  const piece = p.b[m.from];
  const kind = piece.toUpperCase();
  const checks = inCheck(after);
  const suffix = checks ? (answerable(after) ? "+" : "#") : "";
  if (m.castle !== undefined) return (m.castle === "short" ? "O-O" : "O-O-O") + suffix;
  const took = p.b[m.to] !== "" || m.epTake === true;
  if (kind === "P") {
    const body = took ? `${FILES[m.from & 7]}x${algOf(m.to)}` : algOf(m.to);
    return `${body}${m.promo === "" ? "" : `=${m.promo}`}${suffix}`;
  }
  const rivals = by[`${m.to}${piece}`].filter((o) => o !== m);
  let mark = "";
  if (rivals.length > 0) {
    if (!rivals.some((o) => (o.from & 7) === (m.from & 7))) mark = FILES[m.from & 7];
    else if (!rivals.some((o) => (o.from >> 3) === (m.from >> 3))) mark = String(8 - (m.from >> 3));
    else mark = algOf(m.from);
  }
  return `${kind}${mark}${took ? "x" : ""}${algOf(m.to)}${suffix}`;
};

// Neither side can force mate with what is left. King alone, king and a minor,
// or two kings with all their bishops on one colour.
const dead = (b) => {
  const rest = [];
  const bishops = [];
  for (let sq = 0; sq < 64; sq += 1) {
    const piece = b[sq];
    if (piece === "" || piece === "K" || piece === "k") continue;
    const kind = piece.toUpperCase();
    if (kind === "P" || kind === "R" || kind === "Q") return false;
    if (kind === "B") bishops.push(((sq >> 3) + (sq & 7)) % 2);
    rest.push(kind);
  }
  if (rest.length <= 1) return true;
  return bishops.length === rest.length && bishops.every((c) => c === bishops[0]);
};

// How the house chooses: two plies of material, with a nudge toward the middle
// and toward moving something other than the king early. Deterministic — ties
// break on the move order generation already fixed.
const VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
const evaluate = (p) => {
  let score = 0;
  for (let sq = 0; sq < 64; sq += 1) {
    const piece = p.b[sq];
    if (piece === "") continue;
    const kind = piece.toUpperCase();
    const f = sq & 7;
    const r = sq >> 3;
    const centre = 4 - Math.abs(2 * f - 7) / 2 - Math.abs(2 * r - 7) / 2;
    const worth = VALUE[kind] + (kind === "K" ? 0 : Math.round(centre * 3));
    score += WHITE.includes(piece) ? worth : -worth;
  }
  return p.w ? score : -score;
};

// Captures first, and the fattest first: alpha-beta is only as good as the
// order it sees moves in, and the difference between ordered and unordered here
// is the difference between three plies and four.
const ordered = (p, moves) =>
  moves.slice().sort((a, b) => {
    const worth = (m) => (p.b[m.to] === "" ? 0 : VALUE[p.b[m.to].toUpperCase()]) + (m.promo === "" ? 0 : 800);
    return worth(b) - worth(a);
  });

const search = (p, depth, alpha, beta) => {
  const moves = legal(p);
  if (moves.length === 0) return inCheck(p) ? -30000 - depth : 0;
  if (depth === 0) return evaluate(p);
  let a = alpha;
  for (const m of ordered(p, moves)) {
    const score = -search(make(p, m), depth - 1, -beta, -a);
    if (score >= beta) return beta;
    if (score > a) a = score;
  }
  return a;
};

// The four levels, and their weakening is deterministic rather than random: a
// compartment has no randomness, and an opponent that varies per draw cannot be
// held to an oracle. The first looks one ply ahead and then declines the best
// move by a stated amount; the rest search deeper and take it.
const LEVEL = {
  "2": {plies: 1, take: 1},
  "3": {plies: 2, take: 0},
  "4": {plies: 3, take: 0},
  "5": {plies: 4, take: 0},
};

const houseMove = (p, moves, level) => {
  const how = LEVEL[String(level)] ?? LEVEL["3"];
  const scored = ordered(p, moves).map((m) => ({
    m,
    score: -search(make(p, m), how.plies - 1, -99999, 99999),
  }));
  // Sorted by score, ties broken by the order generation already fixed, so the
  // same position always yields the same move.
  scored.sort((x, y) => y.score - x.score);
  // A level that declines the best move still never throws a piece away for
  // nothing: it declines by rank, and a forced move is still forced.
  return scored[Math.min(how.take, scored.length - 1)].m;
};

const SHADE = (sq) => (((sq >> 3) + (sq & 7)) % 2 === 0 ? "light" : "dark");

const RESULT = {white: "1-0", black: "0-1", draw: "1/2-1/2"};

// The review (ir decision-25). A move is graded by what it cost its own side
// in winning chances, and this is the only place the rule is written.
const READ_NODES = "150000";
const MATE = 10000;
// Winning chances out of a hundred, by the curve Lichess publishes.
const WIN = (cp) => {
  const c = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
};
// A score as UCI states it — `cp 31`, `mate -3`, from the side to move — as
// White's centipawns, a mate read as the edge of the scale and nearer the edge
// the sooner it lands.
const whiteScore = (said, whiteToMove) => {
  const m = /^(cp|mate) (-?\d{1,5})$/.exec(String(said ?? ""));
  if (m === null) return undefined;
  const n = Number(m[2]);
  const mover = m[1] === "cp" ? n : (n > 0 ? MATE - n : -MATE - n);
  return whiteToMove ? mover : -mover;
};
// `gap` is how much worse the second line was for the same side: the only
// move is one that held where the alternative did not.
const markOf = (loss, gap) =>
  (loss >= 20 ? "??" : (loss >= 10 ? "?" : (loss >= 5 ? "?!" : (gap >= 10 ? "!" : ""))));
const ACCURACY = (loss) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
// One side's winning chances, and what a move cost its own side: the marks and
// the accuracy both read this. The house's own preference is never marked
// down — a drop between its reading of a position and the next is its
// horizon, not the move.
const chancesFor = (colour, cp) => (colour === "white" ? WIN(cp) : 100 - WIN(cp));
const lossOf = (m, after) =>
  (m.san === m.best ? 0 : Math.max(0, chancesFor(m.color, Number(m.before ?? "")) - chancesFor(m.color, after)));
// A move as the engine names it: the two squares, and the piece it becomes.
const uciOf = (m) => `${algOf(m.from)}${algOf(m.to)}${m.promo === "" ? "" : m.promo.toLowerCase()}`;
const VERDICT = {"?!": "An inaccuracy.", "?": "A mistake.", "??": "A blunder."};
const TALLY = [
  {mark: "??", one: "blunder", many: "blunders"},
  {mark: "?", one: "mistake", many: "mistakes"},
  {mark: "?!", one: "inaccuracy", many: "inaccuracies"},
  {mark: "!", one: "only move", many: "only moves"},
];
// What a board prints for an evaluation: pawns to one place, or a mate count.
const showEval = (cp) => {
  const n = MATE - Math.abs(cp);
  if (n <= 500) return n === 0 ? "#" : `#${cp > 0 ? "" : "-"}${n}`;
  if (Math.abs(cp) < 5) return "0.0";
  return `${cp > 0 ? "+" : "−"}${(Math.abs(cp) / 100).toFixed(1)}`;
};
// A move's columns before the house has read it. Written onto every row that
// predates them, because a template binding a name its row has not got throws.
const UNREAD = {before: "", second: "", best: "", line: "", after: "", mark: "", tide: ""};

// The time controls, in the notation every board writes them in. `unlimited`
// is the absence of a clock rather than a very large one: a clock that is not
// running must not be drawn as though it were.
const TC = {
  unlimited: {ms: 0, inc: 0},
  "1+0": {ms: 60000, inc: 0},
  "3+2": {ms: 180000, inc: 2000},
  "5+0": {ms: 300000, inc: 0},
  "10+0": {ms: 600000, inc: 0},
};

// What each side starts with, so what is missing from the board is what the
// other side has taken.
const ARMY = {P: 8, N: 2, B: 2, R: 2, Q: 1};
const TAKE_ORDER = ["Q", "R", "B", "N", "P"];

// The house is a cast, not a difficulty slider. Each one plays to a stated
// level and says so, which is the difference between "level 2" and somebody to
// beat.
// `seat` is which mechanism chooses this member's move, and it is the whole
// of the branch: a search-seated member never reaches the unit and an
// engine-seated one never reaches houseMove, so a recorded Move row can only
// name the thing that actually chose it. `nodes` is the engine's budget, in
// the one unit that is repeatable. `elo` is what tests/elo measured, copied
// from tests/elo.json's `shown` (ir decision-30); re-run the bench when a
// member changes.
const BOTS = {
  nell: {name: "Nell", level: "2", seat: "search", elo: "700", line: "Sees one move ahead and likes a trade."},
  otto: {name: "Otto", level: "3", seat: "search", elo: "1050", line: "Steady. Punishes a loose piece."},
  vera: {name: "Vera", level: "4", seat: "search", elo: "1350", line: "Calculates. Will find a two-move tactic."},
  magnus: {name: "Rook", level: "5", seat: "search", elo: "1500", line: "Deep and patient. Do not hang anything."},
  sable: {name: "Sable", level: "5", seat: "engine", nodes: "200000", elo: "2800+", line: "Reads the position properly. Takes her time over it."},
};
// The next game's terms before the reader has chosen any: the row the setup
// card binds, written once, when the referee first wakes without one. A game's
// terms are copied from it when the game starts and never change after (ir
// decision-31), so choosing the next one can never rewrite this one.
const SETUP = {mode: "house", bot: "otto", level: "3", tc: "5+0", side: "white"};
// Members that measured as one strength with another and were merged into it
// (ir decision-30). A game stored against one plays on against the member it
// became, and the recompute rewrites the row to name who is actually playing.
const MERGED = {pip: "nell"};
const memberOf = (bot) => MERGED[bot] ?? bot;

// Can this side still force mate with what it has? A flag against a side that
// cannot is a draw, not a win, and that rule is why the question is asked per
// side rather than about the position.
const cannotMate = (b, white) => {
  const mine = [];
  for (const piece of b) {
    if (piece === "") continue;
    const isWhite = WHITE.includes(piece);
    if (isWhite !== white) continue;
    const kind = piece.toUpperCase();
    if (kind !== "K") mine.push(kind);
  }
  if (mine.length === 0) return true;
  return mine.length === 1 && (mine[0] === "N" || mine[0] === "B");
};

(state, event) => {
  // The drag seat calls with {items} and nothing else, and writes only patches
  // to the region's own table. It cannot decide a chess move — that needs the
  // world — so a drop states where the piece came from and the referee reads
  // it on the wake that follows (ir decision-23).
  if (event.type === "move") {
    const from = String(event.fromId ?? "");
    const to = String(event.toId ?? "");
    if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) return { updates: [] };
    return { updates: [{ op: "patch", id: to, row: { drag_from: from } }] };
  }

  const rows = state.rows ?? {};
  const games = rows.game ?? [];
  const played = rows.move ?? [];
  const squares = rows.square ?? [];
  const legals = rows.legal ?? [];
  const ticks = rows.tick ?? [];
  const openings = rows.opening ?? [];
  const txt = (v) => String(v);
  const num = (v) => (Number(v) || 0);
  // A clock is a duration, and a duration's value is its canonical string:
  // total seconds, no trailing zeros. Arithmetic wants milliseconds, so these
  // two are the only places the two spellings meet.
  const dur = (ms) => `PT${String(Math.max(0, num(ms)) / 1000)}S`;
  const msIn = (d) => Math.round(num(String(d ?? "").slice(2, -1)) * 1000);

  /* --- sitting down ------------------------------------------------------ */

  const current = games.find((g) => g.current === "yes");
  const setup = (rows.setup ?? []).find((s) => s.id === "next");
  // A store with no setup row is given one: by the derived pass below while a
  // game stands, and here when a game is asked for, so every game — the first
  // included — starts from the row the card shows.
  const putSetup = {op: "put", entity: "setup", id: "next", row: SETUP};
  if (event.type === "open" && setup === undefined) return {updates: [putSetup], then: {type: "open", seed: true}};
  if (event.type === "open") {
    const seed = Number(event.seed) >>> 0;
    const before = current ?? games[games.length - 1];
    const {mode, tc, side} = setup;
    const bot = memberOf(setup.bot);
    const control = TC[tc] ?? TC.unlimited;
    return {
      // Asking for another board does not end this one: several games stand
      // at once, and the shelf is where you go back to any of them.
      updates: (current === undefined ? [] : [{op: "patch", entity: "game", id: current.id, row: {current: "no"}}]).concat([{
        op: "put",
        entity: "game",
        id: `g${seed.toString(36)}`,
        row: {
          mode,
          bot,
          bot_name: BOTS[bot].name,
          bot_line: BOTS[bot].line,
          level: BOTS[bot].level,
          set: before?.set ?? "print",
          tc,
          side,
          ...columnsOf(START, NOW),
          ply: "0",
          status: "playing",
          result: "",
          won: "",
          termination: "",
          check: "no",
          selected: "",
          // Drawn from where the guest sits: a board showing the other
          // player's view is one every move has to be read backwards on.
          flipped: side === "black" ? "yes" : "no",
          last_from: "",
          last_to: "",
          current: "yes",
          ordinal: txt(games.length + 1).padStart(4, "0"),
          white_clock: dur(control.ms),
          black_clock: dur(control.ms),
          last_tick: txt(num((ticks.find((t) => t.id === "tick") ?? {}).n)),
          cursor: "start",
          step: "",
          dragged: "no",
          caret: side === "black" ? "e8" : "e1",
          caret_go: "",
          promo_from: "",
          promo_to: "",
          promo_f: "0",
          promo_r: "0",
          draw_offer: "none",
          eco: "",
          opening: "",
          taken_white: "",
          taken_black: "",
          edge: "0",
          reviewing: "no",
          pgn: "",
          ask: "",
          ask_ply: "",
          ask_nodes: "",
          ask_lines: "",
          review: "",
          review_line: "",
          acc_low: "",
          acc_top: "",
          tally_low: "",
          tally_top: "",
          bar: "",
          bar_label: "",
          note_head: "",
          note_mark: "",
          note: "",
          hint: "",
          seat_top_name: BOTS[bot].name,
          seat_top_line: BOTS[bot].line,
          seat_top_ini: BOTS[bot].name.slice(0, 1),
          seat_top_clock: dur(control.ms),
          seat_top_taken: "",
          seat_top_edge: "",
          seat_top_turn: side === "black" ? "yes" : "no",
          seat_top_low: "no",
          seat_low_name: "You",
          seat_low_line: `${side === "white" ? "White" : "Black"} · ${tc}`,
          seat_low_ini: "Y",
          seat_low_clock: dur(control.ms),
          seat_low_taken: "",
          seat_low_edge: "",
          seat_low_turn: side === "white" ? "yes" : "no",
          seat_low_low: "no",
          seat_top_elo: BOTS[bot].elo ?? "",
          seat_low_elo: "",
        },
      }]),
    };
  }
  if (current === undefined) return {updates: [], then: {type: "open", seed: true}};
  const game = current;

  const pos = positionOf(game, NOW);
  const turn = pos.w ? "white" : "black";
  const moves = legal(pos);
  const checked = inCheck(pos);
  const log = played
    .filter((m) => m.game_id === game.id && m.retracted !== "yes")
    .sort((a, b) => num(a.ply) - num(b.ply));
  const playing = game.status === "playing";
  const patch = {};

  /* --- the clock --------------------------------------------------------- */

  // The board's clock is a row somebody else keeps: a machine ticks a counter
  // and this reads how far it has moved since it last looked. A reduce has no
  // clock of its own, so time arrives the way randomness does — as an input.
  const tick = num((ticks.find((t) => t.id === "tick") ?? {}).n);
  const control = TC[game.tc] ?? TC.unlimited;
  // A clock only runs once both sides have moved, the way it does everywhere.
  const running = control.ms > 0 && playing && num(game.ply) >= 2;
  let whiteMs = msIn(game.white_clock);
  let blackMs = msIn(game.black_clock);
  let flagged = "";
  if (tick !== num(game.last_tick)) {
    if (running) {
      const spent = Math.max(0, tick - num(game.last_tick)) * 1000;
      if (turn === "white") whiteMs = Math.max(0, whiteMs - spent);
      else blackMs = Math.max(0, blackMs - spent);
      if (whiteMs === 0) flagged = "white";
      if (blackMs === 0) flagged = "black";
      patch.white_clock = dur(whiteMs);
      patch.black_clock = dur(blackMs);
    }
    patch.last_tick = txt(tick);
  }

  /* --- how the game ends ------------------------------------------------- */

  // What a repetition is over: the board, the side to move, the rights, and the
  // square a pawn may be taken on in passing. Not the two counters — a position
  // stands again whatever the clock has reached.
  const key = (p) => `${boardOf(p)} ${p.w ? "w" : "b"} ${p.castle} ${p.ep}`;
  const seen = {};
  for (const stood of [START].concat(log.map((m) => positionOf(m, AFTER)))) {
    const k = key(stood);
    seen[k] = (seen[k] ?? 0) + 1;
  }
  const repeated = Object.keys(seen).some((k) => seen[k] >= 3);

  let over = "";
  let winner = "";
  if (flagged !== "") {
    over = "flag";
    // A flag against a side that could never have mated is a draw: the clock
    // decides a game somebody could still have won, and nothing else.
    winner = cannotMate(pos.b, flagged !== "white") ? "" : (flagged === "white" ? "black" : "white");
  } else if (moves.length === 0) {
    over = checked ? "checkmate" : "stalemate";
    if (checked) winner = pos.w ? "black" : "white";
  } else if (dead(pos.b)) over = "insufficient";
  else if (pos.half >= 100) over = "fifty-move";
  else if (repeated) over = "threefold";

  /* --- what the reader is looking at ------------------------------------- */

  // The cursor names a move; "start" is the position before any of them. While
  // it is not on the newest move the board is a record and nothing may be
  // played on it.
  const newest = log.length === 0 ? "start" : log[log.length - 1].id;
  let cursor = game.cursor === "" ? newest : game.cursor;
  const step = game.step ?? "";
  if (step !== "") {
    const at = log.findIndex((m) => m.id === cursor);
    if (step === "first") cursor = "start";
    else if (step === "live") cursor = newest;
    else if (step === "back") cursor = at <= 0 ? "start" : log[at - 1].id;
    else if (step === "fwd") cursor = cursor === "start" ? (log[0]?.id ?? "start") : (log[at + 1]?.id ?? cursor);
    patch.step = "";
    // Stepping through the sheet repositions without playing, so the last
    // move's gesture stops describing what the figures are about to do.
    patch.dragged = "no";
  }
  const viewedMove = log.find((m) => m.id === cursor);
  if (cursor !== "start" && viewedMove === undefined) cursor = newest;
  if (cursor !== (game.cursor ?? "")) patch.cursor = cursor;
  const live = cursor === newest;
  const view = live ? pos : (cursor === "start" ? START : positionOf(viewedMove, AFTER));

  /* --- where the keyboard is on the board --------------------------------- */

  // The caret walks the board as it is DRAWN. `ord` is the reading order the
  // squares are laid out in, so "left" is one less of it whichever way round
  // the board sits, and nothing below this pair has to know about the flip.
  // It starts on the near king's square, which is where a hand would be.
  const turned = game.flipped === "yes";
  const ordOf = (a) => (turned ? 63 - sqOf(a) : sqOf(a));
  const atOrd = (o) => algOf(turned ? 63 - o : o);
  let caret = String(game.caret ?? "").length === 2 ? String(game.caret) : (turned ? "e8" : "e1");
  const go = game.caret_go ?? "";
  if (go !== "") {
    const o = ordOf(caret);
    const file = o & 7;
    if (go === "left" && file > 0) caret = atOrd(o - 1);
    else if (go === "right" && file < 7) caret = atOrd(o + 1);
    else if (go === "up" && o >= 8) caret = atOrd(o - 8);
    else if (go === "down" && o < 56) caret = atOrd(o + 8);
    else if (go === "row-start") caret = atOrd(o - file);
    else if (go === "row-end") caret = atOrd(o | 7);
    else if (go === "first") caret = atOrd(0);
    else if (go === "last") caret = atOrd(63);
    patch.caret_go = "";
  }
  if (caret !== (game.caret ?? "")) patch.caret = caret;

  /* --- naming the moves that may be played -------------------------------- */

  // Only a game being played has moves to name.
  const rivals = rivalsIn(pos, moves);
  const named = !playing ? [] : moves.map((m) => {
    const after = make(pos, m);
    return {
      m,
      from: algOf(m.from),
      to: algOf(m.to),
      uci: uciOf(m),
      san: sanOf(pos, m, rivals, after),
      pos: after,
      took: pos.b[m.to] !== "" || m.epTake === true,
    };
  });

  const finish = (extra) => {
    const done = Object.assign({}, patch, extra, {selected: "", promo_from: "", promo_to: "", draw_offer: "none"});
    return {updates: [{op: "patch", entity: "game", id: game.id, row: done}]};
  };

  const play = (pick, byHand) => {
    const after = pick.pos;
    const ply = num(game.ply) + 1;
    // The increment lands on the clock of the side that just moved, after the
    // move: that is what an increment is, and adding it before would give a
    // side time it had not yet earned.
    const mine = turn === "white" ? whiteMs : blackMs;
    const left = control.ms > 0 && ply >= 2 ? mine + control.inc : mine;
    const id = `${game.id}/${txt(ply).padStart(3, "0")}`;
    const white = turn === "white" ? left : whiteMs;
    const black = turn === "black" ? left : blackMs;
    return {
      updates: [
        {
          op: "put",
          entity: "move",
          id,
          row: {
            game_id: game.id,
            ply,
            number: pos.full,
            color: turn,
            san: pick.san,
            uci: pick.uci,
            ...columnsOf(after, AFTER),
            capture: pick.took ? "yes" : "no",
            check: pick.san.endsWith("+") || pick.san.endsWith("#") ? "yes" : "no",
            retracted: "no",
            white_clock: dur(white),
            black_clock: dur(black),
            ...UNREAD,
          },
        },
        {
          op: "patch",
          entity: "game",
          id: game.id,
          row: Object.assign({}, patch, columnsOf(after, NOW), {
            ply: txt(ply),
            selected: "",
            promo_from: "",
            promo_to: "",
            // A move answers a draw offer by declining it.
            draw_offer: "none",
            last_from: pick.from,
            last_to: pick.to,
            // A piece the hand carried is already where it is going: the
            // figure must not then slide there from the square it left. Every
            // other move travels, which is what a move looks like.
            dragged: byHand === true ? "yes" : "no",
            check: inCheck(after) ? "yes" : "no",
            cursor: id,
            white_clock: dur(white),
            black_clock: dur(black),
          }),
        },
      ],
    };
  };

  const mine = game.mode === "hotseat" || turn === game.side;
  const canPlay = playing && over === "" && live && mine;

  // Which way round the board is drawn, and a square's place on it. Defined
  // above the gestures because the promotion picker is positioned by one that
  // returns before the derived section below is reached.
  const flipped = game.flipped === "yes";
  const place = (sq) => {
    const ord = flipped ? 63 - sq : sq;
    return {file: ord & 7, rank: ord >> 3};
  };
  const castKey = memberOf(game.bot);
  const cast = BOTS[castKey];

  /* --- the review: reading a finished game -------------------------------- */

  // Which position the reading has reached: the first whose preference no move
  // holds yet, and after them the one the game ended on. The rows are the
  // progress, so a reading left halfway resumes here (ir decision-26).
  const reading = !playing && (game.review ?? "") === "reading";
  const readingAt = () => {
    for (let i = 0; i < log.length; i += 1) {
      if ((log[i].best ?? "") === "") return {p: i, pos: i === 0 ? START : positionOf(log[i - 1], AFTER)};
    }
    const last = log[log.length - 1];
    if (last !== undefined && (last.after ?? "") === "") return {p: log.length, pos: positionOf(last, AFTER)};
    return undefined;
  };
  const next = reading ? readingAt() : undefined;
  // A position with no move in it is scored here and never asked: the engine
  // has nothing to prefer, and the rules already know how it ended. So is the
  // one a game was drawn on by rule — a FEN carries no history, so the engine
  // cannot see the repetition that ended it.
  // Only the last position can have no move in it, and it is the game's own,
  // so `moves` answers for it.
  const ruled = next !== undefined && next.p === log.length &&
    (moves.length === 0 || ["threefold", "fifty-move", "insufficient"].includes(game.termination ?? ""));
  const askable = next !== undefined && !ruled ? next : undefined;
  // The seat is a unit that speaks the wire format, so the question crosses to
  // it as one. Assembled once: it is the question, the epoch an answer is
  // matched against, and the column the mount binds.
  const askFen = askable === undefined ? "" : toFen(askable.pos);
  // `18. b3`, `18… Nb6`: the number a sheet prints, then the name.
  const numbered = (at, san, first) => (at.w ? `${at.full}. ${san}` : (first ? `${at.full}… ${san}` : san));
  // The engine's move looked up in what the position allows and named the
  // referee's way, or nothing: trusted for a preference, never a possibility.
  const lookUp = (at, uci) => {
    const all = legal(at);
    const m = all.find((x) => uciOf(x) === uci);
    if (m === undefined) return undefined;
    const after = make(at, m);
    return {m, san: sanOf(at, m, rivalsIn(at, all), after), after};
  };
  // How many plies of this game are a line of the opening book. Only a game
  // that is over is graded, so only one that is over is measured.
  let bookPlies = 0;
  if (!playing) {
    for (const o of openings) {
      const words = String(o.uci).split(" ");
      let k = 0;
      while (k < words.length && k < log.length && log[k].uci === words[k]) k += 1;
      if (k > bookPlies) bookPlies = k;
    }
  }
  // White's chances in twentieths: the strip's step and the bar's fill.
  const tideOf = (cp) => txt(Math.round(WIN(cp) / 5));
  // A move's reading once the position it reached is scored (ir decision-25).
  const graded = (m, after) => {
    const tide = tideOf(after);
    if (num(m.ply) <= bookPlies) return {after: txt(after), tide, mark: "book"};
    // The only move is the house's own preference, where its second line would
    // have lost: another move that held means two moves held.
    const gap = m.san !== m.best || (m.second ?? "") === "" ? 0
      : chancesFor(m.color, Number(m.before ?? "")) - chancesFor(m.color, Number(m.second));
    return {after: txt(after), tide, mark: markOf(lossOf(m, after), gap)};
  };
  const read = (said) => {
    if (askable === undefined || said.game !== game.id || said.fen !== askFen) return {updates: []};
    const at = askable.pos;
    const best = lookUp(at, String(said.uci ?? ""));
    const score = whiteScore(said.score, at.w);
    // An answer the board cannot use is asked again: the seat never puts the
    // same question twice, and one more node makes it a new one.
    if (best === undefined || score === undefined) {
      return {updates: [{op: "patch", entity: "game", id: game.id, row: {ask_nodes: txt(num(game.ask_nodes) + 1)}}]};
    }
    const second = whiteScore(said.second, at.w);
    // The line after the preference, named move by move and cut at the first
    // move the position has not got.
    let line = "";
    let walk = best.after;
    // Only a line that starts with the preference continues it: the last exact
    // line the seat saw can be from a shallower depth than its bestmove.
    const pv = String(said.pv ?? "").split(" ");
    const words = pv[0] === String(said.uci ?? "") ? pv.slice(1, 4) : [];
    for (let i = 0; i < words.length; i += 1) {
      const step = lookUp(walk, words[i]);
      if (step === undefined) break;
      const more = `${line} ${numbered(walk, step.san, i === 0)}`.trim();
      if (more.length > 48) break;
      line = more;
      walk = step.after;
    }
    const updates = [];
    const reached = log[askable.p - 1];
    if (reached !== undefined) updates.push({op: "patch", entity: "move", id: reached.id, row: graded(reached, score)});
    const from = log[askable.p];
    if (from !== undefined) {
      updates.push({op: "patch", entity: "move", id: from.id, row: {
        before: txt(score), second: second === undefined ? "" : txt(second), best: best.san, line,
      }});
    }
    return {updates};
  };
  if (event.type === "answer" && reading) return read(event.detail ?? {});

  /* --- the engine's answer ------------------------------------------------ */

  // It arrives out of band, at whatever moment the search finished, so every
  // gate the house's in-chain reply inherits from its own wake is re-asserted
  // here. And it is answered BEFORE the derived recompute below, which returns
  // as soon as one derived row differs — an answer landing on such a wake
  // would be dropped with it and never come again.
  if (event.type === "answer") {
    const said = event.detail ?? {};
    if (!playing || over !== "" || !live || mine) return {updates: []};
    // The seat, and not only the turn: an answer is played only for a member
    // the unit seats, so no Move row can name one the search chose for. The
    // mirror of the guard the house branch keeps.
    if (cast.seat !== "engine") return {updates: []};
    // The epoch is the position and the board, never the ply: a takeback
    // rewinds ply to a different fen, and several games stand at once.
    if (said.game !== game.id || said.fen !== toFen(pos)) return {updates: []};
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(String(said.uci ?? ""))) return {updates: []};
    // Looked up in what this side may play, never interpreted — so the engine
    // is trusted for a preference and never for a possibility. `named` and not
    // the Legal rows: those are written only when the guest may move, so they
    // are empty exactly on the engine's turn.
    const pick = named.find((n) => n.uci === said.uci);
    return pick === undefined ? {updates: []} : play(pick);
  }

  // The question the board is putting, as columns the mount binds. Derived
  // into the same patch as the caret and the seats: a write of its own would
  // un-settle the wake and re-enter the reply below on the next one.
  // A finished game under review asks too, a position at a time and for two
  // lines; the two questions can never stand at once, because one needs the
  // game on and the other needs it over.
  // A budget read() raised stands until its position is answered.
  const retried = askable !== undefined && game.ask === askFen && game.ask_ply === txt(askable.p) &&
    num(game.ask_nodes) > num(READ_NODES);
  const asks = playing && over === "" && live && !mine && cast.seat === "engine";
  const wants = asks
    ? {ask: toFen(pos), ask_ply: txt(game.ply), ask_nodes: cast.nodes, ask_lines: "1"}
    : (askable === undefined
      ? {ask: "", ask_ply: "", ask_nodes: "", ask_lines: ""}
      : {ask: askFen, ask_ply: txt(askable.p), ask_nodes: retried ? game.ask_nodes : READ_NODES, ask_lines: "2"});
  // Writes each derived column that differs from the row. A column the row
  // lacks differs from any value, so one added after a game was stored is
  // written onto it too; a template binding a name the row has not got is a
  // mount that throws.
  const derive = (want) => {
    for (const k of Object.keys(want)) {
      if (game[k] === undefined ? want[k] !== undefined : txt(game[k]) !== txt(want[k])) {
        patch[k] = want[k];
      }
    }
  };
  derive(wants);
  // The position itself is derived the same way, which is what settles a row
  // that names it in the wire format alone into the columns it is read from.
  derive(columnsOf(pos, NOW));

  // Who won, in the words the reader is in. "1-0" is the record's answer and
  // the sheet keeps it, but the brief asks the board to NAME the winner, and
  // a guest who has never read a score sheet cannot get it from the figures.
  const wonBy = (result) => {
    if (result === RESULT.draw) return "Drawn";
    const side = result === RESULT.white ? "white" : (result === RESULT.black ? "black" : "");
    if (side === "") return "";
    if (game.mode === "hotseat") return side === "white" ? "White won" : "Black won";
    return side === game.side ? "You won" : `${cast.name} won`;
  };

  /* --- what a gesture means ---------------------------------------------- */

  // A move on the sheet, or a column of the strip: the board goes to the
  // position after it. Asked ahead of the playing gate, because stepping
  // through a finished game is most of what a review is.
  if (event.type === "click" && typeof event.id === "string" && event.id.startsWith(`${game.id}/`)) {
    return {updates: [{op: "patch", entity: "game", id: game.id, row: Object.assign({}, patch, {cursor: event.id, selected: ""})}]};
  }
  // Asked for once the game is over and never while it is on: the board does
  // not think for you while you are playing (ir decision-24).
  if (event.type === "click" && event.from === "btn-review") {
    if (playing || (game.review ?? "") !== "" || log.length === 0) return {updates: []};
    return {updates: [{op: "patch", entity: "game", id: game.id, row: Object.assign({}, patch, {review: "reading"})}]};
  }
  // Start, on the setup card New game opens: the next game, on the terms the
  // card shows. From any state, because the terms are not this game's.
  if (event.type === "click" && event.from === "btn-start") {
    return {updates: [], then: {type: "open", seed: true}};
  }
  if (event.type === "click" && playing && over === "") {
    if (event.from === "btn-resign") {
      const result = game.mode === "hotseat"
        ? (turn === "white" ? RESULT.black : RESULT.white)
        : (game.side === "white" ? RESULT.black : RESULT.white);
      return finish({status: "over", result, won: wonBy(result), termination: "resignation"});
    }
    if (event.from === "btn-draw") {
      // Offering is a write; the answer is the house's, on its next wake.
      return {updates: [{op: "patch", entity: "game", id: game.id, row: Object.assign({}, patch, {draw_offer: "you"})}]};
    }
    if (event.from === "btn-takeback") {
      // A move taken back is marked, not removed: a reduce writes and patches,
      // and a sheet that could be silently rewritten is not a record.
      const back = game.mode === "hotseat" ? 0 : Math.min(2, log.length);
      if (back === 0) return {updates: []};
      const dropped = log.slice(log.length - back);
      const kept = log.slice(0, log.length - back);
      const last = kept[kept.length - 1];
      const at = last === undefined ? START : positionOf(last, AFTER);
      return {
        updates: dropped.map((m) => ({op: "patch", entity: "move", id: m.id, row: {retracted: "yes"}})).concat([{
          op: "patch",
          entity: "game",
          id: game.id,
          row: Object.assign({}, patch, columnsOf(at, NOW), {
            ply: txt(kept.length),
            selected: "",
            dragged: "no",
            promo_from: "",
            promo_to: "",
            last_from: "",
            last_to: "",
            check: inCheck(at) ? "yes" : "no",
            cursor: last === undefined ? "start" : last.id,
            white_clock: last === undefined ? dur(control.ms) : last.white_clock,
            black_clock: last === undefined ? dur(control.ms) : last.black_clock,
          }),
        }]),
      };
    }
    // The promotion picker. The pawn is already on its square in the app's
    // reading of the gesture; what is being chosen is which move of the four
    // gets played.
    if (typeof event.from === "string" && event.from.startsWith("promo-") && game.promo_to !== "") {
      const want = event.from.slice("promo-".length);
      const pick = named.find((n) => n.from === game.promo_from && n.to === game.promo_to && n.m.promo === want);
      if (pick !== undefined) return play(pick);
      return finish({});
    }
  }

  // Tapping squares, and dragging between them: one gesture, one answer.
  const tapped = (from, to, byHand) => {
    // A tap that decides nothing still moved the reader's hand, and the caret
    // is in `patch`. Dropping it here would leave the keyboard behind in
    // exactly the states a reader clicks around in — reviewing an old
    // position, or waiting on the engine.
    if (!canPlay) {
      return Object.keys(patch).length === 0
        ? {updates: []}
        : {updates: [{op: "patch", entity: "game", id: game.id, row: patch}]};
    }
    if (from !== "" && from !== to) {
      const options = named.filter((n) => n.from === from && n.to === to);
      if (options.length > 0) {
        // A promotion is four moves wearing one gesture, so the board asks.
        if (options.length > 1 || options[0].m.promo !== "") {
          const on = place(sqOf(to));
          return {updates: [{op: "patch", entity: "game", id: game.id, row: Object.assign({}, patch, {
            promo_from: from,
            promo_to: to,
            promo_f: txt(on.file),
            promo_r: txt(on.rank),
            selected: "",
          })}]};
        }
        return play(options[0], byHand);
      }
    }
    const standing = pos.b[sqOf(to)] ?? "";
    const ours = standing !== "" && mineOf(pos.w)(standing);
    return {updates: [{op: "patch", entity: "game", id: game.id, row: Object.assign({}, patch, {selected: ours ? to : "", promo_from: "", promo_to: ""})}]};
  };

  if (event.type === "click" && /^[a-h][1-8]$/.test(String(event.id ?? ""))) {
    // The hand and the keyboard share one caret: tabbing back to the board
    // has to land where the reader last was, however they got there.
    patch.caret = String(event.id);
    return tapped(game.selected ?? "", String(event.id));
  }
  // A drop landed since the last wake. Clearing the intent is part of the same
  // change set, so a drag can never be played twice.
  const dropped = squares.find((r) => (r.drag_from ?? "") !== "");
  if (dropped !== undefined) {
    const answer = tapped(String(dropped.drag_from), String(dropped.id), true);
    return {updates: [{op: "patch", entity: "square", id: dropped.id, row: {drag_from: ""}}].concat(answer.updates ?? [])};
  }

  /* --- the derived board -------------------------------------------------- */

  // Drawn from the position being LOOKED AT, which is the live one unless the
  // reader has stepped back through the sheet.
  const picked = live ? (game.selected ?? "") : "";
  const targets = {};
  if (canPlay) for (const n of named) if (n.from === picked) targets[n.to] = n.took ? "capture" : "quiet";
  const litFrom = live ? game.last_from : (viewedMove === undefined ? "" : viewedMove.uci.slice(0, 2));
  const litTo = live ? game.last_to : (viewedMove === undefined ? "" : viewedMove.uci.slice(2, 4));
  const viewChecked = inCheck(view);

  const wantSquares = [];
  for (let sq = 0; sq < 64; sq += 1) {
    const a = algOf(sq);
    const piece = view.b[sq];
    const king = piece === (view.w ? "K" : "k");
    const ord = flipped ? 63 - sq : sq;
    wantSquares.push({
      id: a,
      ord: txt(ord).padStart(2, "0"),
      label: piece === ""
        ? `${a}, empty`
        : `${a}, ${WHITE.includes(piece) ? "white" : "black"} ${KIND[piece.toLowerCase()]}`,
      coord_file: ord >= 56 ? FILES[sq & 7] : "",
      coord_rank: ord % 8 === 0 ? txt(8 - (sq >> 3)) : "",
      shade: SHADE(sq),
      piece,
      glyph: piece === "" ? "" : GLYPH[piece],
      color: piece === "" ? "" : (WHITE.includes(piece) ? "white" : "black"),
      selected: a === picked ? "yes" : "no",
      target: targets[a] === undefined ? "no" : "yes",
      capture: targets[a] === "capture" ? "yes" : "no",
      drag_from: "",
      last: a === litFrom || a === litTo ? "yes" : "no",
      check: king && viewChecked ? "yes" : "no",
      // Only a piece the reader may actually move is worth picking up, and
      // `canPlay` is already the live position, so this is the one being drawn.
      drag: canPlay && piece !== "" && mineOf(pos.w)(piece) ? "yes" : "no",
    });
  }

  /* --- the pieces, kept ---------------------------------------------------- */

  // The board is drawn twice over and on purpose: `square` is the grid — the
  // shading, the coordinates, the dots and the drag targets — and `piece` is a
  // layer of absolutely-placed nodes above it. The split is what buys the
  // movement: a cell cannot travel, but a piece whose ROW survives a move keeps
  // its node, and a node that keeps its place in the tree can have its
  // transform transitioned. Which is how every board people like moves.
  //
  // Identity is recovered rather than tracked: each piece the position wants is
  // matched to the nearest existing piece of the same kind and colour. One move
  // therefore moves one node, a capture leaves one node unmatched, and stepping
  // back through the sheet reassigns the whole set without the referee having
  // to know it was a step rather than a move.
  const everyPiece = rows.piece ?? [];
  const standing = everyPiece.filter((r) => r.taken !== "yes");
  const off = everyPiece.filter((r) => r.taken === "yes");
  const claimed = {};
  const wantPieces = [];
  let minted = 0;
  for (const r of everyPiece) minted = Math.max(minted, num(String(r.id).slice(2)));
  // Where the choice stands: on the square the pawn is waiting on, in the same
  // coordinates the pieces are placed by, so one convention puts both.
  const asking = String(game.promo_to ?? "");
  const at = asking === "" ? {file: 0, rank: 0} : place(sqOf(asking));
  if (txt(at.file) !== (game.promo_f ?? "")) patch.promo_f = txt(at.file);
  if (txt(at.rank) !== (game.promo_r ?? "")) patch.promo_r = txt(at.rank);
  const targetsAt = [];
  for (let sq = 0; sq < 64; sq += 1) if (view.b[sq] !== "") targetsAt.push({sq, piece: view.b[sq]});
  // Two passes, and the order is the point (ir decision-29). First, a piece
  // already standing on a square the position wants it on IS that piece,
  // whatever the board has been turned to since. Only then are the squares
  // left over matched to the pieces left over, nearest first — so a piece that
  // did not move is never handed the square another one arrived on. A square
  // no standing piece can fill takes back a piece a capture left off the board
  // before a new one is minted, so stepping back and forth through a game
  // revives the same pieces instead of growing the set.
  const nearest = (pool, t, spot) => {
    let best;
    let bestDist = 1e9;
    for (const r of pool) {
      if (claimed[r.id] === true || r.piece !== t.piece) continue;
      const d = Math.abs(num(r.file) - spot.file) + Math.abs(num(r.rank) - spot.rank);
      if (d < bestDist) { bestDist = d; best = r; }
    }
    return best;
  };
  const onSquare = {};
  for (const r of standing) onSquare[r.square] = r;
  const holder = targetsAt.map((t) => {
    const r = onSquare[algOf(t.sq)];
    if (r === undefined || r.piece !== t.piece) return undefined;
    claimed[r.id] = true;
    return r;
  });
  targetsAt.forEach((t, i) => {
    const spot = place(t.sq);
    let best = holder[i] ?? nearest(standing, t, spot) ?? nearest(off, t, spot);
    if (best === undefined) {
      minted += 1;
      best = {id: `pc${txt(minted).padStart(2, "0")}`};
    }
    claimed[best.id] = true;
    const a = algOf(t.sq);
    wantPieces.push({
      id: best.id,
      piece: t.piece,
      color: WHITE.includes(t.piece) ? "white" : "black",
      symbol: `fig-${t.piece.toUpperCase()}`,
      initial: t.piece.toUpperCase(),
      glyph: GLYPH[t.piece],
      square: a,
      file: txt(spot.file),
      rank: txt(spot.rank),
      taken: "no",
      lit: a === litFrom || a === litTo ? "yes" : "no",
    });
  });
  // A piece nothing claimed has left the board. It is marked rather than
  // removed, because a reduce writes and patches, and because a node that stays
  // in the tree can be faded out instead of vanishing.
  for (const r of standing) {
    if (claimed[r.id] !== true) wantPieces.push(Object.assign({}, r, {taken: "yes", lit: "no"}));
  }

  const wantLegal = canPlay
    ? named.map((n) => ({
      id: `${game.id}/${n.uci}`,
      game_id: game.id,
      ply: txt(game.ply),
      from_sq: n.from,
      to_sq: n.to,
      uci: n.uci,
      san: n.san,
      promo: n.m.promo,
      ...columnsOf(n.pos, AFTER),
      capture: n.took ? "yes" : "no",
      check: n.san.endsWith("+") ? "yes" : "no",
      mate: n.san.endsWith("#") ? "yes" : "no",
    }))
    : [];

  /* --- what the game says about itself ------------------------------------ */

  // The opening, by the longest of its first moves that a named line matches.
  const line = log.map((m) => m.uci).join(" ");
  let book = {id: "", name: ""};
  for (const o of openings) {
    if ((line === o.uci || line.startsWith(`${o.uci} `)) && o.uci.length > book.name.length * 0 + (book.id === "" ? -1 : 0)) {
      if (book.id === "" || o.uci.length > (openings.find((x) => x.id === book.id)?.uci.length ?? 0)) book = {id: o.id, name: o.name};
    }
  }
  if (game.bot !== castKey) patch.bot = castKey;
  if (game.level !== cast.level) patch.level = cast.level;
  if ((game.bot_name ?? "") !== cast.name) patch.bot_name = cast.name;
  if ((game.bot_line ?? "") !== cast.line) patch.bot_line = cast.line;

  if ((game.eco ?? "") !== book.id) patch.eco = book.id;
  if ((game.opening ?? "") !== book.name) patch.opening = book.name;

  // What each side has taken: what is missing from the other's army.
  const held = {};
  for (const piece of pos.b) if (piece !== "") held[piece] = (held[piece] ?? 0) + 1;
  const takenBy = (white) => {
    let out = "";
    for (const kind of TAKE_ORDER) {
      const theirs = white ? kind.toLowerCase() : kind;
      const gone = ARMY[kind] - (held[theirs] ?? 0);
      for (let i = 0; i < gone; i += 1) out += GLYPH[theirs];
    }
    return out;
  };
  const material = (white) => {
    let total = 0;
    for (const kind of TAKE_ORDER) total += (held[white ? kind : kind.toLowerCase()] ?? 0) * VALUE[kind];
    return total;
  };
  const edge = Math.round((material(true) - material(false)) / 100);
  const takenWhite = takenBy(true);
  const takenBlack = takenBy(false);
  // The game as every other board reads it. Assembled here because a template
  // binds fields and cannot join rows; capped because a column is not a file.
  let pgn = "";
  for (const m of log) {
    if (m.color === "white") pgn += `${pgn === "" ? "" : " "}${m.number}. ${m.san}`;
    else pgn += ` ${m.san}`;
  }
  if (game.result !== "" && game.result !== undefined) pgn += `${pgn === "" ? "" : " "}${game.result}`;
  if ((game.pgn ?? "") !== pgn.slice(0, 2000)) patch.pgn = pgn.slice(0, 2000);

  if ((game.taken_white ?? "") !== takenWhite) patch.taken_white = takenWhite;
  if ((game.taken_black ?? "") !== takenBlack) patch.taken_black = takenBlack;
  if (txt(game.edge ?? "") !== txt(edge)) patch.edge = txt(edge);
  const reviewing = live ? "no" : "yes";
  if ((game.reviewing ?? "") !== reviewing) patch.reviewing = reviewing;

  /* --- the review, as the board shows it ---------------------------------- */

  const moveUpdates = [];
  for (const m of played) {
    if (m.mark === undefined) moveUpdates.push({op: "patch", entity: "move", id: m.id, row: UNREAD});
  }
  // The position the game ended on, when the rules rather than the engine
  // score it: a mate is the edge of the scale, and every other such ending a
  // draw.
  if (ruled) {
    const score = moves.length === 0 && checked ? (pos.w ? -MATE : MATE) : 0;
    moveUpdates.push({op: "patch", entity: "move", id: log[log.length - 1].id, row: graded(log[log.length - 1], score)});
  }
  const reviewed = !playing && (game.review ?? "") !== "";
  const readDone = reviewed && next === undefined;
  // Each seat's accuracy and tally, once every position is read.
  const sideOf = (colour) => {
    if (!readDone) return {acc: "", tally: ""};
    const marked = log.filter((m) => m.color === colour && (m.mark ?? "") !== "book" &&
      (m.after ?? "") !== "" && (m.before ?? "") !== "");
    if (marked.length === 0) return {acc: "", tally: ""};
    const scores = marked.map((m) => ACCURACY(lossOf(m, Number(m.after))));
    const plain = scores.reduce((s, x) => s + x, 0) / scores.length;
    const harmonic = scores.length / scores.reduce((s, x) => s + 1 / Math.max(1, x), 0);
    const words = [];
    for (const t of TALLY) {
      const n = log.filter((m) => m.color === colour && m.mark === t.mark).length;
      if (n > 0) words.push(`${n} ${n === 1 ? t.one : t.many}`);
    }
    return {acc: txt(Math.round((plain + harmonic) / 2)), tally: words.length === 0 ? "no mistakes" : words.join(" · ")};
  };
  const lowSide = sideOf(game.side);
  const topSide = sideOf(game.side === "white" ? "black" : "white");
  // The chances at the position looked at: after the move the cursor is on,
  // or before the first one.
  const shownEval = viewedMove === undefined ? (log[0]?.before ?? "") : (viewedMove.after ?? "");
  const shownCp = reviewed && shownEval !== "" ? Number(shownEval) : undefined;
  // And what the house makes of the move being looked at, once the whole game
  // is read, as the accuracy waits.
  let noteHead = "";
  let noteMark = "";
  let noteText = "";
  let hint = "";
  if (readDone && viewedMove !== undefined && (viewedMove.after ?? "") !== "") {
    const m = viewedMove;
    const i = log.indexOf(m);
    const from = i === 0 ? START : positionOf(log[i - 1], AFTER);
    const mark = m.mark ?? "";
    const chances = (cp) => Math.round(chancesFor(m.color, cp));
    const better = `${numbered(from, m.best, true)}${(m.line ?? "") === "" ? "" : `, then ${m.line}`}`;
    noteHead = `${numbered(from, m.san, true)}${mark === "book" ? "" : mark}`;
    noteMark = mark;
    if (mark === "book") noteText = "In the opening book.";
    else if (mark === "!") noteText = "The only move: anything else gave up ten points or more.";
    else if (VERDICT[mark] !== undefined) {
      noteText = `${VERDICT[mark]} ${m.color === "white" ? "White" : "Black"}'s chances went from ` +
        `${chances(Number(m.before))} to ${chances(Number(m.after))} in a hundred. Better was ${better}.`;
      const all = legal(from);
      const among = rivalsIn(from, all);
      // Only a move landing on the square the preference names can be it.
      const dest = /([a-h][1-8])(?:=[QRBN])?[+#]?$/.exec(m.best ?? "");
      const near = dest === null ? all : all.filter((x) => algOf(x.to) === dest[1]);
      const pick = near.find((x) => sanOf(from, x, among, make(from, x)) === m.best);
      if (pick !== undefined) {
        const a = place(pick.from);
        const b = place(pick.to);
        // One path, not four coordinates: an empty path draws nothing and is
        // valid, where an empty coordinate is an error the browser reports.
        const at = (v) => (v + 0.5).toFixed(1);
        hint = `M${at(a.file)} ${at(a.rank)} L${at(b.file)} ${at(b.rank)}`;
      }
    } else noteText = m.best === m.san ? "The house's own choice." : `Sound. The house preferred ${better}.`;
  }
  const shows = {
    review: readDone ? "read" : (game.review ?? ""),
    review_line: askable === undefined ? "" : `Reading the game · move ${Math.min(Math.floor(askable.p / 2) + 1, Math.ceil(log.length / 2))} of ${Math.ceil(log.length / 2)}`,
    acc_low: lowSide.acc,
    acc_top: topSide.acc,
    tally_low: lowSide.tally,
    tally_top: topSide.tally,
    bar: shownCp === undefined ? "" : tideOf(shownCp),
    bar_label: shownCp === undefined ? "" : showEval(shownCp),
    note_head: noteHead,
    note_mark: noteMark,
    note: noteText.slice(0, 280),
    hint,
  };
  derive(shows);

  // The two seats, as the board shows them: the opponent above, the guest
  // below, whichever colours they hold. Twelve columns rather than a template
  // that chooses — a template binds fields and cannot decide which clock is
  // whose, and rendering both orders and hiding one is two copies of a seat
  // that would then differ.
  const guest = game.side;
  const foe = guest === "white" ? "black" : "white";
  const hot = game.mode === "hotseat";
  const msOf = (c) => dur(c === "white" ? whiteMs : blackMs);
  const tookOf = (c) => (c === "white" ? takenWhite : takenBlack);
  // Only the side that is ahead carries the number: two signed figures facing
  // each other across a board is the same fact printed twice.
  const edgeOf = (c) => {
    const mine = c === "white" ? edge : -edge;
    return mine > 0 ? `+${mine}` : "";
  };
  const colourName = (c) => (c === "white" ? "White" : "Black");
  // The point at which a clock stops being information and becomes the game.
  const lowOf = (c) =>
    (control.ms > 0 && playing && (c === "white" ? whiteMs : blackMs) < 10000 ? "yes" : "no");
  const seats = {
    seat_top_name: hot ? colourName(foe) : cast.name,
    seat_top_line: hot ? "on this board" : cast.line,
    seat_top_ini: hot ? colourName(foe).slice(0, 1) : cast.name.slice(0, 1),
    seat_top_clock: msOf(foe),
    seat_top_taken: tookOf(foe),
    seat_top_edge: edgeOf(foe),
    seat_top_turn: turn === foe && playing ? "yes" : "no",
    seat_top_low: lowOf(foe),
    seat_low_name: hot ? colourName(guest) : "You",
    seat_low_line: `${colourName(guest)} · ${game.tc}`,
    seat_low_ini: hot ? colourName(guest).slice(0, 1) : "Y",
    seat_low_clock: msOf(guest),
    seat_low_taken: tookOf(guest),
    seat_low_edge: edgeOf(guest),
    seat_low_turn: turn === guest && playing ? "yes" : "no",
    seat_low_low: lowOf(guest),
    // The measured strength of whoever sits there (ir decision-30); a person
    // has none to print.
    seat_top_elo: hot ? "" : (cast.elo ?? ""),
    seat_low_elo: "",
  };
  derive(seats);
  // The same hazard, for a column only an ENDING fills: its resting value is
  // empty, so nothing would ever write it onto a game already standing. Asked
  // of absence alone, so it can never erase an ending that has been reached.
  // An ending names its winner by the cast, so a game rewritten to the member
  // it became names that member.
  if (game.status === "over") {
    if ((game.won ?? "") !== wonBy(game.result)) patch.won = wonBy(game.result);
  } else if (game.won === undefined) patch.won = "";
  if (game.dragged === undefined) patch.dragged = "no";

  /* --- writing only what differs ------------------------------------------ */

  const differs = (want, have) => have === undefined ||
    Object.keys(want).some((k) => txt(have[k] ?? "") !== txt(want[k]));
  const updates = [];
  const bySquare = {};
  for (const row of squares) bySquare[row.id] = row;
  for (const want of wantSquares) {
    if (differs(want, bySquare[want.id])) updates.push({op: "put", entity: "square", id: want.id, row: want});
  }
  const byPiece = {};
  for (const row of (rows.piece ?? [])) byPiece[row.id] = row;
  for (const want of wantPieces) {
    if (differs(want, byPiece[want.id])) updates.push({op: "put", entity: "piece", id: want.id, row: want});
  }
  const byLegal = {};
  for (const row of legals) byLegal[row.id] = row;
  for (const want of wantLegal) {
    if (differs(want, byLegal[want.id])) updates.push({op: "put", entity: "legal", id: want.id, row: want});
  }

  for (const u of moveUpdates) updates.push(u);
  if (setup === undefined) updates.push(putSetup);

  if (over !== "" && playing) {
    const result = winner === "" ? RESULT.draw : RESULT[winner];
    Object.assign(patch, {status: "over", result, won: wonBy(result), termination: over, selected: "", promo_from: "", promo_to: "", draw_offer: "none", check: checked ? "yes" : "no"});
  }
  if (Object.keys(patch).length > 0) updates.push({op: "patch", entity: "game", id: game.id, row: patch});
  if (updates.length > 0) return {updates};

  /* --- the house's answer -------------------------------------------------- */

  if (!playing || over !== "") return {updates: []};
  // A draw offered is answered before a move is chosen: the house takes it when
  // it is not better, and declines when it is.
  if (game.draw_offer === "you" && game.mode === "house") {
    const eyes = evaluate(pos) * (turn === game.side ? -1 : 1);
    if (eyes <= 40) {
      return {updates: [{op: "patch", entity: "game", id: game.id, row: {status: "over", result: RESULT.draw, won: wonBy(RESULT.draw), termination: "agreement", draw_offer: "none"}}]};
    }
    return {updates: [{op: "patch", entity: "game", id: game.id, row: {draw_offer: "declined"}}]};
  }
  if (mine) return {updates: []};
  // Whose move this is to choose. An engine-seated member is answered by its
  // unit or not at all: falling through here would record a Move row naming
  // somebody who did not choose it, and a board that waits is a liveness cost
  // where a misattributed record is a correctness one.
  if (cast.seat !== "search") return {updates: []};
  if (event.type !== "house") return {updates: [], then: {type: "house", delay: 420}};
  const chosen = houseMove(pos, moves, cast.level);
  const pick = named.find((n) => n.m === chosen);
  return pick === undefined ? {updates: []} : play(pick);
}
