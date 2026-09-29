// The machine rung of apps/chess: a pronto.#App compiled from ir.html (pinned
// below). Nobody reviews this; it must merely be checkable — cue vet, the ir
// bijection, and the emitted surface are the contract.
//
// Three entities take the `device` path and five take `tab` (ir decision-01), so
// this program emits no migration, no policy, no publication and no pipeline:
// the whole data plane is the terminal's local collections.
@extern(embed)

package chess

import (
	pronto "bonisoft.org/plugins/pronto"
)

_designMd: _ @embed(file="DESIGN.md", type=text)

code: pronto.#App & {
	state: {
		entities: {
			Game: {
				id: "0xa5f5609cc8def322"
				table: "game"
				durability: "device"
				// The board shows one game and `current` is which; the others
				// stand where they were (ir decision-05, ir decision-16).
				uniques: [{name: "uq_game_current", cols: ["current"], where: "current=eq.yes"}]
				fields: [
					{ordinal: 1, name: "id", type: "string", pk: true, cel: "this.size() <= 64"},
					{ordinal: 2, name: "mode", type: "string", cel: "this in ['house', 'hotseat']"},
					{ordinal: 3, name: "bot", type: "string", cel: "this in ['nell', 'otto', 'vera', 'magnus', 'sable']"},
					{ordinal: 4, name: "level", type: "string", cel: "this in ['2', '3', '4', '5']"},
					// Who is across the board, in their own words. A template
					// binds fields, so the cast's two lines ride the row.
					{ordinal: 5, name: "bot_name", type: "string", cel: "this.size() > 0"},
					{ordinal: 6, name: "bot_line", type: "string", cel: "this.size() > 0"},
					{ordinal: 7, name: "set", type: "string", cel: "this in ['print', 'staunton', 'engraved', 'disc']"},
					{ordinal: 8, name: "tc", type: "string", cel: "this in ['unlimited', '1+0', '3+2', '5+0', '10+0']"},
					{ordinal: 9, name: "side", type: "string", cel: "this in ['white', 'black']"},
					// The position now standing, a column per fact of it. The board
					// is sixty-four squares — one character each, a dot where nothing
					// stands — so a square is an index into it and the count is the
					// column's own type. `turn` below is the side to move.
					{ordinal: 10, name: "board", type: "string", cel: "this.size() == 64 && this.matches('^(?:\\.|[PNBRQKpnbrqk]){64}$')"},
					// The rights still standing, as the four letters name them; empty
					// when neither side has any left.
					{ordinal: 11, name: "castling", type: "string", required: false, cel: "this.matches('^K?Q?k?q?$')"},
					// The square a pawn may be taken on in passing — the third rank or
					// the sixth, and nowhere else — or empty.
					{ordinal: 12, name: "ep", type: "string", required: false, cel: "this.matches('^([a-h][36])?$')"},
					// Plies since the last pawn move or capture, and the move number.
					// The fifty-move rule ends a game at a hundred; the room above it
					// is what a position arriving in the wire format may carry.
					{ordinal: 13, name: "halfmove", type: "int32", cel: "this >= 0 && this <= 150"},
					{ordinal: 14, name: "fullmove", type: "int32", cel: "this >= 1 && this <= 9999"},
					// The same position in the wire format, assembled by the referee:
					// the sheet prints it and the shelf draws its thumbnail from it.
					{ordinal: 15, name: "fen", type: "string", cel: "this.size() >= 20 && this.size() <= 100"},
					{ordinal: 16, name: "turn", type: "string", cel: "this in ['white', 'black']"},
					{ordinal: 17, name: "ply", type: "int32", cel: "this >= 0"},
					{ordinal: 18, name: "status", type: "string", cel: "this in ['playing', 'over']"},
					{ordinal: 19, name: "result", type: "string", required: false, cel: "this in ['', '1-0', '0-1', '1/2-1/2']"},
					// The same fact in the reader's words. The figures are the
					// record; this is what the board says out loud.
					{ordinal: 20, name: "won", type: "string", required: false, cel: "this.size() <= 16"},
					{ordinal: 21, name: "termination", type: "string", required: false, cel: "this in ['', 'checkmate', 'stalemate', 'threefold', 'fifty-move', 'insufficient', 'resignation', 'flag', 'agreement']"},
					{ordinal: 22, name: "check", type: "string", cel: "this in ['yes', 'no']"},
					{ordinal: 23, name: "selected", type: "string", required: false, cel: "this.size() <= 2"},
					{ordinal: 24, name: "flipped", type: "string", cel: "this in ['yes', 'no']"},
					// How the last move was made. A dragged piece is already
					// where the hand left it, so it must not travel there
					// again once the drop resolves.
					{ordinal: 25, name: "dragged", type: "string", cel: "this in ['yes', 'no']"},
					{ordinal: 26, name: "last_from", type: "string", required: false, cel: "this.size() <= 2"},
					{ordinal: 27, name: "last_to", type: "string", required: false, cel: "this.size() <= 2"},
					{ordinal: 28, name: "current", type: "string", cel: "this in ['yes', 'no']"},
					{ordinal: 29, name: "ordinal", type: "string", cel: "this.size() == 4"},
					// Both clocks, in milliseconds, and the reading of the
					// metronome they were last decremented against.
					{ordinal: 30, name: "white_ms", type: "int32", required: false, retired: true},
					{ordinal: 83, name: "white_clock", type: "duration"},
					{ordinal: 31, name: "black_ms", type: "int32", required: false, retired: true},
					{ordinal: 84, name: "black_clock", type: "duration"},
					{ordinal: 32, name: "last_tick", type: "int32", cel: "this >= 0"},
					// What the reader is looking at: a move's key, or "start".
					{ordinal: 33, name: "cursor", type: "string", cel: "this.size() <= 72"},
					// A command the nav forms write and the referee consumes:
					// the arrow keys and the four buttons take one path.
					{ordinal: 34, name: "step", type: "string", required: false, cel: "this in ['', 'first', 'back', 'fwd', 'live']"},
					// Where the keyboard is on the board, and the command that
					// moves it — the same one-column shape as `step`, because
					// "the square left of this one" is arithmetic no form can
					// do and the board's orientation is the referee's to know.
					{ordinal: 35, name: "caret", type: "string", cel: "this.size() == 2"},
					{ordinal: 36, name: "caret_go", type: "string", required: false, cel: "this in ['', 'up', 'down', 'left', 'right', 'row-start', 'row-end', 'first', 'last']"},
					{ordinal: 37, name: "promo_from", type: "string", required: false, cel: "this.size() <= 2"},
					{ordinal: 38, name: "promo_to", type: "string", required: false, cel: "this.size() <= 2"},
					// The promotion square in the grid's own coordinates, so
					// the choice can stand on it rather than in a strip under
					// the board.
					{ordinal: 39, name: "promo_f", type: "string", cel: "this.size() == 1"},
					{ordinal: 40, name: "promo_r", type: "string", cel: "this.size() == 1"},
					{ordinal: 41, name: "draw_offer", type: "string", cel: "this in ['none', 'you', 'declined']"},
					{ordinal: 42, name: "eco", type: "string", required: false, cel: "this.size() <= 3"},
					{ordinal: 43, name: "opening", type: "string", required: false, cel: "this.size() <= 48"},
					// What each side has taken, and by how much: a template
					// binds fields and cannot count a board.
					{ordinal: 44, name: "taken_white", type: "string", required: false, cel: "this.size() <= 32"},
					{ordinal: 45, name: "taken_black", type: "string", required: false, cel: "this.size() <= 32"},
					// White's material edge in pawns; each seat prints its own
					// share of it, so the sign never has to be read.
					{ordinal: 46, name: "edge", type: "int32", cel: "this >= -39 && this <= 39"},
					// Whether the reader is looking back. The terminal's state
					// vocabulary does not carry it and the screen's CSS needs
					// it, so it is a column like every other derived fact.
					{ordinal: 47, name: "reviewing", type: "string", cel: "this in ['yes', 'no']"},
					// The game as every other board reads it, assembled by the
					// referee: a template binds fields and cannot join rows.
					{ordinal: 48, name: "pgn", type: "string", required: false, cel: "this.size() <= 2000"},
					// The two seats as the board shows them — opponent above,
					// guest below — because a template binds fields and cannot
					// decide which clock belongs to which side.
					// What the engine seat is being asked, if anything. Derived like
					// every other column here and empty whenever the answer would be
					// nobody's: a unit is fed props off the row, so a question the
					// board is putting has to BE one.
					{ordinal: 49, name: "ask", type: "string", required: false, cel: "this.size() <= 100"},
					{ordinal: 50, name: "ask_ply", type: "string", required: false, cel: "this.size() <= 4"},
					{ordinal: 51, name: "ask_nodes", type: "string", required: false, cel: "this.size() <= 8"},
					// Two while a finished game is read, so the only move can be
					// told apart; one while the house is choosing a move.
					{ordinal: 52, name: "ask_lines", type: "string", required: false, cel: "this in ['', '1', '2']"},
					// The review (ir decision-24). Every column below is empty
					// while the game is being played, so the board has nothing to
					// advise with rather than something it hides.
					{ordinal: 53, name: "review", type: "string", required: false, cel: "this in ['', 'reading', 'read']"},
					{ordinal: 54, name: "review_line", type: "string", required: false, cel: "this.size() <= 64"},
					// Per seat rather than per colour, beside the seats that
					// already say who sits where.
					{ordinal: 55, name: "acc_low", type: "string", required: false, cel: "this.size() <= 3"},
					{ordinal: 56, name: "acc_top", type: "string", required: false, cel: "this.size() <= 3"},
					{ordinal: 57, name: "tally_low", type: "string", required: false, cel: "this.size() <= 64"},
					{ordinal: 58, name: "tally_top", type: "string", required: false, cel: "this.size() <= 64"},
					// White's chances at the position looked at, in twentieths:
					// a template binds an attribute, and the stylesheet turns the
					// step into a width.
					{ordinal: 59, name: "bar", type: "string", required: false, cel: "this.size() <= 2"},
					{ordinal: 60, name: "bar_label", type: "string", required: false, cel: "this.size() <= 8"},
					{ordinal: 61, name: "note_head", type: "string", required: false, cel: "this.size() <= 24"},
					{ordinal: 62, name: "note_mark", type: "string", required: false, cel: "this in ['', 'book', '!', '?!', '?', '??']"},
					{ordinal: 63, name: "note", type: "string", required: false, cel: "this.size() <= 280"},
					// The arrow for the better move, as one path in eighths of the
					// board as drawn, so turning the board round is different
					// numbers and not a different drawing; empty draws nothing.
					{ordinal: 64, name: "hint", type: "string", required: false, cel: "this.size() <= 24"},
					{ordinal: 65, name: "seat_top_name", type: "string", cel: "this.size() > 0"},
					{ordinal: 66, name: "seat_top_line", type: "string", cel: "this.size() > 0"},
					{ordinal: 67, name: "seat_top_ini", type: "string", cel: "this.size() == 1"},
					{ordinal: 68, name: "seat_top_ms", type: "int32", required: false, retired: true},
					{ordinal: 85, name: "seat_top_clock", type: "duration"},
					{ordinal: 69, name: "seat_top_taken", type: "string", required: false, cel: "this.size() <= 32"},
					// The material edge belongs to the seat that holds it,
					// because "+3" beside a board says nothing about whose.
					{ordinal: 70, name: "seat_top_edge", type: "string", required: false, cel: "this.size() <= 3"},
					{ordinal: 71, name: "seat_top_turn", type: "string", cel: "this in ['yes', 'no']"},
					// Under ten seconds, which the brief asks the clock to say
					// and a change of format alone says quietly.
					{ordinal: 72, name: "seat_top_low", type: "string", cel: "this in ['yes', 'no']"},
					{ordinal: 73, name: "seat_low_name", type: "string", cel: "this.size() > 0"},
					{ordinal: 74, name: "seat_low_line", type: "string", cel: "this.size() > 0"},
					{ordinal: 75, name: "seat_low_ini", type: "string", cel: "this.size() == 1"},
					{ordinal: 76, name: "seat_low_ms", type: "int32", required: false, retired: true},
					{ordinal: 86, name: "seat_low_clock", type: "duration"},
					{ordinal: 77, name: "seat_low_taken", type: "string", required: false, cel: "this.size() <= 32"},
					{ordinal: 78, name: "seat_low_edge", type: "string", required: false, cel: "this.size() <= 3"},
					{ordinal: 79, name: "seat_low_turn", type: "string", cel: "this in ['yes', 'no']"},
					{ordinal: 80, name: "seat_low_low", type: "string", cel: "this in ['yes', 'no']"},
					// The measured strength of whoever sits in each seat, as the
					// bar prints it; empty for a person (ir decision-30).
					{ordinal: 81, name: "seat_top_elo", type: "string", required: false, cel: "this.size() <= 8"},
					{ordinal: 82, name: "seat_low_elo", type: "string", required: false, cel: "this.size() <= 8"},
				]
			}
			// The next game's terms, apart from any game (ir decision-31). One
			// row, `next`: the setup card's pickers write it and Start copies it
			// onto the game it opens, so a game's terms are fixed when it
			// starts. Device, because the reader chose it; the referee writes
			// its first value, since a device entity carries no seed.
			Setup: {
				id: "0x8d9203baf9a19c74"
				table: "setup"
				durability: "device"
				fields: [
					{ordinal: 1, name: "id", type: "string", pk: true, cel: "this in ['next']"},
					{ordinal: 2, name: "mode", type: "string", cel: "this in ['house', 'hotseat']"},
					{ordinal: 3, name: "bot", type: "string", cel: "this in ['nell', 'otto', 'vera', 'magnus', 'sable']"},
					{ordinal: 4, name: "level", type: "string", cel: "this in ['2', '3', '4', '5']"},
					{ordinal: 5, name: "tc", type: "string", cel: "this in ['unlimited', '1+0', '3+2', '5+0', '10+0']"},
					{ordinal: 6, name: "side", type: "string", cel: "this in ['white', 'black']"},
				]
			}
			Move: {
				id: "0xc5cdacfd2b60f737"
				table: "move"
				durability: "device"
				fields: [
					{ordinal: 1, name: "id", type: "string", pk: true, cel: "this.size() <= 72"},
					{ordinal: 2, name: "game_id", type: "string", cel: "this.size() <= 64"},
					{ordinal: 3, name: "ply", type: "int32", cel: "this >= 1"},
					{ordinal: 4, name: "number", type: "int32", cel: "this >= 1"},
					{ordinal: 5, name: "color", type: "string", cel: "this in ['white', 'black']"},
					{ordinal: 6, name: "san", type: "string", cel: "this.size() >= 2 && this.size() <= 8"},
					{ordinal: 7, name: "uci", type: "string", cel: "this.size() >= 4 && this.size() <= 5"},
					// The position it reached, a column per fact of it, on the same
					// terms as the game's own: the board sixty-four squares wide, then
					// the side to move, the rights, the en-passant square and the two
					// counters. The cursor and the repetition count both read them.
					{ordinal: 8, name: "board_after", type: "string", cel: "this.size() == 64 && this.matches('^(?:\\.|[PNBRQKpnbrqk]){64}$')"},
					{ordinal: 9, name: "turn_after", type: "string", cel: "this in ['white', 'black']"},
					{ordinal: 10, name: "castling_after", type: "string", required: false, cel: "this.matches('^K?Q?k?q?$')"},
					{ordinal: 11, name: "ep_after", type: "string", required: false, cel: "this.matches('^([a-h][36])?$')"},
					{ordinal: 12, name: "halfmove_after", type: "int32", cel: "this >= 0 && this <= 150"},
					{ordinal: 13, name: "fullmove_after", type: "int32", cel: "this >= 1 && this <= 9999"},
					// And in the wire format, which is how every other board reads a
					// position.
					{ordinal: 14, name: "fen_after", type: "string", cel: "this.size() >= 20 && this.size() <= 100"},
					{ordinal: 15, name: "capture", type: "string", cel: "this in ['yes', 'no']"},
					{ordinal: 16, name: "check", type: "string", cel: "this in ['yes', 'no']"},
					// A move taken back is marked, never removed: a reduce
					// writes and patches, and a sheet that could be silently
					// rewritten is not a record (ir decision-07).
					{ordinal: 17, name: "retracted", type: "string", cel: "this in ['yes', 'no']"},
					{ordinal: 18, name: "white_ms", type: "int32", required: false, retired: true},
					{ordinal: 27, name: "white_clock", type: "duration"},
					{ordinal: 19, name: "black_ms", type: "int32", required: false, retired: true},
					{ordinal: 28, name: "black_clock", type: "duration"},
					// How the house read this move, once the game is reviewed
					// (ir decision-25, ir decision-26). Evaluations are White's
					// view, in centipawns or `#n` for a mate, and every one is
					// empty until the reading reaches it.
					{ordinal: 20, name: "before", type: "string", required: false, cel: "this.size() <= 7"},
					{ordinal: 21, name: "second", type: "string", required: false, cel: "this.size() <= 7"},
					{ordinal: 22, name: "best", type: "string", required: false, cel: "this.size() <= 8"},
					{ordinal: 23, name: "line", type: "string", required: false, cel: "this.size() <= 48"},
					{ordinal: 24, name: "after", type: "string", required: false, cel: "this.size() <= 7"},
					{ordinal: 25, name: "mark", type: "string", required: false, cel: "this in ['', 'book', '!', '?!', '?', '??']"},
					{ordinal: 26, name: "tide", type: "string", required: false, cel: "this.size() <= 2"},
				]
			}
			Square: {
				id: "0xcb6a4e781c0adf82"
				table: "square"
				durability: "tab"
				fields: [
					{ordinal: 1, name: "id", type: "string", pk: true, cel: "this.size() == 2"},
					{ordinal: 2, name: "ord", type: "string", cel: "this.size() == 2"},
					// What the square is called out loud. The board is one tab
					// stop now, so a reader arrives on it with nothing else to
					// go on.
					{ordinal: 3, name: "label", type: "string", cel: "this.size() >= 8 && this.size() <= 24"},
					{ordinal: 4, name: "shade", type: "string", cel: "this in ['light', 'dark']"},
					{ordinal: 5, name: "piece", type: "string", required: false, cel: "this.size() <= 1"},
					// The figure standing here, for the drag image alone: the
					// browser snapshots the square it is dragging, and the
					// pieces are a layer above it that no snapshot reaches.
					{ordinal: 6, name: "glyph", type: "string", required: false, cel: "this.size() <= 1"},
					{ordinal: 7, name: "color", type: "string", required: false, cel: "this in ['', 'white', 'black']"},
					{ordinal: 8, name: "selected", type: "string", cel: "this in ['yes', 'no']"},
					{ordinal: 9, name: "target", type: "string", cel: "this in ['yes', 'no']"},
					{ordinal: 10, name: "capture", type: "string", cel: "this in ['yes', 'no']"},
					{ordinal: 11, name: "last", type: "string", cel: "this in ['yes', 'no']"},
					{ordinal: 12, name: "check", type: "string", cel: "this in ['yes', 'no']"},
					{ordinal: 13, name: "drag", type: "string", cel: "this in ['yes', 'no']"},
					// Where a drop came from. The drag seat cannot decide a
					// move — it is called without the world — so it states the
					// intent here and the referee resolves it (ir decision-23).
					{ordinal: 14, name: "drag_from", type: "string", required: false, cel: "this.size() <= 2"},
					{ordinal: 15, name: "coord_file", type: "string", required: false, cel: "this.size() <= 1"},
					{ordinal: 16, name: "coord_rank", type: "string", required: false, cel: "this.size() <= 1"},
				]
			}
			Piece: {
				id: "0xc103e54cf496409a"
				table: "piece"
				durability: "tab"
				fields: [
					{ordinal: 1, name: "id", type: "string", pk: true, cel: "this.size() == 4"},
					{ordinal: 2, name: "piece", type: "string", cel: "this.size() == 1"},
					{ordinal: 3, name: "color", type: "string", cel: "this in ['white', 'black']"},
					// Which figure of which set this piece prints as. The set
					// is the game's; resolving it here is what lets the layer
					// bind one attribute and know nothing about sets.
					{ordinal: 4, name: "symbol", type: "string", cel: "this.size() <= 24"},
					{ordinal: 5, name: "initial", type: "string", cel: "this.size() == 1"},
					{ordinal: 6, name: "glyph", type: "string", cel: "this.size() <= 2"},
					{ordinal: 7, name: "square", type: "string", cel: "this.size() == 2"},
					// Where it sits on the board AS DRAWN, so turning the board
					// round is a different number and not a different layout.
					{ordinal: 8, name: "file", type: "int32", cel: "this >= 0 && this <= 7"},
					{ordinal: 9, name: "rank", type: "int32", cel: "this >= 0 && this <= 7"},
					{ordinal: 10, name: "taken", type: "string", cel: "this in ['yes', 'no']"},
					{ordinal: 11, name: "lit", type: "string", cel: "this in ['yes', 'no']"},
				]
			}
			Legal: {
				id: "0x9e549ba353a215ba"
				table: "legal"
				durability: "tab"
				fields: [
					{ordinal: 1, name: "id", type: "string", pk: true, cel: "this.size() <= 72"},
					{ordinal: 2, name: "game_id", type: "string", cel: "this.size() <= 64"},
					{ordinal: 3, name: "ply", type: "int32", cel: "this >= 0"},
					{ordinal: 4, name: "from_sq", type: "string", cel: "this.size() == 2"},
					{ordinal: 5, name: "to_sq", type: "string", cel: "this.size() == 2"},
					{ordinal: 6, name: "uci", type: "string", cel: "this.size() >= 4 && this.size() <= 5"},
					{ordinal: 7, name: "san", type: "string", cel: "this.size() >= 2 && this.size() <= 8"},
					{ordinal: 8, name: "promo", type: "string", required: false, cel: "this in ['', 'Q', 'R', 'B', 'N']"},
					// The position it reached, a column per fact of it, on the same
					// terms as the game's own: the board sixty-four squares wide, then
					// the side to move, the rights, the en-passant square and the two
					// counters. The cursor and the repetition count both read them.
					{ordinal: 9, name: "board_after", type: "string", cel: "this.size() == 64 && this.matches('^(?:\\.|[PNBRQKpnbrqk]){64}$')"},
					{ordinal: 10, name: "turn_after", type: "string", cel: "this in ['white', 'black']"},
					{ordinal: 11, name: "castling_after", type: "string", required: false, cel: "this.matches('^K?Q?k?q?$')"},
					{ordinal: 12, name: "ep_after", type: "string", required: false, cel: "this.matches('^([a-h][36])?$')"},
					{ordinal: 13, name: "halfmove_after", type: "int32", cel: "this >= 0 && this <= 150"},
					{ordinal: 14, name: "fullmove_after", type: "int32", cel: "this >= 1 && this <= 9999"},
					// And in the wire format, which is how every other board reads a
					// position.
					{ordinal: 15, name: "fen_after", type: "string", cel: "this.size() >= 20 && this.size() <= 100"},
					{ordinal: 16, name: "capture", type: "string", cel: "this in ['yes', 'no']"},
					{ordinal: 17, name: "check", type: "string", cel: "this in ['yes', 'no']"},
					{ordinal: 18, name: "mate", type: "string", cel: "this in ['yes', 'no']"},
				]
			}
			// The metronome, and its only job. A reduce has no clock, so time
			// arrives the way randomness does — as an input somebody else
			// writes. One machine owns this row and nothing else touches it
			// (ir decision-15).
			Tick: {
				id: "0x8e2ea6ba528e101e"
				table: "tick"
				durability: "tab"
				fields: [
					{ordinal: 1, name: "id", type: "string", pk: true, cel: "this.size() <= 8"},
					{ordinal: 2, name: "n", type: "int32", cel: "this >= 0"},
					{ordinal: 3, name: "beat", type: "string", cel: "this in ['on']"},
				]
				seed: [{id: "tick", n: 0, beat: "on"}]
			}
			Opening: {
				id: "0xe7d785b5461a232c"
				table: "opening"
				durability: "tab"
				fields: [
					{ordinal: 1, name: "id", type: "string", pk: true, cel: "this.size() == 3"},
					{ordinal: 2, name: "name", type: "string", cel: "this.size() > 0"},
					{ordinal: 3, name: "uci", type: "string", cel: "this.size() > 0"},
				]
				seed: [
					{id: "A00", name: "Dunst Opening", uci: "b1c3"},
					{id: "A02", name: "Bird's Opening", uci: "f2f4"},
					{id: "A04", name: "Réti Opening", uci: "g1f3"},
					{id: "A10", name: "English Opening", uci: "c2c4"},
					{id: "A40", name: "Queen's Pawn", uci: "d2d4"},
					{id: "A45", name: "Indian Defence", uci: "d2d4 g8f6"},
					{id: "A80", name: "Dutch Defence", uci: "d2d4 f7f5"},
					{id: "B00", name: "King's Pawn", uci: "e2e4"},
					{id: "B01", name: "Scandinavian Defence", uci: "e2e4 d7d5"},
					{id: "B02", name: "Alekhine Defence", uci: "e2e4 g8f6"},
					{id: "B06", name: "Modern Defence", uci: "e2e4 g7g6"},
					{id: "B07", name: "Pirc Defence", uci: "e2e4 d7d6"},
					{id: "B10", name: "Caro-Kann Defence", uci: "e2e4 c7c6"},
					{id: "B20", name: "Sicilian Defence", uci: "e2e4 c7c5"},
					{id: "B30", name: "Sicilian, Old Sicilian", uci: "e2e4 c7c5 g1f3 b8c6"},
					{id: "B40", name: "Sicilian, French Variation", uci: "e2e4 c7c5 g1f3 e7e6"},
					{id: "B50", name: "Sicilian, Modern Variations", uci: "e2e4 c7c5 g1f3 d7d6"},
					{id: "C00", name: "French Defence", uci: "e2e4 e7e6"},
					{id: "C20", name: "King's Pawn Game", uci: "e2e4 e7e5"},
					{id: "C25", name: "Vienna Game", uci: "e2e4 e7e5 b1c3"},
					{id: "C30", name: "King's Gambit", uci: "e2e4 e7e5 f2f4"},
					{id: "C42", name: "Petrov's Defence", uci: "e2e4 e7e5 g1f3 g8f6"},
					{id: "C44", name: "Scotch Game", uci: "e2e4 e7e5 g1f3 b8c6 d2d4"},
					{id: "C50", name: "Italian Game", uci: "e2e4 e7e5 g1f3 b8c6 f1c4"},
					{id: "C60", name: "Ruy López", uci: "e2e4 e7e5 g1f3 b8c6 f1b5"},
					{id: "D00", name: "Queen's Pawn Game", uci: "d2d4 d7d5"},
					{id: "D06", name: "Queen's Gambit", uci: "d2d4 d7d5 c2c4"},
					{id: "D10", name: "Slav Defence", uci: "d2d4 d7d5 c2c4 c7c6"},
					{id: "D20", name: "Queen's Gambit Accepted", uci: "d2d4 d7d5 c2c4 d5c4"},
					{id: "D30", name: "Queen's Gambit Declined", uci: "d2d4 d7d5 c2c4 e7e6"},
					{id: "E00", name: "Indian Game", uci: "d2d4 g8f6 c2c4 e7e6"},
					{id: "E20", name: "Nimzo-Indian Defence", uci: "d2d4 g8f6 c2c4 e7e6 b1c3 f8b4"},
					{id: "E60", name: "King's Indian Defence", uci: "d2d4 g8f6 c2c4 g7g6"},
				]
			}
		}
		// No pipeline: a tab or device entity has no table to publish.
		pipelines: {}
	}

	capabilities: {
		// No auth block: nothing here is per-person (ir decision-13).
		blobs: false
		hatches: {}
		vendored: {
			// Stockfish, on its own thread and behind a wrapper this repository
			// audited (ir decision-22). The engine is asked for a PREFERENCE and
			// never for a possibility: what it answers is looked up in Legal.
			stockfish: {
				isolation: "worker"
				capabilities: []
				src: "shell/units/stockfish/unit.js"
				// LICENSE and NOTICE.md are served beside the object code because
				// GPLv3 6(d) is the offer taken, and "the same place" is what makes
				// it one.
				files: [
					"shell/units/stockfish/unit.js",
					"shell/units/stockfish/stockfish-18-lite-single.js",
					"shell/units/stockfish/stockfish-18-lite-single.wasm",
					"shell/units/stockfish/LICENSE",
					"shell/units/stockfish/NOTICE.md",
				]
				note: "stockfish@18.0.8, single-threaded lite build, pinned by sha256 in NOTICE.md; the wrapper speaks the seat's protocol and enforces Threads 1, Hash 16, ucinewgame before every search and a budget in nodes"
			}
		}
	}

	surface: {
		screens: {
			board: {
				// The rail's label for this screen (ir decision-28).
				title:  "Play"
				route:  "/"
				markup: _boardMarkup
				forms: []
				states: ["loading", "empty", "populated", "picked", "promoting", "reviewing", "over", "setting", "reading", "reviewed", "populated-dark", "network-error"]
				files: {
					shared: ["shell/shared/paper.css"]
					renderers: ["shell/renderers/clock.js"]
				}
			}
			shelf: {
				title: "Games"
				route: "/games"
				forms: []
				states: ["loading", "empty", "populated", "populated-dark"]
				files: {
					shared: ["shell/shared/paper.css"]
					renderers: ["shell/renderers/clock.js", "shell/renderers/board.js"]
				}
			}
			sheet: {
				title: "Sheet"
				route: "/game/:id"
				// Reached from a row on the shelf, never from everywhere; the
				// strip carries no :id, so it could compose no address here.
				strip: false
				// One held instance per game ever opened is one too many, and
				// there is no entry state worth keeping.
				keep: 0
				forms: []
				states: ["empty", "populated", "populated-dark"]
				files: {
					shared: ["shell/shared/paper.css"]
					renderers: ["shell/renderers/clock.js"]
				}
			}
		}

		handlers: {
			resume: {
				of:  "shelf"
				src: "shell/handlers/resume.js"
				note: "which of the boards standing is the one you are at: exactly one game is current, so resuming is two writes"
			}
			metronome: {
				of:  "board"
				src: "shell/handlers/bump.js"
				note: "the beat after this one — the app's whole knowledge that time passed, and it does not know how much"
			}
			referee: {
				of:  "board"
				src: "shell/handlers/referee.js"
				note: "the rules of chess as a reduce: legality, the naming of a move, the five endings, and the house's answer — rows in, updates out"
			}
		}

		design: (pronto.#DesignMd & {text: _designMd}).design

		flows: {
			"new-game": {of: "board", entity: "Game", action: "create"}
			"draw-board": {of: "board", entity: "Square", action: "upsert"}
			"move-pieces": {of: "board", entity: "Piece", action: "upsert"}
			"offer-moves": {of: "board", entity: "Legal", action: "upsert"}
			"pick-square": {of: "board", entity: "Game", action: "update"}
			"play-move": {of: "board", entity: "Move", action: "create"}
			"promote": {of: "board", entity: "Move", action: "create"}
			"house-move": {of: "board", entity: "Move", action: "create"}
			"tick-clock": {of: "board", entity: "Game", action: "update"}
			"end-game": {of: "board", entity: "Game", action: "update"}
			"resign": {of: "board", entity: "Game", action: "update"}
			"offer-draw": {of: "board", entity: "Game", action: "update"}
			"take-back": {of: "board", entity: "Move", action: "update"}
			"walk-the-sheet": {of: "board", entity: "Game", action: "update"}
			"set-up": {of: "board", entity: "Setup", action: "create"}
			"pick-mode": {of: "board", entity: "Setup", action: "update"}
			"pick-bot": {of: "board", entity: "Setup", action: "update"}
			"pick-clock": {of: "board", entity: "Setup", action: "update"}
			"pick-side": {of: "board", entity: "Setup", action: "update"}
			"pick-set": {of: "board", entity: "Game", action: "update"}
			"flip-board": {of: "board", entity: "Game", action: "update"}
			"review-game": {of: "board", entity: "Move", action: "update"}
			"resume-game": {of: "shelf", entity: "Game", action: "update"}
			"open-sheet": {of: "shelf", entity: "Game", action: "navigate"}
		}
	}

	meta: {
		name:        "chess"
		description: "A chess board, and the score sheet it leaves behind — offline, no accounts."
		ir: {sha256: "4435f77f9874daef527235c19f02cc37e51de48d62d4de4655391b25a83520d2"}
		targets: []
		decisions: {
			"decision-01": {}
			"decision-02": {}
			"decision-03": {}
			"decision-04": {}
			"decision-05": {}
			"decision-06": {}
			"decision-07": {}
			"decision-08": {}
			"decision-09": {}
			"decision-10": {}
			"decision-11": {}
			"decision-12": {}
			"decision-13": {}
			"decision-14": {}
			"decision-15": {}
			"decision-16": {}
			"decision-17": {}
			"decision-18": {}
			"decision-19": {}
			"decision-20": {}
			"decision-21": {}
			"decision-22": {}
			"decision-23": {}
			"decision-24": {}
			"decision-25": {}
			"decision-26": {}
			"decision-27": {}
			"decision-28": {}
			"decision-29": {}
			"decision-30": {}
			"decision-31": {}
		}
		tests: {
			"test-perft": {
				of: "Legal"
				says:  "the legal-move tree has exactly as many leaves as the published perft counts, at every depth of every standard position"
				given: {positions: 6, initial: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}
				when:  "walk the tree through the app's own legal rows"
				then:  "output.counts == [20, 400, 8902, 197281] && output.allPositionsAgree"
			}
			"test-replay": {
				of: "Move"
				says:  "a published game replays move for move, each name matching exactly one legal row"
				given: {games: ["opera", "immortal"]}
				when:  "feed the score sheet back in"
				then:  "output.matchesPerMove.all(n, n == 1) && output.termination == \"checkmate\""
			}
			"test-disambiguation": {
				of: "Legal"
				says:  "two pieces reaching one square are told apart by the smallest thing that tells them apart"
				given: {knightsByFile: "b1,f3", knightsByRank: "b1,b5", queens: "a1,a4,d1"}
				when:  "name the moves"
				then:  "output.byFile == \"Nbd2\" && output.byRank == \"N1c3\" && output.bySquare == \"Qa1d4\""
			}
			"test-castling-rights": {
				of: "Legal"
				says:  "castling is offered exactly while the right stands, the squares are empty, and the king neither stands in nor crosses an attacked square"
				given: {rights: "KQkq", attacked: "f1"}
				when:  "generate"
				then:  "output.bothSides == [\"O-O\", \"O-O-O\"] && !output.throughCheck.exists(m, m == \"O-O\")"
			}
			"test-en-passant": {
				of: "Legal"
				says:  "the en passant capture is offered for one move, and never when taking would expose the mover's own king"
				given: {ep: "d6", pinned: "K2pP2r on the fifth"}
				when:  "generate"
				then:  "output.offered && !output.whenPinned"
			}
			"test-promotion": {
				of: "Game"
				says:  "a pawn reaching the far rank is asked which piece it becomes, and the answer is the move that gets played"
				given: {pawn: "a7", choice: "N"}
				when:  "tap the last rank, then choose"
				then:  "output.asks && output.san == \"a8=N\" && output.promotions == 4"
			}
			"test-endings": {
				of: "Game"
				says:  "each ending is named apart, each names its result, and the board keeps the position it ended on"
				given: {stalemate: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", half: 100}
				when:  "settle the position"
				then:  "output.stalemate == \"stalemate\" && output.insufficient == \"insufficient\" && output.fifty == \"fifty-move\" && output.draws.all(r, r == \"1/2-1/2\")"
			}
			"test-threefold": {
				of: "Game"
				says:  "a position reached three times ends the game as a draw, counted over the four fields that decide sameness"
				given: {repeats: 3}
				when:  "settle the position"
				then:  "output.termination == \"threefold\" && output.countedFields == 4"
			}
			"test-check-mark": {
				of: "Move"
				says:  "a move that gives check is named with a plus, and the checked king's square is marked"
				given: {move: "Qh4"}
				when:  "play it"
				then:  "output.san.endsWith(\"+\") && output.checkedSquare == output.kingSquare"
			}
			"test-clock": {
				of: "Game"
				says:  "the clock counts down for the side to move, adds the increment after that side's move, and does not start until both sides have moved"
				given: {tc: "3+2", beats: 5}
				when:  "the metronome moves five beats"
				then:  "output.beforePly2 == input.beforePly2 && output.spent == 5000 && output.afterMove == output.spent + 2000"
			}
			"test-flag": {
				of: "Game"
				says:  "a clock at zero ends the game, and it is a draw when the other side could never have mated"
				given: {white_clock: "PT1S", lone: "king and knight"}
				when:  "the metronome passes the clock"
				then:  "output.termination == \"flag\" && output.result == \"0-1\" && output.againstBareKing == \"1/2-1/2\""
			}
			"test-captures": {
				of: "Game"
				says:  "what each side has taken is what is missing from the other's army, and the difference is the material edge"
				given: {taken: "a black knight and a white pawn"}
				when:  "render"
				then:  "output.takenWhite.size() > 0 && output.takenBlack.size() > 0 && output.edge == 2"
			}
			"test-opening": {
				of: "Game"
				says:  "the opening is the longest named line the moves so far match"
				given: {moves: "e4 e5 Nf3 Nc6 Bb5"}
				when:  "play them"
				then:  "output.eco == \"C60\" && output.opening == \"Ruy López\""
			}
			"test-review": {
				of: "Game"
				says:  "stepping through the sheet shows old positions, changes nothing, and one gesture returns to the game"
				given: {plies: 4}
				when:  "step back twice, then return"
				then:  "output.shown == output.fenAfterPly2 && output.legalOffered == 0 && output.ply == input.plies"
			}
			"test-takeback": {
				of: "Move"
				says:  "taking back against the house retracts both half-moves and restores the position and the clocks, and the sheet still holds them marked"
				given: {plies: 4, mode: "house"}
				when:  "take back"
				then:  "output.ply == input.plies - 2 && output.retracted == 2 && output.rowsStillThere == input.plies && output.hotseatOffers == false"
			}
			"test-draw": {
				of: "Game"
				says:  "the house answers a draw offer: it takes one when it is not better and declines when it is"
				given: {even: "a level position", winning: "a queen ahead"}
				when:  "offer a draw"
				then:  "output.evenAnswer == \"agreement\" && output.winningAnswer == \"declined\""
			}
			"test-levels": {
				of: "Game"
				says:  "every level answers within a beat, and a stronger one finds a mate in two that a weaker one does not"
				given: {mateInTwo: true}
				when:  "the house moves at each level"
				then:  "output.everyLevelMoves && output.strongFindsMate"
			}
			"test-drag": {
				of: "Square"
				says:  "dragging a piece onto a square it may reach plays the move a tap would have played"
				given: {from: "e2", to: "e4"}
				when:  "drag"
				then:  "output.san == \"e4\" && output.sameAsTap"
			}
			"test-selection": {
				of: "Square"
				says:  "picking a piece up marks its square and exactly the squares it may reach"
				given: {picked: "g1", pinned: "a pinned knight"}
				when:  "tap"
				then:  "output.targets == output.legalFrom && output.pinnedPieceTargets == 0 && output.afterStrayTap == \"\""
			}
			"test-pieces-travel": {
				of: "Piece"
				says:  "a move moves one piece row rather than redrawing the board, which is what lets the node travel"
				given: {from: "e2", to: "e4"}
				when:  "play it"
				then:  "output.movedRows == 1 && output.sameRowId && output.marked == [input.from, input.to]"
			}
			"test-board-converges": {
				of: "Square"
				says:  "woken on a position it has already drawn, the referee writes nothing but the clock"
				given: {position: "already drawn"}
				when:  "wake it again"
				then:  "output.updatesOnSecondWake == 0"
			}
			"test-new-game": {
				of: "Game"
				says:  "Start takes the board on the terms the setup card shows, and the game before it is still there to go back to"
				given: {side: "black", bot: "vera", start: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}
				when:  "choose Black against Vera on the card, then Start"
				then:  "output.current == 1 && output.kept == 2 && output.fen == input.start && output.side == input.side && output.bot == input.bot"
			}
			"test-setup-as-black": {
				of: "Setup"
				says:  "with the guest Black and the house already moved, the card still offers every choice, and Start opens a game against the one chosen"
				given: {side: "black", ply: 1, chosen: "vera"}
				when:  "open New game, choose Vera, Start"
				then:  "output.cardReachable && output.bot == input.chosen && output.seatName == \"Vera\""
			}
			"test-terms-fixed": {
				of: "Game"
				says:  "choosing on the setup card never changes the mode, opponent, level, clock, side, seat name or seat rating of the game on the board or of a finished one"
				given: {games: ["playing", "over"], choices: "every option of every setup picker"}
				when:  "choose each"
				then:  "output.termsChanged == 0"
			}
			"test-first-game": {
				of: "Setup"
				says:  "with nothing stored, the first game is against Otto, with the guest White, against the house at 5+0, whatever the draw"
				given: {seeds: [0, 1, 2, 3, 4]}
				when:  "open the board on an empty store"
				then:  "output.games.all(g, g.bot == \"otto\" && g.side == \"white\" && g.mode == \"house\" && g.tc == \"5+0\")"
			}
			"test-setup-explored": {
				of: "board"
				says:  "breadth-first over every gesture the board offers and the house's and the clock's events, every state reached keeps the card one gesture away, exactly one game current, every game's terms as they started, and a referee that settles"
				given: {depth: 4, starts: ["no game, no setup row", "guest White", "guest White, no setup row", "guest Black", "guest Black, no setup row"]}
				when:  "explore"
				then:  "output.states > 0 && output.unreachable == 0 && output.currentNotOne == 0 && output.termsChanged == 0"
			}
			"test-live-pickers": {
				of: "board"
				says:  "the pieces and board pickers stand in every state, a review included, and a choice on either sticks through the wakes after it and shows on the board"
				given: {pickers: ["view", "set"], states: "every state the exploration reaches, and a finished game under review"}
				when:  "choose each option"
				then:  "output.unreachable == 0 && output.lost == 0 && output.unshown == 0"
			}
			"test-resign": {
				of: "Game"
				says:  "resigning ends the game at once and gives it to the other side"
				given: {side: "white"}
				when:  "resign"
				then:  "output.status == \"over\" && output.termination == \"resignation\" && output.result != \"1/2-1/2\""
			}
			"test-hotseat": {
				of: "Game"
				says:  "handing both sides over does not disturb the position"
				given: {fen: "mid-game", ply: 14}
				when:  "pick two at one board"
				then:  "output.fen == input.fen && output.ply == input.ply && output.movableSides == 2"
			}
			"test-durability": {
				of: "Game"
				says:  "the game outlives the tab and the app owes the network nothing"
				given: {fen: "mid-game", network: "cut after load"}
				when:  "reopen and play on"
				then:  "output.fen == input.fen && output.requestsDuringGame == 0"
			}
			"test-shelf": {
				of: "shelf"
				says:  "the shelf lists every game newest first, says so when there are none, and a row opens a sheet carrying the moves, the PGN and the final position"
				given: {games: 3, plies: 33}
				when:  "look back"
				then:  "output.ordered && output.sheetMoves == input.plies && output.pgn.startsWith(\"1.\") && output.fen.size() > 20"
			}
			"test-flip-and-advice": {
				of: "board"
				says:  "turning the board puts black at the bottom, both coordinate strips agree, and nothing evaluates the position"
				given: {flipped: "yes"}
				when:  "render"
				then:  "output.bottomRank == 1 && output.evaluationElements == 0"
			}
			"test-touch-and-motion": {
				of: "board"
				says:  "every target is at least a thumb wide, the only motion is a piece travelling, and both appearances render"
				given: {minSize: 24}
				when:  "render"
				then:  "output.smallestTarget >= input.minSize && output.loopingAnimations == 0 && output.reducedMotionTransitions == 0"
			}
			"test-review-marks": {
				of: "Move"
				says:  "the marks are the rule applied to the evaluations: each threshold lands its mark, book moves carry none, and the same evaluations give the same marks"
				given: {evaluations: "a game read with stated scores"}
				when:  "read it twice"
				then:  "output.marks == [\"?!\", \"?\", \"??\", \"!\"] && output.bookMarked == 0 && output.secondReading == output.firstReading && output.accuracies == [\"71\", \"59\"]"
			}
			"test-review-reading": {
				of: "Game"
				says:  "a finished game is read one position at a time in two lines and ends with both accuracies; a game still on puts no question"
				given: {plies: 6}
				when:  "ask for the review and answer every question"
				then:  "output.questions == input.plies + 1 && output.lines.all(l, l == \"2\") && output.review == \"read\" && output.accuracies.size() == 2 && output.askedWhilePlaying == 0"
			}
			"test-review-better": {
				of: "Game"
				says:  "on a marked move the note names the house's preference in notation and the arrow runs between its squares"
				given: {move: "a marked move"}
				when:  "look at it"
				then:  "output.note.contains(output.best) && output.arrowFrom == output.bestFrom && output.arrowTo == output.bestTo"
			}
			"test-one-piece-travels": {
				of: "Piece"
				says:  "replaying games, each move changes the square of exactly the piece that moved, and the rook too when castling"
				given: {games: ["italian-52", "ruy-lopez-20"]}
				when:  "replay them move by move"
				then:  "output.wrongTravels == 0 && output.castlingTravels.all(n, n == 2)"
			}
			"test-bot-elo": {
				of: "Game"
				says:  "every cast member's seat carries the rating the bench measured for it"
				given: {bench: "tests/elo.json"}
				when:  "seat each member"
				then:  "output.ratedMembers == 5 && output.everyRatingFromBench"
			}
			"test-plain-words": {
				of: "board"
				says:  "no screen's text names how the app is built"
				given: {words: ["device", "row", "column", "standing", "written down", "at this board"]}
				when:  "read every screen's text"
				then:  "output.developerWords == 0"
			}
			"test-fits-window": {
				of: "board"
				says:  "at a laptop's, a desktop's and a short window's size the board screen does not scroll, the step buttons and the panel's foot are in view, and in review the chances bar stands beside the board"
				given: {viewports: ["1280x800", "1440x900", "1024x600"]}
				when:  "play a game to its end and review it in the running stack"
				then:  "output.pageHeight <= input.viewportHeight && output.stepButtonsInView && output.barBesideBoard"
			}
		}
	}
}

// The terminal's statics ride the cluster's caddy image; without this wiring
// the image bakes only the ladder docs and every route 404s.
cluster: (pronto.#DefaultCluster & {"code": code, statics: terminal.surface.statics}).out
terminal: (pronto.#DefaultTerminal & {"code": code}).out
loop: (pronto.#DefaultLoop & {"code": code, "cluster": cluster, "terminal": terminal}).out

// The oracle. It reads one file and executes it the way the compartment does,
// so it needs neither a mounted screen nor a running cluster — which is the
// layer the loop's rule puts it at.
loop: surface: checks: "perft": {
	verb: "test"
	cmds: [
		"deno test --config tests/deno.json --no-lock --no-check --allow-read tests/perft.test.ts",
	]
	note: "the published perft counts for the six standard positions, walked through the app's own legal rows"
}

loop: surface: checks: "rules": {
	verb: "test"
	cmds: [
		"deno test --config tests/deno.json --no-lock --no-check --allow-read tests/rules.test.ts",
	]
	note: "two published games replayed by name, plus castling rights, disambiguation, promotion, en passant and the drawn endings"
}

// The only tier below the cluster where a fact about the board AS A WHOLE
// holds still: the referee, the pickers and the sixty-four cells run together,
// so a claim about a game is not a claim about one region.
loop: surface: checks: "board": {
	verb: "test"
	cmds: [
		"deno test --config tests/deno.json --no-lock --no-check --allow-env --allow-read tests/board.test.ts",
	]
	note: "the whole board mounted against the emitted markup and the emitted handler: a move played by tapping, the house's answer, and a position that settles"
}

// Layout is a browser's to decide, so the one fact about the whole screen's
// geometry is checked against the launched stack (ir decision-27).
loop: surface: checks: "window": {
	verb: "integrate"
	cmds: [
		"mise exec -- docker compose up -d --wait --build launch",
		// --node-modules-dir=none: the check imports its driver from deno's cache, and
		// the workspace package.json above would otherwise have deno expect a
		// node_modules a fresh checkout has not got.
		"deno test --no-lock --no-check --node-modules-dir=none --allow-all tests/window.test.ts",
	]
	note: "at 1280x800, 1440x900 and 1024x600 a game played to mate and reviewed never scrolls the page, keeps the step buttons and the panel's foot in view, and stands the chances bar beside the board"
}

terminal: surface: renderers: ["shell/renderers/clock.js", "shell/renderers/board.js"]

build: (pronto.#DefaultBuild & {"code": code, "loop": loop, "cluster": cluster}).out

out: pronto.#emit & {"code": code, "cluster": cluster, "terminal": terminal, "loop": loop, "build": build}
