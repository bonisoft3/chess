// Perft — the oracle.
//
// A perft count is the number of leaf nodes of the legal-move tree at a given
// depth from a given position. The counts below are the published ones for the
// six standard test positions; they are exact, independent of this codebase,
// and every rule of chess is load-bearing in at least one of them — castling
// rights lost to a captured rook, en passant that would expose the king,
// promotion under check, the king that may not castle through an attacked
// square. A move generator that is wrong anywhere is wrong here by a number.
//
// The tree is walked through the app's own `legal` rows: the engine writes
// every playable move as a row carrying the position it leads to, so the
// oracle needs no surface the board itself does not use. The walk carries that
// position in the columns the row states it in, so a count that comes out right
// is also a hundred thousand round trips through them.
import { assertEquals } from "jsr:@std/assert@1";

const source = await Deno.readTextFile(new URL("../shell/handlers/referee.js", import.meta.url));
// The compartment takes a script's completion value; indirect eval is the same
// rule, so the reduce loads here exactly as the terminal loads it.
// deno-lint-ignore no-explicit-any
const reduce = (0, eval)(source) as (state: any, event: any) => any;

/** The columns a game row names its position in. A published FEN enters as the
 *  wire column alone, which is what an imported position is. */
type Position = Record<string, string | number>;
const COLUMNS = ["board", "turn", "castling", "ep", "halfmove", "fullmove", "fen"];

const seat = (pos: Position) => ({
  items: [],
  rows: {
    game: [{
      id: "g", mode: "hotseat", bot: "otto", side: "white", ...pos,
      ply: "0", status: "playing", result: "", termination: "",
      check: "no", selected: "", flipped: "no", last_from: "", last_to: "",
      current: "yes", ordinal: "0001",
    }],
    move: [], legal: [], square: [],
  },
});

/** The position a legal row reached, as a game row names the one it stands on. */
const reached = (row: Position): Position =>
  Object.fromEntries(COLUMNS.map((c) => [c, row[`${c}_after`]]));

const movesFrom = (pos: Position): Position[] =>
  (reduce(seat(pos), { type: "mutation" }).updates ?? [])
    .filter((u: { entity: string; row?: unknown }) => u.entity === "legal" && u.row !== undefined)
    .map((u: { op: "put"; row: Position }) => u.row);

const perft = (pos: Position, depth: number): number => {
  const moves = movesFrom(pos);
  if (depth <= 1) return moves.length;
  let nodes = 0;
  for (const m of moves) nodes += perft(reached(m), depth - 1);
  return nodes;
};

// The six standard positions (chessprogramming.org). Depths are capped where
// the next one would cost minutes for nothing a shallower disagreement would
// not already have caught.
const POSITIONS: { name: string; fen: string; counts: number[] }[] = [
  {
    name: "initial",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    counts: [20, 400, 8902, 197281],
  },
  {
    name: "kiwipete",
    fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    counts: [48, 2039, 97862],
  },
  {
    name: "position 3 — rooks, pawns and a passed race",
    fen: "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    counts: [14, 191, 2812, 43238],
  },
  {
    name: "position 4 — promotion under fire",
    fen: "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
    counts: [6, 264, 9467],
  },
  {
    name: "position 5",
    fen: "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
    counts: [44, 1486, 62379],
  },
  {
    name: "position 6",
    fen: "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
    counts: [46, 2079, 89890],
  },
];

for (const p of POSITIONS) {
  Deno.test(`perft — ${p.name}`, () => {
    p.counts.forEach((want, i) => assertEquals(perft({ fen: p.fen }, i + 1), want, `depth ${i + 1}`));
  });
}
