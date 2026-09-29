// The row exists: a picker slot binds a fallback row (id "") before the
// referee writes the game or the setup row, and a machine write on it would
// mint a junk one.
(state, event) => (state.items[0]?.id ?? "") !== "";
