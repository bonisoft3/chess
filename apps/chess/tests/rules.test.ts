// The rules, checked against games and positions this codebase did not invent.
//
// Perft answers whether the move generator is right. This answers whether the
// app can NAME what it generated: a game replays only if every move the score
// sheet spells is the one and only row wearing that name, which is the whole
// of SAN — the piece letter, the capture, the file-or-rank disambiguation, the
// promotion suffix, the check and mate marks.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { buttons, choose, loadBoard, pickers, view, wakers } from "./surface.ts";

const source = await Deno.readTextFile(new URL("../shell/handlers/referee.js", import.meta.url));
// deno-lint-ignore no-explicit-any
const reduce = (0, eval)(source) as (state: any, event: any) => any;

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type Legal = { san: string; uci: string; fen_after: string; from_sq: string; to_sq: string; promo: string };

const seat = (fen: string, over = false) => ({
  items: [],
  rows: {
    game: [{
      id: "g", mode: "hotseat", bot: "otto", side: "white", fen,
      turn: fen.split(" ")[1] === "b" ? "black" : "white",
      ply: "0", status: over ? "over" : "playing", result: "", termination: "",
      check: "no", selected: "", flipped: "no", last_from: "", last_to: "",
      current: "yes", ordinal: "0001",
    }],
    move: [], legal: [], square: [],
  },
});

// deno-lint-ignore no-explicit-any
const updates = (fen: string): any[] => reduce(seat(fen), { type: "mutation" }).updates ?? [];
const moves = (fen: string): Legal[] =>
  updates(fen).filter((u) => u.entity === "legal" && u.row !== undefined).map((u) => u.row);
const ending = (fen: string) => updates(fen).find((u) => u.entity === "game" && u.op === "patch")?.row;

/** Replay a score sheet, insisting each move is named exactly once. */
const replay = (score: string): string => {
  let fen = START;
  for (const san of score.split(/\s+/).filter((t) => t !== "" && !/^\d+\.$/.test(t))) {
    const hits = moves(fen).filter((m) => m.san === san);
    assert(hits.length === 1, `"${san}" matched ${hits.length} moves in ${fen}`);
    fen = hits[0].fen_after;
  }
  return fen;
};

Deno.test("the Opera Game replays move for move and ends in mate", () => {
  const fen = replay(`
    e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5
    Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#`);
  assertEquals(ending(fen)?.termination, "checkmate");
  assertEquals(ending(fen)?.result, "1-0");
});

Deno.test("the Immortal Game replays move for move and ends in mate", () => {
  const fen = replay(`
    e4 e5 f4 exf4 Bc4 Qh4+ Kf1 b5 Bxb5 Nf6 Nf3 Qh6 d3 Nh5 Nh4 Qg5 Nf5 c6 g4 Nf6
    Rg1 cxb5 h4 Qg6 h5 Qg5 Qf3 Ng8 Bxf4 Qf6 Nc3 Bc5 Nd5 Qxb2 Bd6 Bxg1 e5 Qxa1+
    Ke2 Na6 Nxg7+ Kd8 Qf6+ Nxf6 Be7#`);
  assertEquals(ending(fen)?.termination, "checkmate");
  assertEquals(ending(fen)?.result, "1-0");
});

Deno.test("castling is named by its side, and only where the rights and the squares allow", () => {
  const both = moves("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1").map((m) => m.san);
  assert(both.includes("O-O") && both.includes("O-O-O"), both.join(" "));
  // A rook that has been taken takes its right with it: black's h8 rook is
  // gone, so only the long castle is left.
  const lost = moves("r3k3/8/8/8/8/8/8/R3K2R b KQq - 0 1").map((m) => m.san);
  assert(lost.includes("O-O-O") && !lost.includes("O-O"), lost.join(" "));
  // Through check is not a castle: the f1 square is attacked from f8.
  const through = moves("4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1").map((m) => m.san);
  assert(!through.includes("O-O"), through.join(" "));
  assert(through.includes("O-O-O"), through.join(" "));
});

Deno.test("a rook taken on its home square takes that side's castling with it", () => {
  // The brief states it and it is the classic engine bug: the right belongs to
  // the SQUARE, so a capture landing on it must strip the right even though
  // the side that owned it never moved a thing. Checked on the position the
  // capture reaches, which is what every later move reads.
  const rights = (fen: string, san: string) => {
    const found = moves(fen).find((m) => m.san === san);
    assert(found !== undefined, `${san} is not offered: ${moves(fen).map((m) => m.san).join(" ")}`);
    return found!.fen_after.split(" ")[2];
  };
  // Black's bishop takes the h1 rook: white keeps the queenside right alone.
  assertEquals(rights("r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1", "Bxh1"), "Qkq");
  // And the a8 rook, taken by white's, costs black the queenside one.
  assertEquals(rights("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "Rxa8+"), "Kk");
});

Deno.test("two pieces reaching one square are told apart by file, then by rank, then by both", () => {
  // The check and mate marks are about the position the move reaches; what is
  // under test is the part of the name that says which piece moved.
  const names = (fen: string) => moves(fen).map((m) => m.san.replace(/[+#]$/, ""));
  // Knights on b1 and f3, both able to reach d2: the files differ, so the file
  // is enough.
  const byFile = names("4k3/8/8/8/8/5N2/8/1N2K3 w - - 0 1");
  assert(byFile.includes("Nbd2") && byFile.includes("Nfd2"), byFile.join(" "));
  // Knights on b1 and b5 share a file, and both bear on c3; there the rank is
  // what tells them apart.
  const byRank = names("4k3/8/8/1N6/8/8/8/1N2K3 w - - 0 1");
  assert(byRank.includes("N1c3") && byRank.includes("N5c3"), byRank.join(" "));
  // Queens on a1, a4 and d1 all reach d4. Only the one sharing a file with the
  // second and a rank with the third needs its whole square; the other two are
  // named by the half that is already unique.
  const three = names("7k/8/8/8/Q7/8/8/Q2QK3 w - - 0 1");
  assert(three.includes("Qa1d4") && three.includes("Q4d4") && three.includes("Qdd4"), three.join(" "));
});

Deno.test("a pawn on the seventh may become any of four pieces", () => {
  const promos = moves("4k3/P7/8/8/8/8/8/4K3 w - - 0 1").filter((m) => m.promo !== "");
  // The queen and the rook both give check from a8 down the eighth rank, and
  // the mark is part of the name.
  assertEquals(promos.map((m) => m.san).sort(), ["a8=B", "a8=N", "a8=Q+", "a8=R+"].sort());
});

Deno.test("en passant is offered for one move and never leaves the king in check", () => {
  const offered = moves("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1").map((m) => m.san);
  assert(offered.includes("exd6"), offered.join(" "));
  // The same capture with the king behind it on the rank: taking would clear
  // two pawns off the fifth and hang the king to the rook.
  const pinned = moves("8/8/8/K2pP2r/8/8/8/4k3 w - d6 0 1").map((m) => m.san);
  assert(!pinned.includes("exd6"), pinned.join(" "));
});

Deno.test("the drawn endings are named apart", () => {
  assertEquals(ending("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")?.termination, "stalemate");
  assertEquals(ending("7k/8/6K1/8/8/8/8/6N1 w - - 0 1")?.termination, "insufficient");
  assertEquals(ending("4k3/8/8/8/8/8/4P3/4K2R w K - 100 60")?.termination, "fifty-move");
  const stalemate = ending("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  assertEquals(stalemate?.result, "1/2-1/2");
});

/* --- the engine's answer, at the boundary -------------------------------- */

// A house game with the engine to move: `mine` is false, so nothing but an
// answer can move this board. The four cases below are the four layers, and
// each fails alone — a rule that looked the move up by name without checking
// the position passes the first two and only the third catches it.
const E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
const asked = (fen: string) => ({
  items: [],
  rows: {
    game: [{
      id: "g", mode: "house", bot: "sable", level: "5", side: "white", fen,
      turn: "black", ply: "1", status: "playing", result: "", termination: "",
      check: "no", selected: "", flipped: "no", last_from: "e2", last_to: "e4",
      current: "yes", ordinal: "0001", ask: fen, ask_ply: "1", ask_nodes: "200000",
    }],
    move: [], legal: [], square: [],
  },
});
// deno-lint-ignore no-explicit-any
const answer = (fen: string, detail: Record<string, string>): any[] =>
  reduce(asked(fen), { type: "answer", detail }).updates ?? [];
const said = (over: Record<string, string> = {}) => ({ game: "g", fen: E4, ply: "1", uci: "e7e5", ...over });

Deno.test("an answer the referee itself named is played, and named the referee's way", () => {
  const rows = answer(E4, said()).filter((u) => u.entity === "move").map((u) => u.row);
  assertEquals(rows.length, 1);
  const row = rows[0];
  // Not "e5" and the FEN spelled out here: what the engine said was four
  // characters, and everything the record keeps came from the app's own row
  // for that move. The unit is trusted for a preference, never a possibility.
  const named = moves(E4).filter((m) => m.uci === "e7e5");
  assertEquals(named.length, 1);
  assertEquals(row.san, named[0].san);
  assertEquals(row.fen_after, named[0].fen_after);
  assertEquals(row.color, "black");
});

Deno.test("an answer no row wears moves nothing at all", () => {
  // Well-formed under the parser and absent from the position — a pawn cannot
  // go three squares. Empty and not merely move-free: a patch clearing
  // `selected` would be a silent half-accept.
  assertEquals(answer(E4, said({ uci: "a7a4" })), []);
  // And the parser refuses what is not a move-shaped string before any lookup.
  assertEquals(answer(E4, said({ uci: "bestmove e7e5" })), []);
  assertEquals(answer(E4, said({ uci: "" })), []);
});

Deno.test("an answer about a position the board has left is discarded", () => {
  // The move is legal HERE and the answer is about the position before it: a
  // search that finished late, or twice. Looking the move up by name alone
  // passes both cases above and fails only this one.
  // e7e5 is legal on both boards and the answer names the one the board has
  // left, so nothing but the epoch can reject it.
  const elsewhere = "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1";
  assert(moves(elsewhere).some((m) => m.uci === "e7e5"));
  assertEquals(answer(elsewhere, said()), []);
});

Deno.test("an answer for a search-seated member is discarded", () => {
  // A game names who is across the board; an answer from the unit for a
  // member the search seats would write a Move row naming a member that did
  // not choose it, which is the one thing the seats exist to prevent.
  const board = asked(E4);
  board.rows.game[0].bot = "nell";
  board.rows.game[0].level = "2";
  assertEquals(reduce(board, { type: "answer", detail: said() }).updates ?? [], []);
});

Deno.test("an answer about another board is discarded", () => {
  // Several games stand at once; only one is current. The epoch is the game
  // and the position, never the ply, which two positions can share.
  assertEquals(answer(E4, said({ game: "h" })), []);
});

/* --- the wrapper, on both sides of itself -------------------------------- */

// unit.js is a classic worker script: `self` is its seat towards the terminal
// and `Worker` is how it reaches the engine, so handing it both as parameters
// puts the test on either side of it at once. What is under test is the whole
// of what makes the engine's answer reproducible — nothing below reads UCI.
const wrapper = await Deno.readTextFile(new URL("../shell/units/stockfish/unit.js", import.meta.url));

const unit = () => {
  const said: unknown[] = [];
  const sent: string[] = [];
  let engine: (e: { data: unknown }) => void = () => {};
  let seat: (e: { data: unknown }) => void = () => {};
  const self = {
    postMessage: (m: unknown) => said.push(m),
    // deno-lint-ignore no-explicit-any
    addEventListener: (t: string, fn: any) => {
      if (t === "message") seat = fn;
    },
  };
  let engines = 0;
  class Engine {
    constructor() {
      engines += 1;
    }
    postMessage(line: string) {
      sent.push(line);
    }
    // deno-lint-ignore no-explicit-any
    addEventListener(t: string, fn: any) {
      if (t === "message") engine = fn;
    }
  }
  new Function("self", "Worker", wrapper)(self, Engine);
  return {
    said,
    sent,
    get engines() {
      return engines;
    },
    boots: () => engine({ data: "uciok" }),
    answers: (line: string) => engine({ data: line }),
    props: (props: Record<string, string>) => seat({ data: { type: "pronto:props", props } }),
  };
};

const ASKED = { game: "g", fen: E4, ply: "1", nodes: "20000" };

Deno.test("the engine is built by the first question, not by the mount", () => {
  const u = unit();
  // A mount that built the engine would cost 7.3 MB to every visit, including
  // the four opponents that never reach one.
  assertEquals(u.said, [{ type: "pronto:ready" }]);
  assertEquals(u.engines, 0);
  u.props({ ...ASKED, fen: "" });
  assertEquals(u.engines, 0, "an empty ask built one");
  u.props({ ...ASKED, fen: "not a fen" });
  assertEquals(u.engines, 0, "a FEN this file refuses built one");
  u.props(ASKED);
  assertEquals(u.engines, 1);
  assertEquals(u.sent, ["uci"]);
});

Deno.test("a question asked before uciok waits for it, and for the options", () => {
  const u = unit();
  u.props(ASKED);
  // A question outruns the boot, and waiting for it is the queue's job: a
  // search must reach no engine that cannot run it.
  assertEquals(u.sent, ["uci"]);
  u.boots();
  // Threads 1 and Hash 16 before any search, so none can run under a
  // configuration nobody chose.
  assertEquals(u.sent, [
    "uci",
    "setoption name Threads value 1",
    "setoption name Hash value 16",
    "ucinewgame",
    `position fen ${E4}`,
    "go nodes 20000",
  ]);
});

Deno.test("a search is asked from a cleared table, in nodes, and only once per question", () => {
  const u = unit();
  u.props(ASKED);
  u.boots();
  // ucinewgame before every search: the transposition table is what makes one
  // answer depend on the search before it.
  assertEquals(u.sent.slice(3), ["ucinewgame", `position fen ${E4}`, "go nodes 20000"]);
  // The seat re-posts props on every bind pass, roughly once a second. Without
  // the dedupe every beat would restart the search and none would finish.
  u.props(ASKED);
  u.props(ASKED);
  assertEquals(u.sent.length, 6);
  // Never a clock: wall time is not a repeatable budget.
  assert(!u.sent.some((l) => l.includes("movetime")), u.sent.join(" | "));
  // And never the Elo dial, whose Skill::pick_best holds a clock-seeded PRNG —
  // the one feature this seat cannot have, at any point in its life.
  assert(!u.sent.some((l) => l.includes("UCI_LimitStrength")), u.sent.join(" | "));
});

Deno.test("an empty ask closes the question, so the same one may be put again", () => {
  const u = unit();
  u.props(ASKED);
  u.boots();
  u.answers("bestmove e7e5");
  const answered = u.sent.length;
  // Take back the move and play it again: the board puts a question that is
  // byte-identical to the one before it, ply included. Without clearing on the
  // empty ask between them the dedupe reads it as one already answered, no
  // search runs, and the board waits for an answer nobody is computing — with
  // New game the only way out.
  u.props({ ...ASKED, fen: "" });
  u.props(ASKED);
  assertEquals(u.sent.slice(answered), ["ucinewgame", `position fen ${E4}`, "go nodes 20000"]);
});

Deno.test("what the wrapper hands the engine is a line it has vetted", () => {
  const u = unit();
  // This file is the only reader between a device row and a command parser, so
  // a FEN that is not one — or that could end the line and start another —
  // never becomes part of a position command. Nothing here even builds an
  // engine to hand it to.
  for (const fen of ["", "not a fen", `${E4}\ngo infinite`, "8/8/8/8/8/8/8/8 x KQkq - 0 1"]) {
    u.props({ ...ASKED, fen });
  }
  for (const nodes of ["", "0", "-1", "1e6", "999999999"]) {
    u.props({ ...ASKED, nodes });
  }
  assertEquals(u.engines, 0);
  assertEquals(u.sent, []);
});

Deno.test("an answer carries the question it was asked, and only a move-shaped one is passed on", () => {
  const u = unit();
  u.props(ASKED);
  u.boots();
  u.answers("info depth 12 score cp 31 pv e7e5");
  assertEquals(u.said.length, 1);
  u.answers("bestmove e7e5 ponder g1f3");
  // The epoch is the wrapper's to attach: the engine says four characters and
  // knows nothing about which board or which position asked.
  assertEquals(u.said[1], {
    type: "pronto:event",
    name: "answer",
    detail: { game: "g", fen: E4, ply: "1", uci: "e7e5" },
  });
  // A second bestmove is nobody's question, and the engine's stock answer for
  // a position with no move is not a move.
  u.answers("bestmove e7e5");
  u.answers("bestmove (none)");
  assertEquals(u.said.length, 2);
});

Deno.test("a reading asks for two lines, and answers with both scores and the line", () => {
  const u = unit();
  u.props({ ...ASKED, lines: "2" });
  u.boots();
  assertEquals(u.sent.slice(3), ["setoption name MultiPV value 2", "ucinewgame", `position fen ${E4}`, "go nodes 20000"]);
  u.answers("info depth 10 multipv 1 score cp 25 nodes 100 pv e7e5 g1f3 b8c6 f1c4 g8f6");
  u.answers("info depth 10 multipv 2 score cp 40 nodes 100 pv c7c5 g1f3");
  // A bound is a search still narrowing, not a reading of the position.
  u.answers("info depth 11 multipv 1 score cp 90 lowerbound nodes 150 pv e7e5");
  u.answers("info depth 11 multipv 1 score cp 31 nodes 200 pv e7e5 g1f3 b8c6 f1c4 g8f6");
  u.answers("info depth 11 multipv 2 score mate -3 nodes 200 pv c7c5 g1f3");
  u.answers("bestmove e7e5 ponder g1f3");
  assertEquals(u.said[1], {
    type: "pronto:event",
    name: "answer",
    detail: { game: "g", fen: E4, ply: "1", uci: "e7e5", score: "cp 31", second: "mate -3", pv: "e7e5 g1f3 b8c6 f1c4" },
  });
});

Deno.test("the house asking for its move puts the engine back on one line and answers as it always did", () => {
  const u = unit();
  u.props({ ...ASKED, lines: "2" });
  u.boots();
  u.answers("bestmove e7e5");
  u.props({ ...ASKED, fen: "" });
  u.props(ASKED);
  assertEquals(u.sent.slice(-4), ["setoption name MultiPV value 1", "ucinewgame", `position fen ${E4}`, "go nodes 20000"]);
  u.answers("info depth 3 score cp 12 pv e7e5");
  u.answers("bestmove e7e5");
  // deno-lint-ignore no-explicit-any
  assertEquals((u.said[u.said.length - 1] as any).detail, { game: "g", fen: E4, ply: "1", uci: "e7e5" });
});

/* --- the pieces that travel ------------------------------------------------ */

// A piece row that changes square is a node the board slides, so replaying a
// game through the referee and counting those changes IS the animation, asked
// without a browser (ir decision-29).
const replayTravels = (score: string) => {
  const rows: Record<string, Record<string, string>[]> = {
    game: [{
      id: "g", mode: "hotseat", bot: "otto", side: "white", tc: "unlimited", fen: START, turn: "white", ply: "0",
      status: "playing", result: "", termination: "", check: "no", selected: "", flipped: "no",
      last_from: "", last_to: "", current: "yes", ordinal: "0001", cursor: "start", step: "", review: "",
    }],
    move: [], legal: [], square: [], piece: [], opening: [],
  };
  const state = { items: [], rows };
  const standing = () => new Map(rows.piece.filter((p) => p.taken !== "yes").map((p) => [p.id, p.square]));
  wake(state);
  const travels: { san: string; moved: string[] }[] = [];
  for (const san of score.split(/\s+/).filter((t) => t !== "")) {
    const before = standing();
    const offered = rows.legal.filter((l) => l.ply === rows.game[0].ply && l.san === san);
    assert(offered.length === 1, `"${san}" is not one legal move at ply ${rows.game[0].ply}`);
    wake(state, { type: "click", id: offered[0].from_sq });
    wake(state, { type: "click", id: offered[0].to_sq });
    const moved = [...standing()].filter(([id, sq]) => before.has(id) && before.get(id) !== sq).map(([id, sq]) => `${before.get(id)}${sq}`);
    travels.push({ san, moved });
  }
  return travels;
};

// A game where a bishop, a knight and two rooks each have a twin of their kind
// nearer the arrival square than the piece that actually moves there, with
// captures on both sides.
const TWINS =
  "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 h3 h6 Nbd2 Re8 Nf1 Be6 Ng3 Qd7 Nh4 Bxb3 " +
  "Qxb3 Na5 Qc2 d5 Nhf5 dxe4 dxe4 Nc4 Bxh6 gxh6 Qc1 Kh7 Qd1 Rg8 Qh5 Qe6 Rad1 Rg6 Rd3 Rag8 Kh2 Nxb2 Rf3 Nxe4 Nxe4 Qxf5";

Deno.test("a move slides the piece that moved and no other, and castling slides two", () => {
  const games = [TWINS, "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7"];
  for (const score of games) {
    for (const t of replayTravels(score)) {
      const castles = t.san.startsWith("O-O");
      assertEquals(t.moved.length, castles ? 2 : 1, `${t.san} slid ${t.moved.join(", ")}`);
    }
  }
});

/* --- the words on screen --------------------------------------------------- */

// What a player reads: text between tags, and the attributes the terminal
// prints (an empty list's line, a control's label). Tags, comments, styles and
// bindings are the app's own business and are left out.
const SCREENS = ["../shell/screens/board.html", "../shell/screens/shelf.html", "../shell/screens/sheet.html"];
const DEVELOPER_WORDS = /\b(device|row|column|standing|written down|at this board)\b/i;
const onScreen = (html: string) => {
  const bare = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(style|script)\b[\s\S]*?<\/\1>/g, " ");
  const shown = [...bare.matchAll(/(?:data-empty|aria-label)="([^"{]*)"/g)].map((m) => m[1]);
  const text = bare.replace(/<[^>]*>/g, "\n").split("\n").map((t) => t.trim()).filter((t) => t !== "" && !t.includes("{"));
  return shown.concat(text);
};

// A rating typed by hand fails here: elo.json must be what the bench's games
// rate to, and each member's seat and picker entry carry the rating it prints
// for them (ir decision-30).
Deno.test("every computer opponent carries the rating the bench measured for it", async () => {
  const bench = JSON.parse(await Deno.readTextFile(new URL("./elo.json", import.meta.url)));
  const { rate } = await import("./elo/rate.mjs");
  const games = (await Deno.readTextFile(new URL("./elo/games.jsonl", import.meta.url))).trim().split("\n").map((l) => JSON.parse(l));
  assertEquals(rate(games).ratings, bench.ratings, "elo.json is not what the bench's games rate to");
  const board = await Deno.readTextFile(new URL("../board.cue", import.meta.url));
  const members = Object.keys(bench.ratings);
  assertEquals(members.length, 5);
  for (const bot of members) {
    const state = seat(START);
    state.rows.game[0] = { ...state.rows.game[0], mode: "house", bot, tc: "5+0" };
    // deno-lint-ignore no-explicit-any
    const row = (reduce(state, { type: "mutation" }).updates ?? []).find((u: any) => u.entity === "game" && u.op === "patch")?.row;
    const shown = bench.ratings[bot].shown;
    assertEquals(row?.seat_top_elo, shown, `${bot}'s seat`);
    assert(board.includes(`item: "${row.seat_top_name} (${shown}) — `), `${bot}'s picker entry lacks (${shown})`);
  }
});

// Pip measured as Nell's strength and was merged into her (ir decision-30). A
// game stored before then still names Pip, which the column's CEL does not
// admit: the next wake rewrites the row to Nell, whole, so it both passes
// and names who is actually playing.
Deno.test("a game stored against Pip plays on against Nell", async () => {
  const bench = JSON.parse(await Deno.readTextFile(new URL("./elo.json", import.meta.url)));
  const state = seat(START);
  state.rows.game[0] = {
    ...state.rows.game[0], mode: "house", tc: "5+0",
    bot: "pip", level: "1", bot_name: "Pip", bot_line: "Just learning — takes what is offered.",
  };
  // deno-lint-ignore no-explicit-any
  const row = (reduce(state, { type: "mutation" }).updates ?? []).find((u: any) => u.entity === "game" && u.op === "patch")?.row;
  assertEquals(
    [row?.bot, row?.level, row?.bot_name, row?.bot_line, row?.seat_top_name, row?.seat_top_elo],
    ["nell", "2", "Nell", "Sees one move ahead and likes a trade.", "Nell", bench.ratings.nell.shown],
  );
  // A finished one names Nell as its winner too.
  state.rows.game[0] = { ...state.rows.game[0], side: "white", status: "over", result: "0-1", termination: "resignation", won: "Pip won" };
  // deno-lint-ignore no-explicit-any
  const over = (reduce(state, { type: "mutation" }).updates ?? []).find((u: any) => u.entity === "game" && u.op === "patch")?.row;
  assertEquals([over?.bot_name, over?.won], ["Nell", "Nell won"]);
});

Deno.test("no screen's words describe how the app is built", async () => {
  const found: string[] = [];
  for (const path of SCREENS) {
    const html = await Deno.readTextFile(new URL(path, import.meta.url));
    for (const line of onScreen(html)) if (DEVELOPER_WORDS.test(line)) found.push(`${path}: ${line}`);
  }
  assertEquals(found, []);
});

/* --- the review ----------------------------------------------------------- */

// A reading is a conversation between the referee and the seat, so the test
// holds the store: every update is applied to the rows the next wake reads,
// exactly as the terminal would, and the engine is a script of stated scores.
// The marks are a function of those scores and nothing else (ir decision-25).
const OPENINGS = [
  { id: "B00", name: "King's Pawn", uci: "e2e4" },
  { id: "C20", name: "King's Pawn Game", uci: "e2e4 e7e5" },
  { id: "C50", name: "Italian Game", uci: "e2e4 e7e5 g1f3 b8c6 f1c4" },
];
type Row = Record<string, string>;

/** A game as the store holds it, its moves named by the referee's own rows. */
const finished = (score: string, over: Row = {}) => {
  const log: Row[] = [];
  let fen = START;
  for (const san of score.split(/\s+/).filter((t) => t !== "")) {
    const hit = moves(fen).filter((m) => m.san === san);
    assert(hit.length === 1, `"${san}" in ${fen}`);
    const ply = log.length + 1;
    log.push({
      id: `g/${String(ply).padStart(3, "0")}`, game_id: "g", ply: String(ply), number: String(Math.ceil(ply / 2)),
      color: ply % 2 === 1 ? "white" : "black", san, uci: hit[0].uci, fen_after: hit[0].fen_after,
      capture: "no", check: "no", retracted: "no", white_clock: "PT0S", black_clock: "PT0S",
      before: "", second: "", best: "", line: "", after: "", mark: "", tide: "",
    });
    fen = hit[0].fen_after;
  }
  const rows: Record<string, Row[]> = {
    game: [{
      id: "g", mode: "house", bot: "otto", side: "white", tc: "unlimited", fen,
      turn: fen.split(" ")[1] === "b" ? "black" : "white", ply: String(log.length),
      status: "over", result: "0-1", termination: "resignation", check: "no", selected: "",
      flipped: "no", last_from: "", last_to: "", current: "yes", ordinal: "0001",
      cursor: log[log.length - 1].id, step: "", review: "", ...over,
    }],
    move: log, legal: [], square: [], piece: [], opening: OPENINGS,
  };
  return { items: [], rows };
};
type Store = ReturnType<typeof finished>;

// deno-lint-ignore no-explicit-any
const apply = (state: Store, updates: any[]) => {
  for (const u of updates) {
    const table = state.rows[u.entity ?? "square"] ??= [];
    const row = Object.fromEntries(Object.entries(u.row ?? {}).map(([k, v]) => [k, String(v)]));
    const at = table.findIndex((r) => r.id === u.id);
    if (u.op === "put") {
      if (at >= 0) table[at] = { id: u.id, ...row };
      else table.push({ id: u.id, ...row });
    } else if (at >= 0) table[at] = { ...table[at], ...row };
  }
};
/** One event, then every wake it causes, until the referee writes nothing. */
// deno-lint-ignore no-explicit-any
const wake = (state: Store, event: any = { type: "mutation" }) => {
  let out = reduce(state, event);
  for (let n = 0; (out.updates ?? []).length > 0; n += 1) {
    assert(n < 60, "the referee never settled");
    apply(state, out.updates);
    out = reduce(state, { type: "mutation" });
  }
};
const g0 = (state: Store) => state.rows.game[0];

/** Put the question the board is asking to the engine and apply its answer. */
const answerOnce = (state: Store, engine: (p: number, fen: string) => Row) => {
  const g = g0(state);
  const detail = { game: "g", fen: g.ask, ply: g.ask_ply, ...engine(Number(g.ask_ply), g.ask) };
  apply(state, reduce(state, { type: "answer", detail }).updates ?? []);
  wake(state);
  return { fen: g.ask, lines: g.ask_lines, ply: g.ask_ply };
};

/** Answer every question the board puts, until it asks none. */
const drain = (state: Store, engine: (p: number, fen: string) => Row) => {
  const asked: Row[] = [];
  for (let n = 0; (g0(state).ask ?? "") !== ""; n += 1) {
    assert(n < 60, "the reading never ended");
    asked.push(answerOnce(state, engine));
  }
  return asked;
};

/** Ask for the review and answer every question the board puts. */
const readThrough = (state: Store, engine: (p: number, fen: string) => Row) => {
  wake(state, { type: "click", from: "btn-review" });
  return drain(state, engine);
};

// Stepping to the first move and back is most of what a review is: a piece a
// capture took off comes back as itself, so the pieces never outgrow a board.
Deno.test("stepping back and forth through a game revives the pieces it took off and mints no more", () => {
  const state = finished(TWINS);
  wake(state);
  for (let n = 0; n < 12; n += 1) {
    for (const step of ["first", "live"]) {
      g0(state).step = step;
      wake(state);
    }
  }
  const ids = state.rows.piece.map((p) => p.id);
  assert(ids.length <= 32, `${ids.length} pieces after stepping`);
  assert(ids.every((id) => id.length === 4), `ids past four characters: ${ids.filter((id) => id.length !== 4).join(" ")}`);
});

// The shelf's Review takes a finished game back onto the board, which offers
// the reading as it does for a game that has just ended (accept-review-offered).
Deno.test("a finished game taken up from the shelf is current on the board and offers its reading", async () => {
  // deno-lint-ignore no-explicit-any
  const resume = (0, eval)(await Deno.readTextFile(new URL("../shell/handlers/resume.js", import.meta.url))) as (state: any, event: any) => any;
  const state = finished(MARKED, { current: "no" });
  state.rows.game.push({ ...g0(state), id: "h", status: "playing", result: "", termination: "", current: "yes", ordinal: "0002" });
  apply(state, resume(state, { type: "click", id: "g" }).updates);
  assertEquals(state.rows.game.map((g) => `${g.id}:${g.current}`), ["g:yes", "h:no"]);
  wake(state, { type: "click", from: "btn-review" });
  assert((g0(state).ask ?? "") !== "", "the review put no question to the engine");
});

// Scores are White's view here; the engine states them from the side to move.
const stated = (fen: string, white: number) => `cp ${fen.split(" ")[1] === "w" ? white : -white}`;

const MARKED = "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5";
// The position before each ply, as the engine is scripted to read it: the book
// for five plies, then a slip for each side in turn, and one only move.
const READINGS = [30, 30, 30, 30, 30, 30, 110, -55, 250, 250, 240];
const marker = (state: Store) => {
  const played = state.rows.move.map((m) => m.uci);
  return (p: number, fen: string) => {
    const white = fen.split(" ")[1] === "w";
    const s = READINGS[p];
    // The house preferred something else before each slip — 3… Bc5, 4. d4,
    // 4… Bc5 — because its own preference is never marked down. Everywhere
    // else it would have played the move that was played.
    const best = p === 6 ? "d2d4" : (p === 5 || p === 7 ? "f8c5" : (played[p] ?? "d2d3"));
    const pv = p === 6 ? "d2d4 e5d4 e1g1" : best;
    // The second line is forty worse for the side to move, except before
    // 5. exd5, where anything else gave the position away.
    const second = p === 8 ? -50 : (white ? s - 40 : s + 40);
    return { uci: best, score: stated(fen, s), second: stated(fen, second), pv };
  };
};
const accuracies = (s: Store) => [g0(s).acc_low, g0(s).acc_top];

// The seat never puts the same question twice, so an answer the board cannot
// use (a move the position has not got) must leave a new question standing, or
// the reading would wait on it forever.
Deno.test("an answer the board cannot use is asked again, and the reading still ends", () => {
  const state = finished(MARKED);
  wake(state, { type: "click", from: "btn-review" });
  const first = { ...g0(state) };
  answerOnce(state, () => ({ uci: "a1a1", score: "cp 0" }));
  assertEquals(g0(state).ask, first.ask, "the question moved on without an answer");
  assert(g0(state).ask_nodes !== first.ask_nodes, "the same question stands, so the seat would never put it again");
  drain(state, marker(state));
  assertEquals(g0(state).review, "read");
});

Deno.test("each threshold lands its mark, the book is left alone, and the same scores mark the same", () => {
  const first = finished(MARKED);
  readThrough(first, marker(first));
  const marks = first.rows.move.map((m) => m.mark);
  assertEquals(marks.slice(0, 5), ["book", "book", "book", "book", "book"]);
  // 3… Nf6 cost Black seven points, 4. Ng5 cost White fifteen, 4… d5 cost
  // Black twenty-six, and 5. exd5 was the only move that held.
  assertEquals(marks.filter((m) => m !== "book" && m !== ""), ["?!", "?", "??", "!"]);
  const again = finished(MARKED);
  readThrough(again, marker(again));
  assertEquals(again.rows.move.map((m) => m.mark), marks);
  assertEquals(accuracies(again), accuracies(first));
  // The exact figures, so a wrong formula, tally or strip cannot pass.
  const g = g0(first);
  // White graded 4. Ng5? (fifteen points) and 5. exd5!, the house's own move;
  // Black 3… Nf6?!, 4… d5?? and 5… Na5, the house's own move again.
  assertEquals([g.acc_low, g.acc_top, g.tally_low, g.tally_top], ["71", "59", "1 mistake · 1 only move", "1 blunder · 1 inaccuracy"]);
  // White's chances after each move, in twentieths: +0.3 is 53, +1.1 is 60,
  // −0.55 is 45, +2.5 is 72.
  assertEquals(first.rows.move.map((m) => m.tide).join(" "), "11 11 11 11 11 12 9 14 14 14");
});

Deno.test("a finished game is read a position at a time, in two lines, and ends with both accuracies", () => {
  // Out of the book from the first move, so both sides have moves to grade.
  const s = finished("d4 d5 c4 e6 Nc3 Nf6");
  const played = s.rows.move.map((m) => m.uci);
  const asked = readThrough(s, (p, fen) => ({
    uci: played[p] ?? "a2a3", score: stated(fen, 30), second: stated(fen, 10), pv: played[p] ?? "a2a3",
  }));
  assertEquals(asked.length, 7);
  assert(asked.every((q) => q.lines === "2"), JSON.stringify(asked));
  assertEquals(asked.map((q) => q.ply), ["0", "1", "2", "3", "4", "5", "6"]);
  assertEquals(g0(s).review, "read");
  assert(accuracies(s).every((a) => a !== ""), JSON.stringify(accuracies(s)));
  assertEquals(g0(s).ask_lines, "");
});

Deno.test("a game still being played puts no question and has nothing to advise with", () => {
  const s = finished("e4 e5 Nf3", { status: "playing", mode: "hotseat", result: "", termination: "" });
  wake(s);
  wake(s, { type: "click", from: "btn-review" });
  const g = g0(s);
  assertEquals([g.ask, g.ask_lines, g.review, g.note, g.bar, g.hint, g.acc_low], ["", "", "", "", "", "", ""]);
});

Deno.test("an answer about another position writes nothing, and one this position cannot use writes no move", () => {
  const s = finished(MARKED);
  wake(s, { type: "click", from: "btn-review" });
  const g = g0(s);
  assertEquals(g.ask, START);
  const said = { game: "g", fen: g.ask, ply: g.ask_ply, uci: "e2e4", score: "cp 30", second: "cp 10", pv: "e2e4" };
  assertEquals(reduce(s, { type: "answer", detail: { ...said, fen: E4 } }).updates ?? [], []);
  assertEquals(reduce(s, { type: "answer", detail: { ...said, game: "h" } }).updates ?? [], []);
  // Only the question's budget moves, one node, so the seat asks it again.
  const again = [{ op: "patch", entity: "game", id: "g", row: { ask_nodes: String(Number(g.ask_nodes) + 1) } }];
  assertEquals(reduce(s, { type: "answer", detail: { ...said, uci: "e2e5" } }).updates ?? [], again);
  assertEquals(reduce(s, { type: "answer", detail: { ...said, score: "cp lots" } }).updates ?? [], again);
});

Deno.test("on a marked move the note names the better move and the arrow runs between its squares", () => {
  const s = finished(MARKED);
  readThrough(s, marker(s));
  // Look at 4. Ng5?, the mistake.
  wake(s, { type: "click", id: "g/007" });
  const g = g0(s);
  assertEquals(g.note_head, "4. Ng5?");
  assertEquals(g.note_mark, "?");
  assert(g.note.includes("Better was 4. d4, then 4… exd4 5. O-O."), g.note);
  // d2 to d4, as the board is drawn with White at the foot: eighths, centred.
  assertEquals(g.hint, "M3.5 6.5 L3.5 4.5");
  // Turned round, the same move is drawn from the other side.
  apply(s, [{ op: "patch", entity: "game", id: "g", row: { flipped: "yes" } }]);
  wake(s);
  assertEquals(g0(s).hint, "M4.5 1.5 L4.5 3.5");
  // A sound move draws nothing.
  wake(s, { type: "click", id: "g/010" });
  assertEquals(g0(s).hint, "");
});

Deno.test("a reading left halfway resumes from the rows, and ends with the marks an unbroken one gives", () => {
  const whole = finished(MARKED);
  readThrough(whole, marker(whole));

  const broken = finished(MARKED);
  const engine = marker(broken);
  wake(broken, { type: "click", from: "btn-review" });
  for (let n = 0; n < 4; n += 1) answerOnce(broken, engine);
  // The tab closes: nothing survives but the rows, and a fresh wake over them
  // asks for the fifth position rather than starting again.
  const reopened = { items: [], rows: structuredClone(broken.rows) };
  wake(reopened);
  assertEquals(g0(reopened).ask_ply, "4");
  drain(reopened, engine);
  assertEquals(reopened.rows.move.map((m) => m.mark), whole.rows.move.map((m) => m.mark));
  assertEquals(accuracies(reopened), accuracies(whole));
});

Deno.test("a game that ends in mate is scored at its last position by the rules and never asks the engine there", () => {
  // Scholar's mate: seven plies, so seven positions with a move in them.
  const s = finished("e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7#", { result: "1-0", termination: "checkmate" });
  const played = s.rows.move.map((m) => m.uci);
  const asked = readThrough(s, (p, fen) => ({
    uci: played[p], score: stated(fen, 30), second: stated(fen, -200), pv: played[p],
  }));
  assertEquals(asked.length, 7);
  assert(!asked.some((q) => q.fen === s.rows.move[6].fen_after), "the mated position was put to the engine");
  // White's chances after the mate are the whole of them.
  assertEquals(s.rows.move[6].after, "10000");
  assertEquals(s.rows.move[6].tide, "20");
  assertEquals(g0(s).review, "read");
});

/* --- the next game's terms (ir decision-31) -------------------------------- */

// The board as its stylesheet draws it, the pickers as their machines run, and
// the tables whose change wakes the referee — all read off the emitted files,
// so a picker bound to the wrong row, or a rule that hides one, is caught here.
const BOARD = await loadBoard();
const WAKERS = wakers(BOARD, "referee");
const TERMS = ["mode", "bot", "level", "tc", "side"];
const ALL = pickers(BOARD);
// The next game's terms, and how the game on the board is looked at.
const CARD = ALL.filter((p) => ["mode", "bot", "tc", "side"].includes(p.key));
const LIVE = ALL.filter((p) => ["view", "set"].includes(p.key));
const picker = (key: string) => {
  const p = ALL.find((c) => c.key === key);
  assert(p !== undefined, `no ${key} picker on the board`);
  return p!;
};

/** An empty store, as the terminal opens one: the tab tables it seeds, and
 *  nothing the reader made. */
const empty = (): Store => ({
  items: [],
  rows: { game: [], move: [], legal: [], square: [], piece: [], tick: [{ id: "tick", n: "0", beat: "on" }], opening: OPENINGS },
});

/** A game against the house at its start, and the setup row at its first value. */
const sitting = (over: Row = {}): Store => {
  const s = empty();
  s.rows.setup = [{ id: "next", mode: "house", bot: "otto", level: "3", tc: "5+0", side: "white" }];
  s.rows.game = [{
    id: "g", mode: "house", bot: "otto", level: "3", side: "white", tc: "5+0", set: "print", fen: START, turn: "white", ply: "0",
    status: "playing", result: "", termination: "", check: "no", selected: "", flipped: "no", last_from: "",
    last_to: "", current: "yes", ordinal: "0001", cursor: "start", step: "", review: "",
    white_clock: "PT300S", black_clock: "PT300S", last_tick: "0", ...over,
  }];
  return s;
};
const cur = (s: Store) => {
  const on = s.rows.game.filter((g) => g.current === "yes");
  assert(on.length === 1, `${on.length} games current`);
  return on[0];
};
const termsOf = (g: Row) => [...TERMS.map((k) => g[k]), g.seat_top_name, g.seat_top_elo, g.seat_low_line];

/** One event and every wake it causes, answering each draw the referee asks
 *  for the way the terminal does. Says which wait it asked for last — the
 *  house's beat — for the caller to deliver or not. */
// deno-lint-ignore no-explicit-any
const settle = (state: Store, event: any = { type: "mutation" }, seed = () => 7000 + state.rows.game.length) => {
  let out = reduce(state, event);
  for (let n = 0; ; n += 1) {
    assert(n < 60, "the referee never settled");
    const updates = out.updates ?? [];
    apply(state, updates);
    if (out.then?.type === "open") {
      out = reduce(state, { type: "open", seed: seed() });
      continue;
    }
    if (updates.length === 0) return out.then?.type as string | undefined;
    out = reduce(state, { type: "mutation" });
  }
};

/** One choice on the setup card, written where that picker's machine writes,
 *  and the wake that follows when the table is one the referee sits on. */
const pick = async (s: Store, key: string, option: string) => {
  const p = picker(key);
  const updates = await choose(p, s.rows, option);
  apply(s, updates);
  return updates.length > 0 && WAKERS.has(p.table) ? { wait: settle(s) } : undefined;
};

Deno.test("as Black, after the house has moved, the card still offers every choice and Start plays the one chosen", async () => {
  const s = sitting({ side: "black", flipped: "yes" });
  assertEquals(settle(s), "house", "the house did not ask to open");
  settle(s, { type: "house" });
  assertEquals(cur(s).ply, "1");
  const v = view(BOARD, s.rows);
  for (const id of ["picker-open-mode", "picker-open-bot", "picker-open-tc", "picker-open-side", "btn-start"]) {
    const d = v.depth(id);
    assert(d !== undefined && d <= 1, `#${id} is ${d === undefined ? "out of reach" : `${d} gestures away`} with the guest Black at ply 1`);
  }
  await pick(s, "bot", "vera");
  await pick(s, "side", "black");
  const first = { ...cur(s) };
  assertEquals(first.bot, "otto", "choosing the next opponent changed this game's");
  settle(s, { type: "click", from: "btn-start" });
  const g = cur(s);
  assert(g.id !== first.id, "Start opened no game");
  assertEquals([g.bot, g.level, g.side, g.seat_top_name, g.seat_top_elo], ["vera", "4", "black", "Vera", "1350"]);
  assertEquals(s.rows.game.find((x) => x.id === first.id)?.bot, "otto");
});

Deno.test("every choice on the card leaves the game on the board and a finished one as they started", async () => {
  const OVER = { status: "over", result: "0-1", termination: "resignation" };
  const cases: [string, Row][] = [["a game at its start", {}], ["a finished game", OVER]];
  for (const [what, over] of cases) {
    const s = sitting({ bot: "vera", level: "4", tc: "3+2", side: "black", flipped: "yes", ...over });
    // And a finished game beside it, which the board does not show.
    s.rows.game.push({ ...s.rows.game[0], ...OVER, id: "f", bot: "nell", level: "2", side: "white", flipped: "no", current: "no", ordinal: "0000" });
    settle(s);
    const before = Object.fromEntries(s.rows.game.map((g) => [g.id, termsOf(g)]));
    for (const p of CARD) for (const option of p.options) await pick(s, p.key, option);
    settle(s);
    for (const g of s.rows.game) assertEquals(termsOf(g), before[g.id], `${what}: game ${g.id}`);
    // And the choices landed somewhere: the last option of each picker.
    const next = s.rows.setup?.find((r) => r.id === "next");
    assertEquals([next?.mode, next?.bot, next?.tc, next?.side], ["hotseat", "sable", "10+0", "black"], `${what}: the setup row`);
  }
});

Deno.test("the Board picker turns the board, playing and in review, and the turn survives the wakes after it", async () => {
  const reviewing = finished(MARKED);
  reviewing.rows.tick = [{ id: "tick", n: "0", beat: "on" }];
  settle(reviewing);
  settle(reviewing, { type: "click", from: "btn-review" });
  assert(cur(reviewing).review !== "", "the finished game is not under review");
  const cases: [string, Store][] = [["a game being played", sitting()], ["a finished game under review", reviewing]];
  for (const [what, s] of cases) {
    settle(s);
    // Where a1's cell stands in the reading order, and where its rook is drawn.
    for (const [option, ord, rook] of [["yes", "07", "7,0"], ["no", "56", "0,7"]]) {
      const d = view(BOARD, s.rows).depth(`view-trigger-${option}`);
      assert(d !== undefined, `${what}: "${option}" on the Board picker is out of reach`);
      await pick(s, "view", option);
      s.rows.tick[0].n = String(Number(s.rows.tick[0].n) + 1);
      settle(s);
      const r = s.rows.piece.find((p) => p.square === "a1" && p.taken !== "yes");
      assertEquals(
        [cur(s).flipped, s.rows.square.find((q) => q.id === "a1")?.ord, `${r?.file},${r?.rank}`],
        [option, ord, rook],
        `${what}, flipped ${option}`,
      );
    }
  }
});

Deno.test("with nothing stored, the first game is against Otto, the guest White, the house at 5+0", () => {
  for (const seed of [0, 1, 2, 3, 4]) {
    const s = empty();
    settle(s, { type: "mutation" }, () => seed);
    const g = cur(s);
    assertEquals(
      [g.mode, g.bot, g.side, g.tc, g.seat_top_name, g.seat_low_line],
      ["house", "otto", "white", "5+0", "Otto", "White · 5+0"],
      `drawn ${seed}`,
    );
  }
});

// Breadth-first over what a reader can press and what the house and the clock
// do on their own. What can be pressed in a state is read through the
// stylesheet from that state's rows, so a rule that hides a control is a
// gesture that does not exist, as on screen. Every button the board offers is
// a gesture here: none may move a game's terms (ir decision-31).
const DEPTH = 4;
const BUDGET = 1500;

Deno.test("explored breadth-first, every state keeps the card one gesture away, one game current, and every game's terms", async () => {
  type At = { s: Store; wait?: string; path: string[] };
  const key = (x: At) =>
    JSON.stringify([x.s.rows.game, x.s.rows.setup, x.s.rows.move.map((m) => [m.id, m.retracted, m.best]), x.s.rows.tick, x.wait]);
  const found: Record<string, string[]> = {
    unreachable: [], currentNotOne: [], termsChanged: [], unsettled: [], liveUnreachable: [], liveLost: [], liveUnshown: [],
  };
  const flag = (kind: string, path: string[], why: string) => found[kind].push(`${path.join(" → ")}: ${why}`);
  const acts = buttons(BOARD, "referee");
  const steps = ["nav-first", "nav-back", "nav-fwd", "nav-live"];
  const begin = (s: Store, name: string): At => ({ s, wait: settle(s), path: [name] });
  // Each game start twice: with the setup row, and with none written yet — a
  // store from before the row existed, which the referee must give one.
  const bare = (s: Store) => {
    delete s.rows.setup;
    return s;
  };
  // And a finished game read through, so the review's last state is explored.
  const read = finished(MARKED);
  read.rows.tick = [{ id: "tick", n: "0", beat: "on" }];
  readThrough(read, marker(read));
  const queue = [
    begin(read, "a finished game, read"),
    begin(empty(), "no game, no setup row"),
    begin(sitting(), "guest White"),
    begin(bare(sitting()), "guest White, no setup row"),
    begin(sitting({ side: "black", flipped: "yes" }), "guest Black"),
    begin(bare(sitting({ side: "black", flipped: "yes" })), "guest Black, no setup row"),
  ];
  const seen = new Set(queue.map(key));
  let states = 0;
  while (queue.length > 0 && states < BUDGET) {
    const at = queue.shift()!;
    states += 1;
    const v = view(BOARD, at.s.rows);
    // (a) The card's pickers and Start one gesture away, and every choice in
    // them other than the one each shows two. The opponent is a choice only
    // while the next game is against the house.
    const house = v.node("picker-open-mode")?.parent?.attrs["data-value"] === "house";
    for (const id of ["picker-open-mode", "picker-open-tc", "picker-open-side", ...(house ? ["picker-open-bot"] : []), "btn-start"]) {
      const d = v.depth(id);
      if (d === undefined || d > 1) flag("unreachable", at.path, `#${id} ${d === undefined ? "out of reach" : `${d} gestures away`}`);
    }
    for (const p of CARD) {
      if (p.key === "bot" && !house) continue;
      const shows = v.node(`picker-open-${p.key}`)?.parent?.attrs["data-value"];
      for (const o of p.options) {
        if (o === shows) continue;
        const d = v.depth(`${p.key}-trigger-${o}`);
        if (d === undefined || d > 2) flag("unreachable", at.path, `${p.key} "${o}" ${d === undefined ? "out of reach" : `${d} gestures away`}`);
      }
    }
    // (b) Exactly one game is current.
    const on = at.s.rows.game.filter((g) => g.current === "yes");
    if (on.length !== 1) flag("currentNotOne", at.path, `${on.length} games current`);
    // (e) How the game is looked at: every option of the live pickers in
    // reach, and a choice sticks through the wakes after it and shows — the
    // board turned, a1's cell with it, or the set the pieces are drawn in.
    if (on.length === 1) {
      for (const p of LIVE) {
        for (const o of p.options) {
          if (o === (on[0][p.machine.field] ?? p.machine.initial)) continue;
          const path = [...at.path, `${p.key}:${o}`];
          if (v.depth(`${p.key}-trigger-${o}`) === undefined) {
            flag("liveUnreachable", path, "out of reach");
            continue;
          }
          const s: Store = { items: [], rows: structuredClone(at.s.rows) };
          try {
            await pick(s, p.key, o);
            s.rows.tick[0].n = String(Number(s.rows.tick[0].n) + 1);
            settle(s);
          } catch (err) {
            flag("unsettled", path, String(err));
            continue;
          }
          const now = s.rows.game.find((x) => x.id === on[0].id);
          if (now?.[p.machine.field] !== o) flag("liveLost", path, `${p.machine.field} is ${now?.[p.machine.field]}`);
          const shown = view(BOARD, s.rows).first("table")?.attrs[p.key === "view" ? "data-flipped" : "data-set"];
          const a1 = s.rows.square.find((r) => r.id === "a1")?.ord;
          if (shown !== o || (p.key === "view" && a1 !== (o === "yes" ? "07" : "56"))) {
            flag("liveUnshown", path, `drawn ${shown}, a1's cell at ${a1}`);
          }
          const moved = TERMS.filter((k) => now?.[k] !== on[0][k]);
          if (moved.length > 0) flag("termsChanged", path, `game ${on[0].id}: ${moved.join(", ")}`);
        }
      }
    }
    if (at.path.length > DEPTH || on.length !== 1) continue;
    const g = on[0];

    const next: [string, (s: Store) => Promise<string | undefined> | string | undefined][] = [];
    for (const id of acts) if (v.depth(id) !== undefined) next.push([id, (s) => settle(s, { type: "click", from: id })]);
    // The card's choices write only the setup row: each is checked for the
    // game's terms by the test above, and here for reach in (a), so they are
    // not gestures of the walk.
    const offer = at.s.rows.legal.find((l) => l.game_id === g.id && l.ply === g.ply && l.promo === "");
    if (offer !== undefined) {
      next.push([offer.san, (s) => {
        settle(s, { type: "click", id: offer.from_sq });
        return settle(s, { type: "click", id: offer.to_sq });
      }]);
    }
    for (const id of steps) {
      if (v.depth(id) === undefined) continue;
      next.push([id, (s) => {
        apply(s, [{ op: "patch", entity: "game", id: g.id, row: { step: id.slice("nav-".length) } }]);
        return settle(s);
      }]);
    }
    // What nobody presses: the house's beat, when it asked for one, and the
    // metronome's.
    if (at.wait === "house") next.push(["house", (s) => settle(s, { type: "house" })]);
    next.push(["tick", (s) => {
      s.rows.tick[0].n = String(Number(s.rows.tick[0].n) + 1);
      return settle(s);
    }]);

    for (const [label, act] of next) {
      const s: Store = { items: [], rows: structuredClone(at.s.rows) };
      const path = [...at.path, label];
      let wait: string | undefined;
      try {
        wait = await act(s);
      } catch (err) {
        // (d) The referee settles within its bound.
        flag("unsettled", path, String(err));
        continue;
      }
      // (c) No game's terms moved. No start here names a merged member, so
      // the one sanctioned rewrite never arises.
      for (const was of at.s.rows.game) {
        const now = s.rows.game.find((x) => x.id === was.id);
        const moved = TERMS.filter((k) => now?.[k] !== was[k]);
        if (moved.length > 0) flag("termsChanged", path, `game ${was.id}: ${moved.map((k) => `${k} ${was[k]}→${now?.[k]}`).join(", ")}`);
      }
      const reached = { s, wait, path };
      const k = key(reached);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(reached);
      }
    }
  }
  console.log(`explored ${states} states (${seen.size} distinct reached, depth ${DEPTH})`);
  assertEquals(queue.length, 0, `the budget of ${BUDGET} states cut the exploration short`);
  const summary = Object.entries(found)
    .map(([k, v]) => `${k}: ${v.length}${v.length > 0 ? ` — first: ${v[0]}` : ""}`).join("\n");
  assert(Object.values(found).every((v) => v.length === 0), `\n${summary}`);
});
