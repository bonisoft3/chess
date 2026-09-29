// Guard: the extracted houseMove must pick exactly the move the app's own
// reduce puts for a house game ({type: "house"} wake), for every search-seated
// bot, over a spread of positions.
import { loadReferee } from "./referee.mjs";
const R = loadReferee();
const FENS = [
  R.START,
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4",
  "r2q1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 9",
  "rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5",
  "8/5pk1/6p1/3R4/8/6P1/5PK1/3r4 w - - 0 40",
];
const game = (fen, bot) => {
  const black = fen.split(" ")[1] === "b";
  return {
    items: [],
    rows: {
      game: [{
        id: "g", mode: "house", bot, level: R.BOTS[bot].level, side: black ? "white" : "black", tc: "unlimited",
        fen, turn: black ? "black" : "white", ply: "0", status: "playing", result: "", termination: "",
        check: "no", selected: "", flipped: "no", last_from: "", last_to: "", current: "yes", ordinal: "0001",
      }],
      move: [], legal: [], square: [], piece: [],
    },
  };
};
let bad = 0, n = 0;
for (const bot of Object.keys(R.BOTS).filter((k) => R.BOTS[k].seat === "search")) {
  for (const fen of FENS) {
    // Settle the derived tables first (mutation wakes until quiet), then wake the house.
    let state = game(fen, bot);
    for (let i = 0; i < 6; i += 1) {
      const out = R.reduce(state, { type: "mutation" });
      if (!out.updates?.length) break;
      for (const u of out.updates) {
        const t = state.rows[u.entity] ?? (state.rows[u.entity] = []);
        const at = t.findIndex((r) => r.id === u.id);
        if (u.op === "put") { if (at >= 0) t[at] = { id: u.id, ...u.row }; else t.push({ id: u.id, ...u.row }); }
        else if (u.op === "patch" && at >= 0) t[at] = { ...t[at], ...u.row };
        else if (u.op === "delete" && at >= 0) t.splice(at, 1);
      }
    }
    const out = R.reduce(state, { type: "house" });
    const put = (out.updates ?? []).find((u) => u.entity === "move" && u.op === "put")?.row;
    const p = R.parseFen(fen);
    const mine = R.uciOf(R.houseMove(p, R.legal(p), R.BOTS[bot].level));
    const theirs = put === undefined ? "(none)" : put.uci;
    n += 1;
    if (put === undefined || mine !== theirs) { bad += 1; console.log("MISMATCH", bot, fen, mine, theirs); }
  }
}
console.log(`crosscheck: ${n - bad}/${n} agree`);
process.exit(bad === 0 ? 0 : 1);
