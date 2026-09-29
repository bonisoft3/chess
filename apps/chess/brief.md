---
pronto: alpha
name: chess
business: free, nothing to sell — a board a guest opens and a sheet they can keep
stage: production-shaped single-player slice
team: studio
cluster: mecha
terminal: omnishell
loop: sayt
build: bayt
---

# The Board — chess, with a clock, and the sheet it leaves behind

Open it and a board is set. Pick a time control, pick how strong the house
plays, and play — dragging pieces or tapping them, with a clock running on both
sides. Every game you finish leaves a score sheet you can read back move by
move, in the notation the rest of chess uses.

The whole of it works with the network cut, and nobody signs in.

## Data

- `Game` — one sitting at the board: the position, whose move it is, both
  clocks, the time control and the level, which colour the guest has, what is
  being viewed, and how it ended. It outlives the tab.
- `Setup` — the next game's settings, apart from any game: who plays the other
  side, which opponent, the time control and the guest's colour. A game copies
  them when it starts and never changes them after.
- `Move` — one move of one game, in the notation a score sheet uses, with the
  position it reached and the clock the mover had left. Together they are the
  sheet. A move taken back is marked, never removed. Once the game has been
  reviewed, each move also carries how the house read it: the evaluation, the
  move it preferred, and the mark.
- `Square` — the sixty-four cells the board is drawn from, and what each one is
  doing: what stands on it, whether it is picked, whether it can be moved to,
  whether it was part of the move being looked at.
- `Legal` — every move that may be played from the position now standing, named
  and carrying the position it leads to.
- `Opening` — the named openings, by their first moves, so a game can say what
  it is.
- `Tick` — one row and one number: the clock the board reads. It has no other
  job.

## Screens

Three: the board, the shelf of games played, and one game's sheet. A rail down
the left edge carries the app's mark and the way to each. On a laptop or a
desktop the board screen fits the window: nothing scrolls while a game is on,
and every control stays in view.

### 1. The board

Eight by eight, coordinates down the side and along the bottom, the piece
glyphs in ink. Drag a piece where it goes, or tap it and tap the square — both
gestures make the same move. A picked piece marks every square it may reach: a
dot on an empty square, a ring around a piece it may take. A pawn reaching the
last rank asks which piece it becomes.

Beside the board:

- **Both clocks**, the side to move counting down. Under ten seconds the clock
  says so. A clock reaching zero ends the game unless the other side has too
  little left to mate, and the board says which.
- **What has been taken**, each side's captures set small, with the material
  difference beside whoever is ahead.
- **The opening**, named as soon as the moves name one.
- **The moves so far**, in two columns, each one a place you can go: click a
  move, or use the left and right arrow keys, and the board shows the position
  after it. A button returns to the game.
- **The controls**: a new game, resign, take back a move, offer a draw. New
  game opens a card with the next game's settings — who plays the other side,
  how strong the house plays, the time control and which colour you take — and
  a Start button. It opens at any moment, and nothing on it changes the game on
  the board: a game keeps the terms it started with. Beside the controls, which
  pieces are drawn and which way round the board sits.

When a game ends, the board says how, in a line that stays put, and offers
another — and offers to review the one just played.

**The review.** Asked for, the house reads every position of the game, on
this device and with nothing sent anywhere, and marks each move the way a
chess column annotates a printed game: `??` a blunder, `?` a mistake, `?!` an
inaccuracy, `!` the only move that held, and the book moves left alone. The
marks sit beside the moves in both columns. Beside the board, while the game is
reviewed:

- **How the game went**, as a strip of winning chances from the first move to
  the last, each mark set on it where it happened, and the chances at the move
  being looked at.
- **Each side's accuracy**, and how many of each mark it collected.
- **On the move being looked at**, what it was, what it cost, and what the
  house would have played instead — named in the notation, and drawn on the
  board as an arrow.

The moves are stepped through exactly as when looking back at any game. A game
already reviewed opens reviewed.

### 2. The shelf

Every game played, newest first: the colours, the result, how it ended, the
time control, the opening, and how long the game ran. Opening one goes to its
sheet. A shelf with nothing on it says so, and points at the board.

### 3. The sheet

One game, written out: numbered moves in two columns with the clock beside
each, the result at the foot, and underneath, the two things every other board
in the world can read — the game as PGN and the final position as FEN.

## Behavior

- **Only legal moves exist.** The board offers the moves the position allows
  and no others: a pinned piece is not offered, a king may not step into check,
  and a move that would leave your own king attacked is not on the board to be
  made.
- **Castling.** Offered when the king and the rook have not moved, the squares
  between them are empty, and the king is neither in check nor passing through
  a square that is attacked. Taking a rook on its home square ends that side's
  castling as surely as moving it would.
- **En passant.** A pawn that has just stepped two squares may be taken as if
  it had stepped one, for exactly one move — and not when taking it would leave
  your own king attacked.
- **Promotion is a choice.** A pawn reaching the far rank asks which of the
  four pieces it becomes, and the sheet says which was taken.
- **The clock is the game.** Each side has the time the control gives it, plus
  the increment after every move it makes. The clock only runs once both sides
  have moved, the way it does everywhere else. Time out is a loss, unless the
  other side has too little material to mate, and then it is a draw.
- **The house plays at the level you set.** Four levels, from a house that
  sees one move ahead to one that looks three moves ahead. It answers within
  a beat at every level and it never takes back. Each opponent shows its
  strength as an Elo rating, and the rating is measured — played against an
  engine of known strength — never guessed.
- **A move moves one piece.** Only the piece that moved travels, and the rook
  when castling; nothing else on the board slides.
- **Taking back is allowed, and it is recorded.** Against the house you may
  take a move back; against another person at the same board you may not. A
  move taken back leaves the sheet but stays in the game's record, marked, so
  the sheet is never quietly rewritten.
- **A draw can be offered and can be claimed.** The house accepts a draw when
  it is not better and declines when it is. Repetition and the fifty-move rule
  end the game on their own.
- **How games end.** Checkmate ends it and names the winner. Stalemate,
  three-fold repetition, the fifty-move rule, a board with too little left on
  it to force mate, a flag, an agreed draw, and a resignation each end it, and
  the board says which one.
- **Looking back does not change anything.** Stepping through the moves shows
  old positions; the game stays where it is, the clock keeps running, and
  nothing can be played until you return to it.
- **The notation is the real one.** `Nbd2`, `exd5`, `O-O-O`, `e8=Q+`, `Qxf7#`:
  the piece, the disambiguating file or rank where two pieces could have gone
  there, the capture, the promotion, the check or mate. A game written out here
  reads back into any other board.
- **The board does not think for you.** No evaluation bar, no arrows, no
  suggested move, no engine line while a game is on. The house plays; it does
  not advise. Once the game is over, and only when asked, the review may say
  all of those things.
- **A mark is arithmetic, not an opinion.** Each move loses some of its side's
  winning chances, read from the house's evaluation; the mark is decided by how
  much, by a rule written down once, so the same game always gets the same
  marks.

![[acceptance.md]]

## Out of scope

- Online play, accounts, ratings and tournaments. The seat is the terminal's
  guest and the game is the two people at the board.
- Analysis beyond the review: exploring the house's lines move by move,
  retrying a position, an opening explorer, and brilliancies (`!!`), which no
  single evaluation can decide the same way twice. The review marks a game; it
  does not teach it.
- Importing a game. The sheet can be read; a file cannot yet be given to it.
- Puzzles, studies, and variants.
- Sound.
