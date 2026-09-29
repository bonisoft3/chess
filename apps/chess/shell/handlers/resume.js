// Several boards stand at once, and this is which one you are at. Exactly one
// game is current, so resuming is two writes and not one: the game you asked
// for takes the board, and whatever held it lets go.
(state, event) => {
  const rows = state.rows?.game ?? [];
  const want = String(event.id ?? "");
  if (want === "") return { updates: [] };
  const updates = [];
  for (const g of rows) {
    const should = g.id === want ? "yes" : "no";
    if ((g.current ?? "no") !== should) {
      updates.push({ op: "patch", entity: "game", id: g.id, row: { current: should } });
    }
  }
  return { updates };
};
