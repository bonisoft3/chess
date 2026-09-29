// The board mounted WHOLE — the referee, the metronome, the six pickers, the
// grid and the layer of pieces above it — against the emitted markup and the
// emitted handlers, with the board's clock in the test's hand.
//
// perft answers whether the rules are right; this answers whether the app is
// them. Every assertion below names a row, or an attribute the interpreter
// bound from one.
import { assert, mountApp, type Mounted, only } from "../../../plugins/omnishell/test/screen-harness.ts";

const APP = new URL("../", import.meta.url);
const SEED = 20260904;
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** The terminal draws once per process, so a test that lets the referee mint
 * its own game gets whichever colour the draw is up to. Every test below the
 * first therefore sits down at a stated board. */
const seated = (over: Record<string, string> = {}) => ({
  id: "g1",
  mode: "hotseat",
  bot: "otto",
  level: "3",
  bot_name: "Otto",
  bot_line: "Steady. Punishes a loose piece.",
  set: "print",
  tc: "unlimited",
  side: "white",
  fen: START,
  turn: "white",
  ply: "0",
  status: "playing",
  result: "",
  won: "",
  termination: "",
  check: "no",
  selected: "",
  flipped: "no",
  dragged: "no",
  last_from: "",
  last_to: "",
  current: "yes",
  ordinal: "0001",
  white_clock: "PT0S",
  black_clock: "PT0S",
  last_tick: "0",
  cursor: "start",
  step: "",
  caret: "e1",
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
  seat_top_name: "Black",
  seat_top_line: "at this board",
  seat_top_ini: "B",
  seat_top_clock: "PT0S",
  seat_top_taken: "",
  seat_top_edge: "",
  seat_top_turn: "no",
  seat_top_low: "no",
  seat_low_name: "White",
  seat_low_line: "White · unlimited",
  seat_low_ini: "W",
  seat_low_clock: "PT0S",
  seat_low_taken: "",
  seat_low_edge: "",
  seat_low_turn: "yes",
  seat_low_low: "no",
  seat_top_elo: "",
  seat_low_elo: "",
  ...over,
});

/** The engine's seat, on this test's timeline. deno has no classic worker at
 * all, and a real one would answer off `__prontoClock` where quiet()'s
 * two-calm-turns rule cannot fence it — so the thread is a stand-in that says
 * only what a test tells it to. */
const seats: FakeWorker[] = [];
class FakeWorker {
  props: Record<string, string>[] = [];
  listeners: ((e: { data: unknown }) => void)[] = [];
  terminated = 0;
  constructor(readonly url: string) {
    seats.push(this);
  }
  postMessage(data: { type: string; props: Record<string, string> }) {
    if (data.type === "pronto:props") this.props.push(data.props);
  }
  addEventListener(type: string, fn: (e: { data: unknown }) => void) {
    if (type === "message") this.listeners.push(fn);
  }
  terminate() {
    this.terminated += 1;
  }
  /** What the unit says, delivered the way the port would. */
  says(data: unknown) {
    for (const fn of this.listeners) fn({ data });
  }
}
// deno-lint-ignore no-explicit-any
(globalThis as any).Worker = FakeWorker;

const board = (game: Record<string, string>[] = [seated()]) =>
  mountApp({
    appDir: APP,
    screen: "board",
    seed: SEED,
    tables: { game, move: [], square: [], legal: [], piece: [], setup: [] },
  });

// A clock column is a duration, `PT299.8S`; the assertions below count beats.
const ms = (d: string) => Math.round(Number(d.slice(2, -1)) * 1000);
const game = (m: Mounted) => only(m.rows("game").filter((r) => r.current === "yes"), "the game on the board");
const cell = (m: Mounted, at: string) => m.one(`.board [data-id="${at}"]`);
const marked = (m: Mounted, attr: string) =>
  m.all(`.board [data-${attr}="yes"]`).map((el) => el.getAttribute("data-id") ?? "");
/** The moves on offer now — the table keeps the ones it offered at earlier
 * plies, because a reduce writes and patches and cannot delete. */
const offered = (m: Mounted) => m.rows("legal").filter((r) => r.ply === String(game(m).ply));
const standing = (m: Mounted) => m.rows("piece").filter((r) => r.taken !== "yes");
const pieceOn = (m: Mounted, at: string) => standing(m).find((r) => r.square === at);
/** This board never settles, and that is correct: the metronome's `after` is
 * re-armed on every self-target, so a wait is always queued. `settle()` drives
 * the clock until nothing is waiting, which here is never — so the suite
 * quiets the promises instead and moves the clock itself, deliberately. */
const rest = (m: Mounted) => m.quiet();
/** Teardown. `stop()` detaches the screen and then settles the clock queue,
 * and this board's clock queue is never empty — the metronome re-arms on every
 * self-target — so the settle is expected to time out and is not a failure. */
const done = async (m: Mounted) => {
  try {
    await m.stop();
  } catch (err) {
    if (!String(err).includes("never stopped")) throw err;
  }
};
/** Long enough for the beat the referee asks for before the house answers. */
const beat = async (m: Mounted) => {
  m.advance(600);
  await m.quiet();
};
/** One tick of the metronome, which is the only way time passes here. */
const beats = async (m: Mounted, n: number) => {
  for (let i = 0; i < n; i += 1) {
    m.advance(1000);
    await m.quiet();
  }
};

Deno.test({
  name: "the board opens one game, sets sixty-four cells and thirty-two pieces",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board([]);
    await rest(m);
    assert(m.rows("game").length === 1, `${m.rows("game").length} games on the board`);
    const mints = m.store.calls.filter((c) => c.op === "put" && c.table === "game");
    assert(mints.length === 1, `the game was minted ${mints.length} times`);
    assert(m.rows("square").length === 64, `${m.rows("square").length} cells`);
    assert(standing(m).length === 32, `${standing(m).length} pieces on the board`);
    assert(m.all(".board .sq").length === 64, `${m.all(".board .sq").length} cells drawn`);
    assert(m.all(".pieces .pc").length === 32, `${m.all(".pieces .pc").length} pieces drawn`);
    // In reading order, and the whole strip of it: the store orders text, so
    // an unpadded ord came out with c7 third because "10" sorts before "2".
    const order = m.all(".board .sq").map((el) => el.getAttribute("data-id") ?? "");
    assert(order.slice(0, 8).join(" ") === "a8 b8 c8 d8 e8 f8 g8 h8", order.slice(0, 8).join(" "));
    assert(order[63] === "h1", `the board ends on ${order[63]}`);
    // Twenty moves from the start, which is perft(1) arriving as rows.
    assert(offered(m).length === 20, `${offered(m).length} legal moves offered`);
    // Six pickers and the metronome, all machines over a row.
    assert(m.all("[data-machine]").length === 7, `${m.all("[data-machine]").length} machines`);
    await done(m);
  },
});

Deno.test({
  name: "the board settles: woken on a position it has drawn, the referee writes nothing",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board();
    await rest(m);
    const before = m.store.calls.length;
    await m.store.put("square", { ...m.rows("square").find((r) => r.id === "e4") });
    await rest(m);
    const writes = m.store.calls.slice(before).filter((c) => c.op === "put" || c.op === "update");
    assert(writes.length === 1, `the wake caused ${writes.length} writes, not just the one that woke it`);
    await done(m);
  },
});

Deno.test({
  name: "picking a piece up marks it and exactly the squares it may reach",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board();
    await rest(m);
    m.fire(cell(m, "g1"));
    await rest(m);
    assert(game(m).selected === "g1", `selected is ${JSON.stringify(game(m).selected)}`);
    assert(marked(m, "selected").join() === "g1", marked(m, "selected").join());
    assert(marked(m, "target").sort().join() === "f3,h3", marked(m, "target").sort().join());
    // A king with nowhere to go offers nothing: the set is the rules, not the
    // geometry.
    m.fire(cell(m, "e1"));
    await rest(m);
    assert(marked(m, "target").length === 0, `${marked(m, "target").length} squares offered`);
    // And a stray tap puts it back down.
    m.fire(cell(m, "h6"));
    await rest(m);
    assert(game(m).selected === "", `still holding ${game(m).selected}`);
    await done(m);
  },
});

Deno.test({
  name: "a tap plays the move, and it moves ONE piece row without changing its id",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board();
    await rest(m);
    const pawn = pieceOn(m, "e2");
    assert(pawn !== undefined, "no pawn on e2");
    m.fire(cell(m, "e2"));
    await rest(m);
    m.fire(cell(m, "e4"));
    await rest(m);
    const played = m.rows("move");
    assert(played.length === 1, `${played.length} moves on the sheet`);
    assert(played[0].san === "e4", `the move is written ${played[0].san}`);
    assert(game(m).turn === "black", `it is ${game(m).turn}'s move`);
    assert(marked(m, "last").sort().join() === "e2,e4", marked(m, "last").sort().join());
    // The row that stood on the origin is the row that stands on the
    // destination: that is what lets the terminal keep the node and transition
    // its transform instead of destroying and creating one.
    assert(pieceOn(m, "e2") === undefined, "the pawn is still on e2");
    const moved = pieceOn(m, "e4");
    assert(moved !== undefined && moved.id === pawn!.id,
      `e4 holds ${moved?.id ?? "nothing"}, not the row that left e2 (${pawn!.id})`);
    assert(standing(m).length === 32, `${standing(m).length} pieces after a quiet move`);
    assert(offered(m).length === 20, `${offered(m).length} replies offered`);
    await done(m);
  },
});

Deno.test({
  name: "a drag plays the move a tap would have played",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board();
    await rest(m);
    m.fire(cell(m, "d2"), "dragstart");
    m.fire(cell(m, "d4"), "drop");
    await rest(m);
    const played = m.rows("move");
    assert(played.length === 1, `the drag played ${played.length} moves`);
    assert(played[0].san === "d4", `the drag played ${played[0].san}`);
    await done(m);
  },
});

Deno.test({
  name: "a capture takes one piece row off the board and leaves it marked",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // A pawn on e5 with a black knight on d4 to take.
    const m = await board([seated({ fen: "4k3/8/3n4/4P3/8/8/8/4K3 w - - 0 1" })]);
    await rest(m);
    assert(standing(m).length === 4, `${standing(m).length} pieces to start`);
    const knight = pieceOn(m, "d6");
    m.fire(cell(m, "e5"));
    await rest(m);
    m.fire(cell(m, "d6"));
    await rest(m);
    assert(m.rows("move")[0].san === "exd6", `the capture is written ${m.rows("move")[0].san}`);
    assert(standing(m).length === 3, `${standing(m).length} pieces after a capture`);
    const gone = m.rows("piece").find((r) => r.id === knight!.id);
    assert(gone?.taken === "yes", "the taken knight was removed rather than marked");
    assert(game(m).taken_white.length > 0, "white is not shown as having taken anything");
    await done(m);
  },
});

Deno.test({
  name: "the clock runs only once both sides have moved, and the increment lands after a move",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board([seated({ tc: "3+2", white_clock: "PT180S", black_clock: "PT180S" })]);
    await rest(m);
    // Before the second move nothing counts, however long the metronome runs.
    await beats(m, 4);
    assert(game(m).white_clock === "PT180S", `white lost ${180000 - ms(game(m).white_clock)}ms before the clock started`);
    m.fire(cell(m, "e2"));
    await rest(m);
    m.fire(cell(m, "e4"));
    await rest(m);
    m.fire(cell(m, "e7"));
    await rest(m);
    m.fire(cell(m, "e5"));
    await rest(m);
    const white = ms(game(m).white_clock);
    await beats(m, 5);
    assert(ms(game(m).white_clock) === white - 5000,
      `white spent ${white - ms(game(m).white_clock)}ms over five beats`);
    assert(ms(game(m).black_clock) === ms(m.rows("move")[1].black_clock),
      "the side not to move lost time");
    await done(m);
  },
});

Deno.test({
  name: "a clock at zero ends the game, and against a bare king it is a draw",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Black has a queen, so a flag is a loss.
    const m = await board([seated({ tc: "1+0", white_clock: "PT2S", black_clock: "PT60S", ply: "4",
      fen: "4k3/6q1/8/8/8/8/8/4K3 w - - 0 3" })]);
    await rest(m);
    await beats(m, 3);
    assert(game(m).termination === "flag", `the game ended by ${game(m).termination}`);
    assert(game(m).result === "0-1", `the flag gave ${game(m).result}`);

    // The same flag with nothing left to mate with is a draw.
    const n = await board([seated({ tc: "1+0", white_clock: "PT2S", black_clock: "PT60S", ply: "4",
      fen: "4k3/8/8/8/8/8/8/3QK3 w - - 0 3" })]);
    await rest(n);
    await beats(n, 3);
    assert(game(n).termination === "flag", `the second game ended by ${game(n).termination}`);
    assert(game(n).result === "1/2-1/2", `a flag against a bare king gave ${game(n).result}`);
    await done(m);
    await done(n);
  },
});

Deno.test({
  name: "a pawn on the last rank is asked what it becomes, and the answer is the move played",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board([seated({ fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1" })]);
    await rest(m);
    m.fire(cell(m, "a7"));
    await rest(m);
    m.fire(cell(m, "a8"));
    await rest(m);
    // The gesture named four moves, so the board asks rather than assuming.
    assert(game(m).promo_to === "a8", `the board did not ask; promo_to is ${JSON.stringify(game(m).promo_to)}`);
    assert(m.rows("move").length === 0, "a move was played before the question was answered");
    m.fire("#promo-N");
    await rest(m);
    assert(m.rows("move")[0]?.san === "a8=N", `the answer played ${m.rows("move")[0]?.san}`);
    assert(game(m).promo_to === "", "the question is still standing");
    await done(m);
  },
});

Deno.test({
  name: "stepping back through the sheet shows an old position and offers nothing",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board();
    await rest(m);
    for (const [from, to] of [["e2", "e4"], ["e7", "e5"], ["g1", "f3"]]) {
      m.fire(cell(m, from));
      await rest(m);
      m.fire(cell(m, to));
      await rest(m);
    }
    assert(m.rows("move").length === 3, `${m.rows("move").length} moves played`);
    const live = game(m).fen;
    m.fire("#nav-back", "submit");
    await rest(m);
    m.fire("#nav-back", "submit");
    await rest(m);
    // The board shows the older position; the game has not moved.
    assert(game(m).fen === live, "stepping back moved the game");
    assert(pieceOn(m, "f3") === undefined, "the knight is still on f3 in the reviewed position");
    assert(marked(m, "target").length === 0, "a target was drawn on an old position");
    // Nothing can be picked up either: the referee refuses the gesture because
    // the board is not live.
    m.fire(cell(m, "e2"));
    await rest(m);
    assert(game(m).selected === "", "a piece was picked up on an old position");
    m.fire("#nav-live", "submit");
    await rest(m);
    assert(pieceOn(m, "f3") !== undefined, "returning to the game did not restore the position");
    // Three half-moves in, it is black's turn: the board offers black's moves
    // and nothing else, which is the same rule that made review offer none.
    m.fire(cell(m, "b8"));
    await rest(m);
    assert(marked(m, "target").length > 0, "no moves offered after returning to the game");
    await done(m);
  },
});

Deno.test({
  name: "taking back retracts both half-moves and keeps them on the record",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board([seated({ mode: "house", side: "white" })]);
    await rest(m);
    m.fire(cell(m, "e2"));
    await rest(m);
    m.fire(cell(m, "e4"));
    await rest(m);
    await beat(m);
    assert(m.rows("move").length === 2, `${m.rows("move").length} moves before the takeback`);
    m.fire("#btn-takeback");
    await rest(m);
    assert(game(m).ply === "0", `the board is at ply ${game(m).ply}`);
    assert(game(m).fen === START, "the position was not restored");
    // Marked, not removed: a sheet that can be silently rewritten is not a
    // record.
    assert(m.rows("move").length === 2, `${m.rows("move").length} rows survive the takeback`);
    assert(m.rows("move").every((r) => r.retracted === "yes"), "a taken-back move is not marked");
    const onSheet = m.all(".moves li").filter((el) => !el.classList.contains("empty"));
    assert(onSheet.length === 0, `${onSheet.length} moves still on the sheet`);
    await done(m);
  },
});

Deno.test({
  name: "the house answers, and a stronger level finds a mate a weaker one misses",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board([seated({ mode: "house", side: "white" })]);
    await rest(m);
    m.fire(cell(m, "e2"));
    await rest(m);
    m.fire(cell(m, "e4"));
    await rest(m);
    await beat(m);
    const played = m.rows("move").sort((a, b) => Number(a.ply) - Number(b.ply));
    assert(played.length === 2, `the house played ${played.length - 1} answers, not one`);
    assert(played[1].color === "black", `the house answered as ${played[1].color}`);
    await done(m);

    // A mate in one is found at every level; what separates them is depth, and
    // the strongest takes the queen's mate here.
    const mate = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1";
    const strong = await board([seated({ mode: "house", side: "black", bot: "magnus", level: "5", fen: mate, ply: "6" })]);
    await rest(strong);
    await beat(strong);
    const answer = strong.rows("move")[0];
    assert(answer !== undefined, "the strongest level did not move");
    assert(answer.san === "Ra8#", `the strongest level played ${answer.san}, not the mate`);
    await done(strong);
  },
});

Deno.test({
  name: "the opening is named as soon as the moves name one",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board();
    await rest(m);
    for (const [from, to] of [["e2", "e4"], ["e7", "e5"], ["g1", "f3"], ["b8", "c6"], ["f1", "b5"]]) {
      m.fire(cell(m, from));
      await rest(m);
      m.fire(cell(m, to));
      await rest(m);
    }
    assert(game(m).eco === "C60", `the opening is ${game(m).eco} ${game(m).opening}`);
    assert(game(m).opening === "Ruy López", `the opening is named ${game(m).opening}`);
    await done(m);
  },
});

Deno.test({
  name: "turning the board round reverses the reading order and moves both coordinate strips",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board();
    await rest(m);
    const first = () => m.all(".board .sq")[0].getAttribute("data-id");
    assert(first() === "a8", `the board opens reading from ${first()}`);
    assert(m.one('.board [data-id="a1"] .cr').textContent === "1", "a1 does not carry its rank");
    const rook = pieceOn(m, "a1");
    await m.store.update("game", game(m).id, { flipped: "yes" });
    await rest(m);
    assert(first() === "h1", `turned round, the board reads from ${first()}`);
    assert(m.one('.board [data-id="h8"] .cr').textContent === "8", "h8 does not carry its rank once turned");
    // The piece is on the same square and in a different place on the board.
    const same = pieceOn(m, "a1");
    assert(same?.id === rook?.id, "the rook changed identity when the board turned");
    assert(same?.file === "7" && same?.rank === "0", `the rook is drawn at ${same?.file},${same?.rank}`);
    await done(m);
  },
});

Deno.test({
  name: "resigning ends the game, and asking for another keeps the one before it",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board();
    await rest(m);
    m.fire(cell(m, "e2"));
    await rest(m);
    m.fire(cell(m, "e4"));
    await rest(m);
    const fen = game(m).fen;
    m.fire("#btn-resign");
    await rest(m);
    assert(game(m).status === "over", `the game is ${game(m).status}`);
    assert(game(m).termination === "resignation", `it ended by ${game(m).termination}`);
    assert(game(m).fen === fen, "resigning moved the pieces");
    // Several boards stand at once: another game takes the board, and this one
    // is still there to go back to.
    m.fire("#btn-start");
    await rest(m);
    assert(m.rows("game").length === 2, `${m.rows("game").length} games kept`);
    assert(m.rows("game").filter((r) => r.current === "yes").length === 1, "two boards say they are current");
    assert(game(m).ply === "0", `the new board opens at ply ${game(m).ply}`);
    // On the terms the setup card shows, which nothing here changed: the
    // guest keeps White, and nothing alternates behind the card's back.
    assert(game(m).side === "white", `the new board gave the guest ${game(m).side}, not the card's White`);
    await done(m);
  },
});

Deno.test({
  name: "past the tenth move the sheet is still in order",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board();
    await rest(m);
    // Eleven half-moves: nine is the last ply whose text sorts where its
    // number does, so a sheet ordered on a stringified `ply` reads 1, 10, 11,
    // 2 from here on. Pawns, so the walk reaches ply eleven without repeating
    // a position into a draw.
    const walk = [
      ["a2", "a3"], ["a7", "a6"], ["b2", "b3"], ["b7", "b6"],
      ["c2", "c3"], ["c7", "c6"], ["d2", "d3"], ["d7", "d6"],
      ["e2", "e3"], ["e7", "e6"], ["f2", "f3"],
    ];
    for (const [from, to] of walk) {
      m.fire(cell(m, from));
      await rest(m);
      m.fire(cell(m, to));
      await rest(m);
    }
    assert(m.rows("move").length === 11, `${m.rows("move").length} moves played`);
    const drawn = m.all(".moves .san").map((el) => el.textContent ?? "");
    const want = ["a3", "a6", "b3", "b6", "c3", "c6", "d3", "d6", "e3", "e6", "f3"];
    assert(drawn.join(" ") === want.join(" "), `the sheet reads ${drawn.join(" ")}`);
    await done(m);
  },
});

Deno.test({
  name: "the board is one tab stop, and the six keys walk the caret as it is drawn",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board();
    await rest(m);
    // Sixty-four squares, one of them in the tab order.
    const stops = m.all(".board .sq").filter((el) => el.getAttribute("tabindex") === "0");
    assert(stops.length === 1, `${stops.length} squares are in the tab order`);
    assert(stops[0].getAttribute("data-id") === "e1", `the caret opened on ${stops[0].getAttribute("data-id")}`);
    // Up the board is up the RANKS while white is at the foot.
    const walk = async (step: string) => {
      await m.store.update("game", game(m).id, { caret_go: step });
      await rest(m);
      return game(m).caret;
    };
    assert(await walk("up") === "e2", `up went to ${game(m).caret}`);
    assert(await walk("right") === "f2", `right went to ${game(m).caret}`);
    assert(await walk("row-end") === "h2", `End went to ${game(m).caret}`);
    // The edge holds it: a caret that wrapped would leave the file it was on.
    assert(await walk("right") === "h2", `right off the edge went to ${game(m).caret}`);
    assert(await walk("row-start") === "a2", `Home went to ${game(m).caret}`);
    // Reading order starts at a8 and ends at h1, so those are the board's
    // two ends however the ranks are numbered.
    assert(await walk("last") === "h1", `Ctrl+End went to ${game(m).caret}`);
    assert(await walk("first") === "a8", `Ctrl+Home went to ${game(m).caret}`);
    // The command is consumed, or the caret would walk on every wake.
    assert(game(m).caret_go === "", `the command is still ${JSON.stringify(game(m).caret_go)}`);
    // And the tabstop followed it.
    const now = m.all(".board .sq").filter((el) => el.getAttribute("tabindex") === "0");
    assert(now.length === 1 && now[0].getAttribute("data-id") === "a8",
      `the tabstop is on ${now.map((el) => el.getAttribute("data-id")).join()}`);
    await done(m);
  },
});

Deno.test({
  name: "turned round, the caret still walks the board the reader sees",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board([seated({ flipped: "yes", caret: "e8" })]);
    await rest(m);
    const walk = async (step: string) => {
      await m.store.update("game", game(m).id, { caret_go: step });
      await rest(m);
      return game(m).caret;
    };
    // Black is at the foot, so "up" the screen is DOWN the ranks.
    assert(await walk("up") === "e7", `up went to ${game(m).caret}`);
    // And "right" is towards the a-file, because the files read the other way.
    assert(await walk("right") === "d7", `right went to ${game(m).caret}`);
    assert(await walk("first") === "h1", `Ctrl+Home went to ${game(m).caret}`);
    await done(m);
  },
});

Deno.test({
  name: "every square says what it is, because the board is one stop and arriving on it is blind",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board();
    await rest(m);
    const named = (at: string) => cell(m, at).getAttribute("aria-label");
    assert(named("e1") === "e1, white king", `e1 is called ${named("e1")}`);
    assert(named("d8") === "d8, black queen", `d8 is called ${named("d8")}`);
    assert(named("e4") === "e4, empty", `e4 is called ${named("e4")}`);
    // And it follows the position, not the starting one.
    m.fire(cell(m, "e2"));
    await rest(m);
    m.fire(cell(m, "e4"));
    await rest(m);
    assert(named("e4") === "e4, white pawn", `e4 is called ${named("e4")}`);
    assert(named("e2") === "e2, empty", `e2 is called ${named("e2")}`);
    await done(m);
  },
});

Deno.test({
  name: "an ending names the winner, in the words the reader is in",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Against the house, the guest is "you" and the house has a name.
    const m = await board([seated({ mode: "house", side: "white", bot: "nell", bot_name: "Nell" })]);
    await rest(m);
    m.fire("#btn-resign");
    await rest(m);
    assert(game(m).result === "0-1", `the score is ${game(m).result}`);
    assert(game(m).won === "Nell won", `the board says ${JSON.stringify(game(m).won)}`);
    await done(m);

    // At one board there is no "you", so the colours are the names.
    const h = await board([seated({ mode: "hotseat", side: "white" })]);
    await rest(h);
    h.fire("#btn-resign");
    await rest(h);
    assert(game(h).won === "Black won", `the board says ${JSON.stringify(game(h).won)}`);
    await done(h);

    // And a draw is neither.
    const d = await board([seated({ mode: "house", side: "white", tc: "unlimited" })]);
    await rest(d);
    d.fire("#btn-draw");
    await rest(d);
    assert(game(d).termination === "agreement", `it ended by ${game(d).termination}`);
    assert(game(d).won === "Drawn", `the board says ${JSON.stringify(game(d).won)}`);
    await done(d);
  },
});

Deno.test({
  name: "a dragged piece is already where it was let go; a tapped one travels",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Against the house, so the reply is somebody else's move and not a hand's.
    const m = await board([seated({ mode: "house", side: "white" })]);
    await rest(m);
    m.fire(cell(m, "d2"), "dragstart");
    m.fire(cell(m, "d4"), "drop");
    await rest(m);
    // The board suppresses the figure's transition off this column, so the
    // drop settles where the hand left it instead of replaying from d2.
    assert(game(m).dragged === "yes", `the move says dragged=${game(m).dragged}`);
    assert(m.one(".table").getAttribute("data-dragged") === "yes", "the board did not say so");
    // The house's reply was not carried by a hand, so it travels again.
    await beat(m);
    assert(m.rows("move").length === 2, `${m.rows("move").length} moves after the reply`);
    assert(game(m).dragged === "no", `the reply says dragged=${game(m).dragged}`);
    await done(m);

    const t = await board();
    await rest(t);
    t.fire(cell(t, "e2"));
    await rest(t);
    t.fire(cell(t, "e4"));
    await rest(t);
    assert(game(t).dragged === "no", `a tapped move says dragged=${game(t).dragged}`);
    await done(t);
  },
});

Deno.test({
  name: "a square carries the figure standing on it, for the drag image to find",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board();
    await rest(m);
    const carried = (at: string) => cell(m, at).querySelector(".carried")?.textContent ?? "";
    // The pieces are a layer above the grid and no snapshot of a square
    // reaches them, so the square holds its own copy of the figure.
    assert(carried("e1") !== "", "e1 carries no figure to drag");
    assert(carried("e4") === "", `an empty square carries ${JSON.stringify(carried("e4"))}`);
    // And it follows the position, or a drag would carry the piece that used
    // to stand there.
    m.fire(cell(m, "e2"));
    await rest(m);
    m.fire(cell(m, "e4"));
    await rest(m);
    assert(carried("e4") !== "", "e4 carries no figure after the pawn arrived");
    assert(carried("e2") === "", `e2 still carries ${JSON.stringify(carried("e2"))}`);
    await done(m);
  },
});

Deno.test({
  name: "the promotion choice stands on the square the pawn is waiting on",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // A pawn on the seventh, white at the foot: the choice grows down from
    // the top rank.
    const m = await board([seated({ fen: "7k/1P6/8/8/8/8/8/K7 w - - 0 1", tc: "unlimited" })]);
    await rest(m);
    m.fire(cell(m, "b7"));
    await rest(m);
    m.fire(cell(m, "b8"));
    await rest(m);
    assert(game(m).promo_to === "b8", `the board is asking about ${game(m).promo_to}`);
    assert(game(m).promo_f === "1", `the choice stands on file ${game(m).promo_f}`);
    assert(game(m).promo_r === "0", `the choice stands on rank ${game(m).promo_r}`);
    await done(m);

    // Turn the board round and the same square is at the other end of it, so
    // the strip has to grow the other way or it would leave the board.
    const t = await board([seated({ fen: "7k/1P6/8/8/8/8/8/K7 w - - 0 1", tc: "unlimited", flipped: "yes" })]);
    await rest(t);
    t.fire(cell(t, "b7"));
    await rest(t);
    t.fire(cell(t, "b8"));
    await rest(t);
    assert(game(t).promo_f === "6", `turned round it stands on file ${game(t).promo_f}`);
    assert(game(t).promo_r === "7", `turned round it stands on rank ${game(t).promo_r}`);
    await done(t);
  },
});

Deno.test({
  name: "the last ten seconds are said in colour as well as in tenths",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board([seated({ tc: "5+0", white_clock: "PT8.4S", black_clock: "PT181S", ply: "4" })]);
    await rest(m);
    assert(game(m).seat_low_low === "yes", `the guest's clock says low=${game(m).seat_low_low}`);
    assert(game(m).seat_top_low === "no", `the other clock says low=${game(m).seat_top_low}`);
    assert(m.one(".seat.you").getAttribute("data-low") === "yes", "the seat did not say so");
    await done(m);

    // Without a clock there is nothing to be short of.
    const u = await board([seated({ tc: "unlimited", white_clock: "PT0S", black_clock: "PT0S", ply: "4" })]);
    await rest(u);
    assert(game(u).seat_low_low === "no", `an unlimited game says low=${game(u).seat_low_low}`);
    await done(u);
  },
});

Deno.test({
  name: "the piece layer names its squares, so the one being dragged can let go",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board();
    await rest(m);
    // The rule that hides a dragged piece pairs a square with the figure
    // standing on it, so the figure has to say which square that is.
    const at = (sq: string) => m.all(`.pieces .pc[data-square="${sq}"]`);
    assert(at("e2").length === 1, `${at("e2").length} figures name e2`);
    assert(at("e4").length === 0, `${at("e4").length} figures name the empty e4`);
    m.fire(cell(m, "e2"));
    await rest(m);
    m.fire(cell(m, "e4"));
    await rest(m);
    assert(at("e4").length === 1, "the figure did not take its new square's name");
    assert(at("e2").length === 0, "the figure kept the name of the square it left");
    await done(m);
  },
});

Deno.test({
  name: "the square in the air is marked, so the layer can let go of its figure",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await board();
    await rest(m);
    // The drag image is a snapshot and `:-webkit-drag` never matches the
    // element left in the document, so the mark is the only thing that says
    // which square is being carried.
    assert(cell(m, "e2").getAttribute("data-dragging") === null, "e2 is marked before any drag");
    m.fire(cell(m, "e2"), "dragstart");
    assert(cell(m, "e2").getAttribute("data-dragging") === "", "the square in the air is not marked");
    assert(m.all(".board .sq[data-dragging]").length === 1, "more than one square is in the air");
    m.fire(cell(m, "e2"), "dragend");
    assert(cell(m, "e2").getAttribute("data-dragging") === null, "the mark outlived the drag");
    await done(m);
  },
});

Deno.test({
  name: "the engine is asked in columns and answers in an event, and nothing plays for it",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    seats.length = 0;
    // After 1.e4, with Sable across the board. She is engine-seated, so this
    // position moves on only if her unit says so.
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const m = await board([seated({ mode: "house", side: "white", bot: "sable", level: "5", fen, ply: "1", last_from: "e2", last_to: "e4" })]);
    await rest(m);

    // The question is columns on the row, because a unit is fed props off one.
    assert(game(m).ask === fen, `the board asked about ${game(m).ask}`);
    assert(game(m).ask_nodes === "200000", `the budget on the row is ${game(m).ask_nodes}`);
    const seat = only(seats, "the engine's seat");
    // Props are withheld until the unit says it has booted, so a search is
    // never asked of an engine that cannot run it.
    assert(seat.props.length === 0, `${seat.props.length} props before the unit was ready`);
    seat.says({ type: "pronto:ready" });
    await rest(m);
    assert(seat.props.at(-1)?.fen === fen, `the seat was fed ${seat.props.at(-1)?.fen}`);

    // Nothing else answers for her. A search-seated member would have moved
    // within this beat (the test above), and a Move row here would name
    // somebody who did not choose it.
    await beat(m);
    assert(m.rows("move").length === 0, `${m.rows("move").length} moves played with no answer`);

    seat.says({ type: "pronto:event", name: "answer", detail: { game: "g1", fen, ply: "1", uci: "e7e5" } });
    await rest(m);
    const played = only(m.rows("move"), "the move the answer played");
    assert(played.san === "e5", `the answer played ${played.san}`);
    assert(played.color === "black", `the answer played as ${played.color}`);
    // And the question is withdrawn the moment it is answered, so the seat is
    // not asked the same thing twice.
    assert(game(m).ask === "", `the board is still asking about ${game(m).ask}`);
    await done(m);
  },
});

Deno.test({
  name: "a finished game is reviewed through the engine's seat, and the board shows the marks, the note and the arrow",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    seats.length = 0;
    // 1.e4 e5 2.Qh5, and White resigned: two book moves and one to grade.
    const AFTER = [
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
      "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2",
    ];
    const played = [["e4", "e2e4"], ["e5", "e7e5"], ["Qh5", "d1h5"]].map(([san, uci], i) => ({
      id: `g1/${String(i + 1).padStart(3, "0")}`, game_id: "g1", ply: String(i + 1), number: String(Math.floor(i / 2) + 1),
      color: i % 2 === 0 ? "white" : "black", san, uci, fen_after: AFTER[i], capture: "no", check: "no",
      retracted: "no", white_clock: "PT0S", black_clock: "PT0S",
      before: "", second: "", best: "", line: "", after: "", mark: "", tide: "",
    }));
    const m = await mountApp({
      appDir: APP,
      screen: "board",
      seed: SEED,
      tables: {
        game: [seated({
          status: "over", result: "0-1", won: "Black won", termination: "resignation", fen: AFTER[2], ply: "3",
          turn: "black", cursor: "g1/003", last_from: "d1", last_to: "h5",
        })],
        move: played, square: [], legal: [], piece: [], setup: [],
      },
    });
    await rest(m);
    // Nothing is read until it is asked for.
    assert(game(m).ask === "", `a finished game asked about ${game(m).ask} unprompted`);
    m.fire(m.one("#btn-review"));
    await rest(m);
    assert(game(m).review === "reading", `review is ${game(m).review}`);
    const seat = only(seats, "the engine's seat");
    seat.says({ type: "pronto:ready" });
    await rest(m);
    assert(seat.props.at(-1)?.lines === "2", `the seat was asked for ${seat.props.at(-1)?.lines} lines`);

    // The engine's readings, from the side to move: level, then 2.Qh5 gives
    // Black the better of it, and 2.Nf3 was what the house wanted.
    const script: Record<string, Record<string, string>> = {
      "0": { uci: "e2e4", score: "cp 30", second: "cp 20", pv: "e2e4" },
      "1": { uci: "e7e5", score: "cp -30", second: "cp -40", pv: "e7e5" },
      "2": { uci: "g1f3", score: "cp 30", second: "cp 10", pv: "g1f3 b8c6 f1b5" },
      "3": { uci: "b8c6", score: "cp 60", second: "cp 40", pv: "b8c6" },
    };
    for (let n = 0; game(m).ask !== ""; n += 1) {
      const ask = game(m);
      assert(n < 8, `the reading never ended: still asking about ply ${ask.ask_ply}, the moves hold ` +
        JSON.stringify(m.rows("move").map((r) => [r.best, r.after, r.mark])));
      seat.says({ type: "pronto:event", name: "answer", detail: { game: "g1", fen: ask.ask, ply: ask.ask_ply, ...script[ask.ask_ply] } });
      await rest(m);
    }
    assert(game(m).review === "read", `review ended as ${game(m).review}`);
    const marks = m.all(".moves .mk").map((el) => el.textContent ?? "");
    assert(marks.join(" ") === "book book ?!", `the move list prints ${JSON.stringify(marks)}`);
    // On 2.Qh5?!, the move the board is looking at.
    assert(m.one(".note .nh").textContent === "2. Qh5?!", `the note is headed ${m.one(".note .nh").textContent}`);
    assert((m.one(".note .nt").textContent ?? "").includes("Better was 2. Nf3, then 2… Nc6 3. Bb5."), m.one(".note .nt").textContent ?? "");
    const arrow = m.one(".hint .arrow").getAttribute("d");
    assert(arrow === "M6.5 7.5 L5.5 5.5", `the arrow runs ${arrow}`);
    assert(m.one(".table").getAttribute("data-review") === "read", "the board does not say it is reviewed");
    await done(m);
  },
});
