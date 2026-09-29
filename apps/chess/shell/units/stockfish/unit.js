// The engine's seat: pronto on one side of this file, UCI on the other.
//
// This is the half an engineer reads. Beside it sits 7.3 MB of machine code
// nobody does, and everything that makes an answer from it trustworthy lives
// here — the five settings the design fixes, the refusal to hand the engine a
// line this file has not vetted, and the epoch each answer carries so the
// referee can throw away one that arrived about a position the board has left.
//
// The engine runs in a worker of its OWN rather than under importScripts. The
// glue names its .wasm by swapping .js for .wasm on `location.pathname` of the
// worker running it, so under importScripts it would ask for unit.wasm; loaded
// as its own worker script the path is the glue's and the sibling resolves. It
// also takes over `onmessage` and answers on `postMessage`, which on a shared
// port would be this file's own seat.
//
// The seat re-posts props on every bind pass — roughly once a second, identical
// or not. The dedupe below is therefore load-bearing: without it every beat
// would restart the search and none would ever finish.

// The seat's vocabulary, spelled out because a unit imports nothing from the
// terminal — that is what makes it a unit.
const PROPS = "pronto:props";
const READY = "pronto:ready";
const EVENT = "pronto:event";

const ENGINE = "./stockfish-18-lite-single.js";

// What the design fixes (ir decision-22), in the one place that can guarantee
// it rather than promise it. `UCI_LimitStrength` is absent and stays absent:
// Skill::pick_best holds a clock-seeded static PRNG, so the Elo dial is the
// one feature this seat cannot have. A budget in nodes and never in
// milliseconds is the other half — wall time is not a repeatable quantity.
const OPTIONS = ["setoption name Threads value 1", "setoption name Hash value 16"];

// A UCI command is a line, and this file is the only reader between a device
// row and the engine's parser. A FEN that could end the line — or that is not
// a FEN at all — is refused here.
const FEN = /^[1-8pnbrqkPNBRQK/]+ [wb] (-|K?Q?k?q?) (-|[a-h][36]) \d{1,3} \d{1,4}$/;
const NODES = /^[1-9][0-9]{0,7}$/;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const SCORE = /^(cp|mate) -?\d{1,5}$/;

// Built on the first question and not before. The hatch mounts with the screen,
// so a reader who never seats the engine — four of the five opponents, and every
// visit that only looks at the board — would otherwise fetch and instantiate
// 7.3 MB of wasm for nothing. `ready` is the UNIT being ready to be asked, not
// the engine being up — `queued` below is what holds a question until `uciok`,
// so a search still reaches no engine that cannot run it.
let engine = null;
let booted = false;
const send = (line) => engine.postMessage(line);

const boot = () => {
  engine = new Worker(ENGINE);
  engine.addEventListener("message", onEngine);
  send("uci");
};
// The (fen, ply, nodes, lines) the last search was STARTED for, so a re-post of the
// same props is silence rather than a restart.
let asked = "";
// What the engine is answering about now, and what it is to answer about next.
// A prop change mid-search does not interrupt one: the running answer is
// discarded by its own epoch when it lands.
let searching = null;
let queued = null;
// How many lines the engine is set to report, and the last exact score and
// line it reported for each, by line.
let multipv = 1;
let seen = {};

const start = () => {
  if (engine === null) return boot();
  if (!booted) return;
  searching = queued;
  queued = null;
  // Two lines while a finished game is read, so the only move can be told
  // apart; one while the house chooses. Said only when it changes, so the
  // house's question is the three commands below and nothing more.
  if (searching.lines !== multipv) {
    multipv = searching.lines;
    send(`setoption name MultiPV value ${multipv}`);
  }
  seen = {};
  // Every search from a cleared table. It costs real playing strength and buys
  // the only reproducibility this seat can offer.
  send("ucinewgame");
  send(`position fen ${searching.fen}`);
  send(`go nodes ${searching.nodes}`);
};

function onEngine(e) {
  const line = String(e.data ?? "");
  if (!booted && line === "uciok") {
    booted = true;
    for (const option of OPTIONS) send(option);
    if (queued !== null) start();
    return;
  }
  if (line.startsWith("info ")) {
    // Only a reading keeps what the engine thought; a move asked for is its
    // bestmove alone.
    if (searching?.lines !== 2) return;
    const words = line.split(/\s+/);
    const score = words.indexOf("score");
    const pv = words.indexOf("pv");
    const multi = words.indexOf("multipv");
    // A bound is a search still narrowing on a window: only an exact score
    // is a reading of the position.
    if (score < 0 || pv < 0 || words.includes("lowerbound") || words.includes("upperbound")) return;
    const said = `${words[score + 1]} ${words[score + 2]}`;
    if (SCORE.test(said)) seen[multi < 0 ? "1" : words[multi + 1]] = {score: said, pv: words.slice(pv + 1, pv + 5).join(" ")};
    return;
  }
  if (!line.startsWith("bestmove")) return;
  const answered = searching;
  searching = null;
  const uci = line.split(/\s+/)[1] ?? "";
  if (answered !== null && UCI.test(uci)) {
    const detail = {game: answered.game, fen: answered.fen, ply: answered.ply, uci};
    // A reading carries what the engine made of the position as well as what
    // it would play: the two scores and the line, still strings the seat's
    // grammar admits (ir decision-26).
    if (answered.lines === 2) {
      detail.score = seen["1"]?.score ?? "";
      detail.second = seen["2"]?.score ?? "";
      detail.pv = seen["1"]?.pv ?? "";
    }
    self.postMessage({type: EVENT, name: "answer", detail});
  }
  if (queued !== null) start();
}

self.addEventListener("message", (e) => {
  const message = e.data;
  if (message === null || typeof message !== "object" || message.type !== PROPS) return;
  const props = message.props ?? {};
  const fen = String(props.fen ?? "");
  // An empty ask is the board saying it wants nothing: the guest is to move,
  // the game is over, or the opponent is one of the search-seated five. It also
  // closes the question, so the next one is new even where it names the same
  // position at the same ply — which a takeback and a replayed move do. What
  // was waiting behind the running search goes with it, or an abandoned
  // position is searched to completion ahead of the live one.
  if (fen === "") {
    asked = "";
    queued = null;
    return;
  }
  const nodes = String(props.nodes ?? "");
  if (!FEN.test(fen) || !NODES.test(nodes)) return;
  const ply = String(props.ply ?? "");
  const lines = String(props.lines ?? "") === "2" ? 2 : 1;
  const key = `${fen}|${ply}|${nodes}|${lines}`;
  if (key === asked) return;
  asked = key;
  queued = {game: String(props.game ?? ""), fen, ply, nodes, lines};
  if (searching === null) start();
});

// The seat withholds props until this, so it is said at once: the engine is
// built by the first question, not by the mount.
self.postMessage({type: READY});
