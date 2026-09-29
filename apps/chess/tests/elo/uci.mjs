// A UCI engine as a child process: the npm stockfish.js build run by node,
// spoken to over stdin/stdout one line at a time.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINES = {
  lite: join(HERE, "node_modules/stockfish/bin/stockfish-18-lite-single.js"),
  full: join(HERE, "node_modules/stockfish/bin/stockfish-18-single.js"),
};

export class Engine {
  constructor(which) {
    this.proc = spawn(process.execPath, [ENGINES[which]], { stdio: ["pipe", "pipe", "inherit"] });
    this.buf = "";
    this.waiters = [];
    this.proc.stdout.on("data", (d) => {
      this.buf += d.toString();
      let i;
      while ((i = this.buf.indexOf("\n")) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        for (const w of this.waiters.slice()) {
          if (w.test(line)) {
            this.waiters.splice(this.waiters.indexOf(w), 1);
            w.resolve(line);
          }
        }
      }
    });
  }
  send(line) { this.proc.stdin.write(`${line}\n`); }
  until(test) { return new Promise((resolve) => this.waiters.push({ test, resolve })); }
  async init(options) {
    const ok = this.until((l) => l === "uciok");
    this.send("uci");
    await ok;
    for (const [k, v] of options) this.send(`setoption name ${k} value ${v}`);
    const ready = this.until((l) => l === "readyok");
    this.send("isready");
    await ready;
    return this;
  }
  async go(fen, goArgs, newgame) {
    if (newgame) this.send("ucinewgame");
    this.send(`position fen ${fen}`);
    const done = this.until((l) => l.startsWith("bestmove"));
    this.send(`go ${goArgs}`);
    return (await done).split(/\s+/)[1];
  }
  quit() { this.send("quit"); setTimeout(() => this.proc.kill(), 500); }
}
