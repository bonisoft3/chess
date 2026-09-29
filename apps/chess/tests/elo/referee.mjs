// The app's referee, unmodified, with its own top-level functions exposed: the
// source is evaluated with an object naming the bindings appended, so the
// bench's bots play through the very houseMove the app runs.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REFEREE = fileURLToPath(new URL("../../shell/handlers/referee.js", import.meta.url));
const EXPOSE = "({parseFen, toFen, legal, make, inCheck, dead, houseMove, uciOf, LEVEL, BOTS, START})";

export const loadReferee = () => {
  const source = readFileSync(REFEREE, "utf8");
  const api = (0, eval)(`${source}\n;${EXPOSE}`);
  // The whole reduce too, for crosscheck.mjs.
  api.reduce = (0, eval)(source);
  return api;
};
