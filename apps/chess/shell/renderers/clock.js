// A clock, read the way a clock is read.
//
// The column is a duration — total seconds, as `PT299.8S` — and a reader
// wants minutes and seconds, and under ten seconds they want tenths — the
// point at which a chess clock stops being information and starts being the
// game. Formatting is a renderer rather than a column because it is a fact
// about how the number is SHOWN, and a second column holding the same number
// spelled differently is a second thing to keep in step.
(value) => {
  const ms = Math.max(0, Math.round((Number(String(value ?? "").slice(2, -1)) || 0) * 1000));
  if (ms === 0) return ["0:00"];
  const total = Math.floor(ms / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  // Under ten seconds the tenth is what a player is actually reading.
  if (ms < 10000) return [`${Math.floor(ms / 1000)}.${Math.floor((ms % 1000) / 100)}`];
  return [`${mins}:${pad(secs)}`];
};
