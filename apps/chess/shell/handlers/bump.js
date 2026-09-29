// The metronome's one arrow. A machine's assign may name a Jessie module, and
// this is the whole of what it computes: the beat after this one.
//
// It is the only place in the app that knows time passed, and it does not know
// how much — the referee reads the difference between two readings, so a beat
// the tab slept through costs the reader nothing.
(state, event) => Number(state.items[0]?.n ?? 0) + 1;
