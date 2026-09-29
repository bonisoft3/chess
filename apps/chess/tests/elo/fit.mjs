// `node fit.mjs` rates games.jsonl (rate.mjs) and writes ../elo.json, printing
// a table. The rules test re-rates the same games and holds elo.json to it.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BOTS, rate } from "./rate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const games = readFileSync(join(HERE, "games.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const out = rate(games);
writeFileSync(join(HERE, "..", "elo.json"), `${JSON.stringify(out, null, 2)}\n`);
console.log(`games ${games.length}`, out.terminations);
for (const p of BOTS.filter((q) => q in out.ratings)) {
  const { elo, se, shown } = out.ratings[p];
  const t = out.record[p].total;
  console.log(`${p.padEnd(7)} ${String(elo).padStart(5)} ± ${String(se).padStart(3)}  shown ${shown.padEnd(6)} ${t.score}/${t.n} (+${t.w} =${t.d} -${t.l})   perf ${JSON.stringify(out.record[p].performance_vs_anchor)}`);
  console.log("        ", out.record[p].vs.map((r) => `${r.vs} ${r.score}/${r.n}`).join(", "));
}
