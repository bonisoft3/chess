// Match runner. After `npm install` here, `node run.mjs [workers]` plays every
// job not already in games.jsonl across forked workers, appending one JSON line
// per finished game, so it resumes after an interruption; `node fit.mjs` then
// writes ../elo.json. Delete games.jsonl to re-measure a changed cast.
//
// Players
//   nell/otto/vera/magnus      the referee's own houseMove at the app's LEVEL,
//                              called through the unmodified referee source.
//   sable                      Stockfish 18 lite single (the byte-identical
//                              build the app vendors), Threads 1, Hash 16,
//                              MultiPV 1, `ucinewgame` + `position fen` +
//                              `go nodes 200000` before EVERY move — no history,
//                              no hash carried, exactly as unit.js asks.
//   sfNNNN                     anchor: Stockfish 18 full single, Threads 1,
//                              Hash 16, UCI_LimitStrength true, UCI_Elo NNNN,
//                              `ucinewgame` once per game, `position startpos
//                              moves ...` (full history), `go movetime 500`.
//
// Endings: the referee's own rules in the reduce's order — no legal move
// (checkmate / stalemate), dead(board) (insufficient), half-move clock >= 100
// (fifty-move), a position key (first four FEN fields, via the referee's
// toFen) seen three times since the start position (threefold) — plus a
// 200-ply cap counted from the start position, adjudicated a draw.
import { fork } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BOTS } from "./rate.mjs";
import { loadReferee } from "./referee.mjs";
import { Engine } from "./uci.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "games.jsonl");
const ANCHOR_MOVETIME = 500;
const SABLE_NODES = 200000;
const CAP = 200;

const OPENINGS = {
  italian: "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5",
  ruy_lopez: "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6",
  qgd: "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6",
  sicilian_najdorf_start: "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6",
  french: "e2e4 e7e6 d2d4 d7d5 b1c3 g8f6",
  caro_kann: "e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5",
  kings_indian: "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6",
  english: "c2c4 e7e5 b1c3 g8f6 g1f3 b8c6",
  slav: "d2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4",
  nimzo_indian: "d2d4 g8f6 c2c4 e7e6 b1c3 f8b4",
  scandinavian: "e2e4 d7d5 e4d5 d8d5 b1c3 d5a5",
  london: "d2d4 d7d5 c1f4 g8f6 e2e3 e7e6 g1f3 c7c5",
};

// Anchor games per bot, chosen so each bot meets the anchors it can score
// against (probed by the round robin's shape: search bots near the bottom of
// the scale, sable near the top).
const ANCHOR_PAIRS = [
  ["nell", 1320], ["otto", 1320], ["vera", 1320], ["vera", 1800],
  ["magnus", 1320], ["magnus", 1800], ["sable", 2400], ["sable", 2800],
];
// Rough cost weight so the heaviest games are dealt first.
const COST = { magnus: 20, sable: 3, vera: 2, otto: 1, nell: 1 };

const jobs = () => {
  const out = [];
  const pair = (a, b, stage) => {
    for (const op of Object.keys(OPENINGS)) {
      out.push({ id: `${a}|${b}|${op}`, white: a, black: b, opening: op, stage });
      out.push({ id: `${b}|${a}|${op}`, white: b, black: a, opening: op, stage });
    }
  };
  for (let i = 0; i < BOTS.length; i += 1) {
    for (let j = i + 1; j < BOTS.length; j += 1) pair(BOTS[i], BOTS[j], "round-robin");
  }
  for (const [bot, elo] of ANCHOR_PAIRS) pair(bot, `sf${elo}`, "anchor");
  const cost = (j) => (COST[j.white] ?? 5) + (COST[j.black] ?? 5);
  return out.sort((x, y) => cost(y) - cost(x));
};

/* ---- worker --------------------------------------------------------------- */

const worker = async () => {
  const R = loadReferee();
  let lite = null;
  let full = null;
  let fullElo = null;
  const sableMove = async (fen) => {
    if (lite === null) lite = await new Engine("lite").init([["Threads", 1], ["Hash", 16]]);
    return lite.go(fen, `nodes ${SABLE_NODES}`, true);
  };
  const anchorMove = async (elo, history, first) => {
    if (full === null) full = await new Engine("full").init([["Threads", 1], ["Hash", 16], ["UCI_LimitStrength", "true"]]);
    if (fullElo !== elo) { full.send(`setoption name UCI_Elo value ${elo}`); fullElo = elo; }
    if (first) full.send("ucinewgame");
    full.send(`position startpos moves ${history.join(" ")}`);
    const done = full.until((l) => l.startsWith("bestmove"));
    full.send(`go movetime ${ANCHOR_MOVETIME}`);
    return (await done).split(/\s+/)[1];
  };
  const choose = async (who, p, history, first) => {
    const moves = R.legal(p);
    if (R.BOTS[who]?.seat === "search") return R.uciOf(R.houseMove(p, moves, R.BOTS[who].level));
    if (who === "sable") return sableMove(R.toFen(p));
    if (who.startsWith("sf")) return anchorMove(Number(who.slice(2)), history, first);
    throw new Error(`unknown player ${who}`);
  };
  const play = async (job) => {
    const key = (p) => R.toFen(p).split(" ").slice(0, 4).join(" ");
    let p = R.parseFen(R.START);
    const seen = { [key(p)]: 1 };
    const history = [];
    const apply = (uci) => {
      const m = R.legal(p).find((x) => R.uciOf(x) === uci);
      if (m === undefined) throw new Error(`${job.id}: illegal ${uci} at ${R.toFen(p)}`);
      p = R.make(p, m);
      history.push(uci);
      seen[key(p)] = (seen[key(p)] ?? 0) + 1;
    };
    for (const uci of OPENINGS[job.opening].split(" ")) apply(uci);
    const firstMoveOf = { white: true, black: true };
    for (;;) {
      const moves = R.legal(p);
      if (moves.length === 0) {
        if (R.inCheck(p)) return { result: p.w ? 0 : 1, termination: "checkmate" };
        return { result: 0.5, termination: "stalemate" };
      }
      if (R.dead(p.b)) return { result: 0.5, termination: "insufficient" };
      if (p.half >= 100) return { result: 0.5, termination: "fifty-move" };
      if (Object.values(seen).some((n) => n >= 3)) return { result: 0.5, termination: "threefold" };
      if (history.length >= CAP) return { result: 0.5, termination: "ply-cap" };
      const side = p.w ? "white" : "black";
      const who = job[side];
      const uci = await choose(who, p, history, firstMoveOf[side]);
      firstMoveOf[side] = false;
      apply(uci);
    }
  };
  process.on("message", async (job) => {
    if (job === "quit") { lite?.quit(); full?.quit(); setTimeout(() => process.exit(0), 700); return; }
    const t0 = Date.now();
    const ended = await play(job);
    process.send({ ...job, ...ended, ms: Date.now() - t0 });
  });
  process.send("ready");
};

/* ---- parent --------------------------------------------------------------- */

const parent = async (n) => {
  const done = new Set(existsSync(OUT) ? readFileSync(OUT, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l).id) : []);
  const queue = jobs().filter((j) => !done.has(j.id));
  const total = queue.length;
  console.log(`jobs: ${total} to play (${done.size} already done), ${n} workers`);
  let finished = 0;
  const started = Date.now();
  await Promise.all(Array.from({ length: n }, () => new Promise((resolve) => {
    const w = fork(fileURLToPath(import.meta.url), ["--worker"]);
    const next = () => {
      const job = queue.shift();
      if (job === undefined) { w.send("quit"); resolve(); return; }
      w.send(job);
    };
    w.on("message", (msg) => {
      if (msg === "ready") return next();
      appendFileSync(OUT, `${JSON.stringify(msg)}\n`);
      finished += 1;
      const el = ((Date.now() - started) / 1000).toFixed(0);
      console.log(`[${finished}/${total} ${el}s] ${msg.white} - ${msg.black} ${msg.opening}: ${msg.result} ${msg.termination} (${(msg.ms / 1000).toFixed(1)}s)`);
      next();
    });
    w.on("exit", (code) => { if (code !== 0) console.error(`worker exited ${code}`); resolve(); });
  })));
  console.log(`all done in ${((Date.now() - started) / 1000).toFixed(0)}s`);
};

if (process.argv.includes("--worker")) worker();
else if (process.argv[1] === fileURLToPath(import.meta.url)) parent(Number(process.argv[2] ?? 7));
