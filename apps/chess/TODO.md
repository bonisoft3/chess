# Owed

Debts this app carries, with the evidence that found them. A decision's own
rationale lives in `ir.html`; this is only the list of what is not done.

## Offline is claimed and not delivered

`brief.md` opens with "the whole of it works with the network cut", and
`decision-01` builds the entire data-tier argument on owing the network nothing.
It does not hold at HEAD.

Measured 2026-09-05: every static is served `cache-control: no-cache`, the
7.3 MB engine included, and there is no service worker and no manifest anywhere
in the platform assets. `no-cache` means revalidate before use, so with the
network cut revalidation fails and the app does not load.

The fix is a service worker precaching a declared file list, and it belongs in
the terminal rather than here — every pronto app makes the same claim. Two
routes that look adjacent and are not: `docker/Caddyfile` is emitted verbatim
from a fixed platform asset with no per-app hook (`emit.cue:1152-1155`), so
header-based caching is a change every app pays for; and hashed-filename
cache-busting would need a build step the tree does not have.

## A wedged unit stalls its game

`decision-22` records this as taken rather than solved. An engine-seated member
never falls back to the search, because a `Move` row would then name a member
that did not choose it — a liveness cost chosen over a correctness one. But
nothing times the wait out, so a unit that never answers leaves that board
waiting with "New game" the only way out.

Wants a timeout that ends the wait visibly, and a decision about what the board
says when it fires.

## Nobody knows what a node budget is worth

Sable is seated at `go nodes 200000` and the five search-seated members at one
to four plies, and no measurement stands behind any of it. `UCI_Elo` is
calibrated at 120s+1s against CCRL, which is a claim about time-bounded play and
therefore not transferable to a node budget.

A bench playing each cast member against a reference over an opening book —
they are deterministic, so repetition alone yields one game and proves nothing —
would produce a defensible ladder. It is also the only evidence that says
whether the engine earns its 7.3 MB, since the five that shipped without it may
already be interesting enough.

## Nothing here catches a layout regression

This app declares no visual battery, so the emitted markup is checked by
`check-machines` and the rest by eye. Two of this branch's bugs were invisible
to every suite and found only by looking: the sheet's clock columns dragging the
next move out of its track, and the move list scrambling when "No clock" hid a
cell that auto-flow was counting.

## Unconfirmed: a piece failing to paint after a move

A headless run reported the human's piece not painting until reload. Four
attempts across both colours and both orientations could not reproduce it, and
the evidence points away from the app — computed styles clean, `getAnimations()`
empty, a forced repaint no help, reload fixes it. `.pc` carries
`will-change: transform`, which promotes every piece to its own compositor
layer, and a dropped raster in headless Chromium fits. Wants an eye in a real
browser before anything is changed.
