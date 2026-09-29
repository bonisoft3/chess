---
preset: press
colors:
  neutral: "#F2EEE4"
  surface: "#FBF9F4"
  surface-muted: "#E3DDCE"
  border: "#CDC5B2"
  primary: "#1A1815"
  secondary: "#6E675B"
  accent: "#1F5B45"
  danger: "#9B2C22"
  attention: "#B4661A"
dark:
  neutral: "#121211"
  surface: "#1B1A18"
  surface-muted: "#33302A"
  border: "#3D3931"
  primary: "#EFEAE0"
  secondary: "#A49B8A"
  accent: "#63BE95"
  danger: "#E0685A"
  attention: "#DFA35A"
---

# The Board — Newsprint

The identity is **Newsprint**: the chess column of a broadsheet, on paper.

Paper rather than white, ink rather than black, and one proof-reader's green
for everything that means "look here". The board's two square tints are
derived from `surface` and `surface-muted`, so the dark twin is a
re-resolution rather than a redraw.

## Why a newspaper and not a chess set

The obvious direction for a chess app is a chess set — carved wood, a
leather-cornered board, a felt base. It is also the wrong one twice over.
It is what every chess app already looks like, so it says nothing; and it
is a picture of an *object*, when what this app actually produces is a
*text*. The thing you keep here is not the board — the board is reset
every game — it is the sheet: a numbered list of moves that reads back
into any other board in the world. That artefact has a native visual
tradition, and it is a printed one.

So the app is a page from the chess column. Paper stock rather than
white. Ink rather than black. The diagram set in the same figures the
column would use, on a board tinted out of the paper itself instead of
imported from a walnut plank. The move list is a column, in two columns,
because that is how it is set.

## Direction

- **Paper, not white.** The ground is a warm stock; the surface a shade
  lighter, so a card lifts off the page without a shadow doing the work.
  Nothing on screen is `#fff`.
- **Ink, not black.** The text colour is a printing ink — dense, slightly
  warm, and the same ink draws the pieces. A piece is a glyph, not an
  image, so it takes the colour of the text and inherits its weight; the
  white pieces are the same glyph outlined, exactly as a column prints
  them.
- **The board is tinted out of the paper.** Light squares are the paper;
  dark squares are the paper with the ink laid over it at a low
  percentage. No green, no walnut, no marble. The board reads as printed
  on the same sheet as everything else, because it is.
- **One accent, and it is a proof-reader's.** A single green marks what
  is live: the square you picked, the moves it may make, the last move
  played. It is the pencil somebody annotated the column with, so it is
  used sparingly and always means "look here".
- **Rules, not boxes.** Sections are separated by hairlines the width of
  a printed rule, not by cards with borders and radii. The one exception
  is the board itself, which is a plate and carries a frame.
- **Figures are figures.** Move numbers, coordinates and results are set
  in the same lining figures throughout, tabular so the two columns of
  the sheet line up down the page.

## Layout

The page is set like a page: nothing on it moves out of reach while a game is
being played.

- **A rail, not a strip.** The app's mark and its two places — Play and Games —
  stand in a narrow ink rail down the left edge, each a figure over its name.
  The rail is the one surface set apart in the app; everything else is paper.
  On a phone it folds into a bar across the top, the same height on every
  screen.
- **The board is the page's picture.** It takes the height the window has left
  after the two player bars and is centred in its column; the players sit on
  its edges — the opponent above, you below — each with a clock that is only
  heavy while it is counting.
- **One panel beside it, the board's height.** The opening or the result at its
  head, the moves in two columns in its middle — the only part of the screen
  that scrolls — and the step buttons and the game's actions pinned at its foot.
  In review the panel carries the accuracy, the strip and the note above the
  moves, and the chances stand as a bar down the left side of the board.
- **The next game is a card, not a control.** New game opens a card above
  itself — who plays the other side, which of the cast, the clock, your colour,
  and Start — framed like a picker's list, a rule and no shadow. It is set on
  its own, so it can open in any state without touching the game on the board;
  the pieces and the board's turn stay beside the game's actions, because they
  are how this game is looked at.
- **On a phone** the panel falls below the board and the page may scroll; the
  board and both players still fit above the fold.

## Motion

A printed page does not animate, so almost nothing here does. What moves,
moves because a piece did:

- A piece arriving on a square fades in over the `fast` token; the square
  it left does nothing at all. Anything more and the board reads as a
  video game.
- The mark on the last move played appears without transition — it is a
  fact about the position, and a fact that fades in reads as uncertain.
- The line the board says (*check*, *checkmate*) arrives on the `base`
  token, from below, once. It never loops.
- Under `prefers-reduced-motion` every one of these collapses to nothing.
  There is no motion here whose absence loses information.

## The review

A game read back by the house speaks in the page's own colours, one meaning
each:

- A mistake (`?`) and a blunder (`??`) take the danger colour, the one alarm
  the board is allowed.
- An inaccuracy (`?!`) takes attention.
- The only move (`!`) borrows the accent, because it is the move to look at.
- A book move carries no mark.
- The chances stand as a bar down the left of the board, White's share on
  White's side; the strip in the panel keeps the same scale move by move, its
  ink edge the line to read.

## The dark twin

The dark palette is not the light one inverted: it is the same column
printed on a different stock. The ground goes to a near-black that still
has warmth in it, the ink becomes the paper colour, and the accent moves
from a printer's green to one that survives on a dark ground. The board's
two square tints are derived the same way in both — the paper, and the
paper with ink over it — so the board never has to be redrawn for
appearance, only re-resolved. The rail is the ink in light; in dark, where
the ground is already near-black, it is the ground lifted by a tenth of the
ink, so it is still the one surface set apart.
