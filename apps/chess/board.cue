// The board's markup, CUE-composed so the six pickers are instances of the
// graduated omnishell--picker and the piece figures are written once. Emitted
// to shell/screens/board.html by write.ts.
package chess

import (
	omni "bonisoft.org/plugins/omnishell/components"
)

// Every arrow is guarded on its row existing: before the referee writes the
// game or the setup row, the slots bind their fallback rows, and a write on a
// fallback would mint a junk row.
_seated: {type: "seated"}

// How the game on the board is looked at: live on the current game, because
// they change nothing about what is being played.
_pick: {
	collection: "game"
	filter:     "current=eq.yes"
	readout:    "text"
	guard:      _seated
}

// The next game's terms, on their own row (ir decision-31). A game copies them
// when it starts, so nothing chosen here reaches the game on the board.
_next: {
	collection: "setup"
	filter:     "id=eq.next"
	readout:    "text"
	guard:      _seated
}

_pickerMode: omni.#Picker & _next & {
	key: "mode", field: "mode", label: "Against"
	emptyRow: #"{"id":"","mode":"house"}"#
	initial:  "house"
	options: [
		{name: "house", label: "Computer", item: "Play the computer"},
		{name: "hotseat", label: "A friend", item: "A friend, on this board"},
	]
}

_pickerSide: omni.#Picker & _next & {
	key: "side", field: "side", label: "You play"
	emptyRow: #"{"id":"","side":"white"}"#
	initial:  "white"
	options: [
		{name: "white", label: "White", item: "White — you move first"},
		{name: "black", label: "Black", item: "Black — the other side opens"},
	]
}

_pickerBot: omni.#Picker & _next & {
	key: "bot", field: "bot", label: "Opponent"
	emptyRow: #"{"id":"","bot":"otto"}"#
	initial:  "otto"
	options: [
		{name: "nell", label: "Nell", item: "Nell (700) — one move ahead", assign: {level: "2"}},
		{name: "otto", label: "Otto", item: "Otto (1050) — steady", assign: {level: "3"}},
		{name: "vera", label: "Vera", item: "Vera (1350) — calculates", assign: {level: "4"}},
		{name: "magnus", label: "Rook", item: "Rook (1500) — deep and patient", assign: {level: "5"}},
		{name: "sable", label: "Sable", item: "Sable (2800+) — reads the position properly", assign: {level: "5"}},
	]
}

_pickerTc: omni.#Picker & _next & {
	key: "tc", field: "tc", label: "Clock"
	emptyRow: #"{"id":"","tc":"5+0"}"#
	initial:  "5+0"
	options: [
		{name: "unlimited", label: "No clock", item: "No clock"},
		{name: "1+0", label: "1+0", item: "1+0 · bullet"},
		{name: "3+2", label: "3+2", item: "3+2 · blitz"},
		{name: "5+0", label: "5+0", item: "5+0 · blitz"},
		{name: "10+0", label: "10+0", item: "10+0 · rapid"},
	]
}

_pickerSet: omni.#Picker & _pick & {
	key: "set", field: "set", label: "Pieces"
	emptyRow: #"{"id":"","set":"print"}"#
	initial:  "print"
	options: [
		{name: "print", label: "Print", item: "Print — newspaper figures"},
		{name: "staunton", label: "Staunton", item: "Staunton — the carved set"},
		{name: "engraved", label: "Engraved", item: "Engraved — outline and hatch"},
		{name: "disc", label: "Disc", item: "Disc — flat and lettered"},
	]
}

_pickerView: omni.#Picker & _pick & {
	key: "view", field: "flipped", label: "Board"
	emptyRow: #"{"id":"","flipped":"no"}"#
	initial:  "no"
	options: [
		{name: "no", label: "White at the foot", item: "White at the foot"},
		{name: "yes", label: "Black at the foot", item: "Black at the foot"},
	]
}

// One figure per piece kind, drawn once. Which colour it is and which set is in
// force are decided in CSS off the piece's own row and the board's, so three
// sets cost six drawings rather than thirty-six.
_figures: #"""
      <svg class="figures" aria-hidden="true" width="0" height="0" focusable="false">
        <pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="4" fill="var(--surface)"></rect>
          <line x1="0" y1="0" x2="0" y2="4" stroke="var(--primary)" stroke-width="1.8"></line>
        </pattern>
        <symbol id="fig-P" viewBox="0 0 45 45">
          <circle cx="22.5" cy="13" r="4.6"/>
          <path d="M18.4 18.6c-1.7 1.1-2.8 2.8-2.8 4.7 0 2.1 1.2 3.5 2.3 4.4-2.6 1.9-5.4 4.9-5.4 9.3h19.8c0-4.4-2.8-7.4-5.4-9.3 1.1-.9 2.3-2.3 2.3-4.4 0-1.9-1.1-3.6-2.8-4.7z"/>
          <rect x="10.5" y="36.4" width="24" height="3.6" rx="1.8"/>
        </symbol>
        <symbol id="fig-R" viewBox="0 0 45 45">
          <path d="M11.5 8.5h4.6v4h4.1v-4h4.6v4h4.1v-4h4.6v9.2h-22z"/>
          <path d="M14.6 17.7h15.8v14.6H14.6z"/>
          <path d="M12.6 32.3h19.8v3.9H12.6z"/>
          <rect x="10" y="36.2" width="25" height="3.8" rx="1.9"/>
        </symbol>
        <symbol id="fig-N" viewBox="0 0 45 45">
          <path d="M22.6 8.4c5.6.2 9.6 3.6 11 9 1 4 .9 8.6.9 12.6v2.2H12.9v-1.9c0-4.3 2.6-7.4 6.3-10 1.9-1.4 3-2.4 3.5-3.6-1.5.7-3 1.8-4.1 3.1-1.5 1.7-3.2 2.1-4.6 1.2-1.3-.8-1.4-2.5-.4-3.9l3.7-5.2c1.2-1.7 2.9-3 4.8-3.5z"/>
          <circle cx="18" cy="18.6" r="1.15" class="hole"/>
          <path d="M12.6 32.2h19.8v4H12.6z"/>
          <rect x="10" y="36.2" width="25" height="3.8" rx="1.9"/>
        </symbol>
        <symbol id="fig-B" viewBox="0 0 45 45">
          <circle cx="22.5" cy="8.6" r="2.3"/>
          <path d="M22.5 11.4c-4.3 2.9-7 6.7-7 10.9 0 3.2 1.7 5.4 3.3 6.6h7.4c1.6-1.2 3.3-3.4 3.3-6.6 0-4.2-2.7-8-7-10.9z"/>
          <path d="M21.6 17.4h1.8v7.4h-1.8z" class="hole"/>
          <path d="M18.6 20.4h7.8v1.8h-7.8z" class="hole"/>
          <path d="M13.6 29.4h17.8c1.1 2 1.1 4.6 0 6.6H13.6c-1.1-2-1.1-4.6 0-6.6z"/>
          <rect x="10" y="36.2" width="25" height="3.8" rx="1.9"/>
        </symbol>
        <symbol id="fig-Q" viewBox="0 0 45 45">
          <circle cx="9.4" cy="14.4" r="2.1"/><circle cx="17.4" cy="10.6" r="2.1"/>
          <circle cx="27.6" cy="10.6" r="2.1"/><circle cx="35.6" cy="14.4" r="2.1"/>
          <path d="M10.6 16.4l3.4 12.6h17l3.4-12.6-5.6 6.2-2.9-9.4-2.9 9.4-2.9-9.4-2.9 9.4z"/>
          <path d="M13.2 29.4h18.6c1.1 2 1.1 4.6 0 6.6H13.2c-1.1-2-1.1-4.6 0-6.6z"/>
          <rect x="10" y="36.2" width="25" height="3.8" rx="1.9"/>
        </symbol>
        <symbol id="fig-K" viewBox="0 0 45 45">
          <path d="M21 4.6h3v3.6h3.6v3H24v4h-3v-4h-3.6v-3H21z"/>
          <path d="M22.5 12.4c-5.2 0-9 3.6-9 8.2 0 3.2 1.7 5.6 3.3 7.2h11.4c1.6-1.6 3.3-4 3.3-7.2 0-4.6-3.8-8.2-9-8.2z"/>
          <path d="M13.2 29.4h18.6c1.1 2 1.1 4.6 0 6.6H13.2c-1.1-2-1.1-4.6 0-6.6z"/>
          <rect x="10" y="36.2" width="25" height="3.8" rx="1.9"/>
        </symbol>
      </svg>
"""#

_emptyGame: #"{"id":"","mode":"house","bot":"otto","bot_name":"Otto","bot_line":"Steady. Punishes a loose piece.","level":"3","set":"print","tc":"5+0","side":"white","board":"rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR","castling":"KQkq","ep":"","halfmove":0,"fullmove":1,"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","turn":"white","ply":0,"status":"playing","result":"","won":"","termination":"","check":"no","selected":"","flipped":"no","dragged":"no","last_from":"","last_to":"","current":"yes","ordinal":"0001","white_clock":"PT300S","black_clock":"PT300S","last_tick":0,"cursor":"start","step":"","caret":"e1","caret_go":"","promo_from":"","promo_to":"","promo_f":"0","promo_r":"0","draw_offer":"none","eco":"","opening":"","taken_white":"","taken_black":"","edge":0,"reviewing":"no","pgn":"","ask":"","ask_ply":"","ask_nodes":"","ask_lines":"","review":"","review_line":"","acc_low":"","acc_top":"","tally_low":"","tally_top":"","bar":"","bar_label":"","note_head":"","note_mark":"","note":"","hint":"","seat_top_name":"Otto","seat_top_line":"Steady. Punishes a loose piece.","seat_top_ini":"O","seat_top_clock":"PT300S","seat_top_taken":"","seat_top_edge":"","seat_top_turn":"no","seat_top_low":"no","seat_low_name":"You","seat_low_line":"White · 5+0","seat_low_ini":"Y","seat_low_clock":"PT300S","seat_low_taken":"","seat_low_edge":"","seat_low_turn":"yes","seat_low_low":"no","seat_top_elo":"1050","seat_low_elo":""}"#

// The one reads list every region carrying the referee's seat declares. A seat
// is keyed by it, so one value interpolated everywhere is what makes those
// regions share one seat, rather than a comment asking them to agree.
_reads: "game,move,square,legal,piece,tick,opening,setup"

_boardMarkup: #"""
<section class="screen" data-screen="board">

\#(_figures)

  <!-- The metronome. One machine owns this row and nothing else touches it:
       the referee reads how far it has moved since it last looked, so a beat
       the tab slept through costs the reader no time. -->
  <div class="metronome" data-live="tick" data-filter="id=eq.tick"
       data-machine='{"field":"beat","initial":"on","states":{"on":{"after":{"1000":{"assign":{"n":"bump"},"target":"on"}}}}}'></div>

  <!-- And the ear for it. A mutation wake is a region's OWN read changing, so
       a beat wakes nothing unless some region over `tick` carries the
       referee's seat. It is a second region rather than the machine's own so
       that the writer and the reader of this row stay visibly apart. -->
  <div class="metronome" data-live="tick" data-filter="id=eq.tick"
       data-on-mutation="referee" data-reads="\#(_reads)"></div>

  <!-- The game the board shows. A list of one (current=eq.yes) rather than a
       singleton: a singleton region hydrates no nested region, so the sheet
       would have no parent to take its {id} from, and it drives no screen
       state, so the screen would never leave loading.

       Six regions carry the referee's seat — one per table it writes —
       because a mutation wake is a region's own read changing. They share one
       seat because their data-reads are one value, `_reads`. -->
  <div class="game" data-live="game" data-filter="current=eq.yes" data-order="ordinal.desc" data-exit-motion="none"
       data-on-mutation="referee" data-reads="\#(_reads)"
       data-empty-row='\#(_emptyGame)'>
    <template data-item>
      <article class="table" data-turn="{turn}" data-status="{status}" data-check="{check}"
               data-mode="{mode}" data-side="{side}" data-result="{result}" data-set="{set}"
               data-termination="{termination}" data-flipped="{flipped}" data-tc="{tc}" data-dragged="{dragged}"
               data-reviewing="{reviewing}"
               data-promo="{promo_to}" data-offer="{draw_offer}" data-cursor="{cursor}"
               data-promo-r="{promo_r}" data-review="{review}" data-hint="{hint}" data-ply="{ply}">

        <!-- The two players, one on each edge of the board: who, what they
             have taken, and their clock. The one counting is the one whose
             side is to move, and it is the only clock in ink. -->
        <div class="seat top" data-turn="{seat_top_turn}" data-low="{seat_top_low}">
          <span class="av" data-text="{seat_top_ini}"></span>
          <span class="who">
            <b class="nm"><span data-text="{seat_top_name}"></span><span class="elo" data-text="{seat_top_elo}"></span></b>
            <span class="sub" data-text="{seat_top_line}"></span>
          </span>
          <span class="taken" data-text="{seat_top_taken}"></span>
          <b class="edge" data-text="{seat_top_edge}"></b>
          <b class="clk" data-text="{seat_top_clock}" data-text-format="clock"></b>
        </div>

        <div class="boardrow">
          <!-- The chances at the position looked at, down the board's side
               (ir decision-27). Empty, and invisible, unless a finished game
               is being reviewed. -->
          <div class="evbar" data-bar="{bar}" style="--b:{bar}" role="img" aria-label="White's winning chances {bar_label}"><span class="w"></span><b class="ev" data-text="{bar_label}"></b></div>

        <!-- The board. The grid takes the gestures; the layer above it holds
             the pieces, so a piece keeps its node across a move and its
             travel is a transition rather than a redraw. -->
        <div class="plate">
          <!-- One tab stop, not sixty-four: the caret is a column, the
               terminal owns the tab order and the focus, and the six keys
               write the command that moves it. Home and End walk the rank,
               Ctrl with them the whole board. -->
          <div class="board" data-live="square" data-order="ord.asc"
               data-on-mutation="referee" data-handler="referee"
               data-project='{"rove":{"eq":["id","{caret}"]}}'
               data-key='{"ArrowUp":"caret-up","ArrowDown":"caret-down","ArrowLeft":"caret-left","ArrowRight":"caret-right","Home":"caret-row-start","End":"caret-row-end","Ctrl+Home":"caret-first","Ctrl+End":"caret-last"}'
               data-reads="\#(_reads)">
            <template data-item data-when="rove=eq.true">
              <button type="button" class="sq" data-drag-handle data-on-click="referee"
                      tabindex="0" aria-label="{label}"
                      data-shade="{shade}" data-color="{color}" data-drag="{drag}"
                      data-selected="{selected}" data-target="{target}" data-capture="{capture}"
                      data-last="{last}" data-check="{check}"><span class="cf" data-text="{coord_file}"></span><span class="cr" data-text="{coord_rank}"></span><span class="carried" data-text="{glyph}"></span></button>
            </template>
            <template data-item>
              <button type="button" class="sq" data-drag-handle data-on-click="referee"
                      tabindex="-1" aria-label="{label}"
                      data-shade="{shade}" data-color="{color}" data-drag="{drag}"
                      data-selected="{selected}" data-target="{target}" data-capture="{capture}"
                      data-last="{last}" data-check="{check}"><span class="cf" data-text="{coord_file}"></span><span class="cr" data-text="{coord_rank}"></span><span class="carried" data-text="{glyph}"></span></button>
            </template>
          </div>
          <div class="pieces" data-live="piece" data-order="id.asc"
               data-on-mutation="referee" data-reads="\#(_reads)">
            <template data-item>
              <span class="pc" data-color="{color}" data-taken="{taken}" data-lit="{lit}" data-square="{square}"
                    style="--f:{file};--r:{rank}"><span class="glyph" data-text="{glyph}"></span><svg class="fig" viewBox="0 0 45 45" aria-hidden="true"><use href="#{symbol}"></use></svg><span class="ini" data-text="{initial}"></span></span>
            </template>
          </div>

          <!-- The choice, standing on the square the pawn is waiting on. A
               strip under the board asked the eye to leave the move it was
               making; this is where the pawn already is. -->
          <div class="promo" data-live="game" data-filter="current=eq.yes"
               data-promo="{promo_to}" data-turn="{turn}" style="--pf:{promo_f}"
               data-on-click="referee" data-reads="\#(_reads)"
               data-empty-row='\#(_emptyGame)'>
            <p class="promo-ask">Promote to</p>
            <button type="button" class="pick" id="promo-Q" data-on-click="referee" aria-label="Queen"><span aria-hidden="true">&#9819;</span></button>
            <button type="button" class="pick" id="promo-R" data-on-click="referee" aria-label="Rook"><span aria-hidden="true">&#9820;</span></button>
            <button type="button" class="pick" id="promo-B" data-on-click="referee" aria-label="Bishop"><span aria-hidden="true">&#9821;</span></button>
            <button type="button" class="pick" id="promo-N" data-on-click="referee" aria-label="Knight"><span aria-hidden="true">&#9822;</span></button>
          </div>

          <!-- What the house would have played instead, on a marked move of a
               reviewed game (ir decision-24). In eighths of the board as
               drawn, which the referee works out from the flip, so this
               drawing never has to know which way round the board sits. -->
          <svg class="hint" viewBox="0 0 8 8" aria-hidden="true" focusable="false">
            <defs><marker id="hint-head" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z"></path></marker></defs>
            <path class="arrow" d="{hint}" marker-end="url(#hint-head)"></path>
          </svg>
        </div>
        </div>

        <div class="seat you" data-turn="{seat_low_turn}" data-low="{seat_low_low}">
          <span class="av" data-text="{seat_low_ini}"></span>
          <span class="who">
            <b class="nm"><span data-text="{seat_low_name}"></span><span class="elo" data-text="{seat_low_elo}"></span></b>
            <span class="sub" data-text="{seat_low_line}"></span>
          </span>
          <span class="taken" data-text="{seat_low_taken}"></span>
          <b class="edge" data-text="{seat_low_edge}"></b>
          <b class="clk" data-text="{seat_low_clock}" data-text-format="clock"></b>
        </div>


        <!-- What the board's keys write. Off-screen because they are a
             keyboard's only, and inside the game so the update names its
             row (ir decision-20 — one command column, two input modes). -->
        <div class="caretf">
          <form data-form="caret-up" id="caret-up" data-entity="game" data-action="update"><input type="hidden" name="caret_go" data-value="up"><button type="submit" tabindex="-1" aria-hidden="true"></button></form>
          <form data-form="caret-down" id="caret-down" data-entity="game" data-action="update"><input type="hidden" name="caret_go" data-value="down"><button type="submit" tabindex="-1" aria-hidden="true"></button></form>
          <form data-form="caret-left" id="caret-left" data-entity="game" data-action="update"><input type="hidden" name="caret_go" data-value="left"><button type="submit" tabindex="-1" aria-hidden="true"></button></form>
          <form data-form="caret-right" id="caret-right" data-entity="game" data-action="update"><input type="hidden" name="caret_go" data-value="right"><button type="submit" tabindex="-1" aria-hidden="true"></button></form>
          <form data-form="caret-row-start" id="caret-row-start" data-entity="game" data-action="update"><input type="hidden" name="caret_go" data-value="row-start"><button type="submit" tabindex="-1" aria-hidden="true"></button></form>
          <form data-form="caret-row-end" id="caret-row-end" data-entity="game" data-action="update"><input type="hidden" name="caret_go" data-value="row-end"><button type="submit" tabindex="-1" aria-hidden="true"></button></form>
          <form data-form="caret-first" id="caret-first" data-entity="game" data-action="update"><input type="hidden" name="caret_go" data-value="first"><button type="submit" tabindex="-1" aria-hidden="true"></button></form>
          <form data-form="caret-last" id="caret-last" data-entity="game" data-action="update"><input type="hidden" name="caret_go" data-value="last"><button type="submit" tabindex="-1" aria-hidden="true"></button></form>
        </div>

        <!-- The panel beside the board: the game's heading, the review, the
             moves — the only part of the screen that scrolls — and, pinned at
             its foot, the steps, the game's actions and how it is looked at. -->
        <section class="panel">

          <header class="say">
            <p class="turn">
              <i data-w="white">White to move</i><i data-w="black">Black to move</i>
            </p>
            <!-- What the board is showing when it is not showing the game.
                 The state is already an attribute the CSS reads; without a
                 line saying so the only sign is a button appearing. -->
            <p class="past" role="status">Viewing an earlier move · ⏭︎ returns to the game</p>
            <p class="flag" role="status">
              <i class="chk">Check</i>
              <i data-e="checkmate">Checkmate</i><i data-e="stalemate">Stalemate</i><i data-e="threefold">Draw by repetition</i><i data-e="fifty-move">Draw by the fifty-move rule</i><i data-e="insufficient">Draw — too little left to mate</i><i data-e="resignation">Resigned</i><i data-e="flag">Flag</i><i data-e="agreement">Draw agreed</i>
            </p>
            <p class="won" data-text="{won}"></p>
            <p class="score" data-text="{result}"></p>
            <p class="book"><b data-text="{eco}"></b> <span data-text="{opening}"></span></p>
            <p class="offer" role="status"><i data-o="you">Draw offered…</i><i data-o="declined">The offer was declined.</i></p>
          </header>

          <!-- The review of a finished game (ir decision-24). Every column it
               binds is empty while a game is on, so on a live board this
               section has nothing in it to show. -->
          <section class="review" aria-label="Review">
            <p class="reading" role="status" data-text="{review_line}"></p>
            <!-- The strip: one column per move, as high as White's chances
                 after it. A picture of the move list below and nothing to
                 press — one column per move is narrower than a thumb in any
                 long game, and the move list is where every hand goes. -->
            <ol class="tide" aria-hidden="true" data-live="move" data-order="ply.asc"
                data-filter="game_id=eq.{id}&amp;retracted=eq.no"
                data-project='{"here":{"eq":["id","{cursor}"]}}'>
              <template data-item>
                <li data-here="{here}" data-mark="{mark}" data-tide="{tide}"><span class="tc" style="--t:{tide}"></span></li>
              </template>
            </ol>
            <p class="tide-cap">Winning chances, move by move · the higher the line, the better for White</p>
            <div class="acc">
              <span class="cap">Accuracy</span>
              <b class="nm" data-text="{seat_low_name}"></b><b class="pct" data-text="{acc_low}"></b><span class="tally" data-text="{tally_low}"></span>
              <b class="nm" data-text="{seat_top_name}"></b><b class="pct" data-text="{acc_top}"></b><span class="tally" data-text="{tally_top}"></span>
            </div>
            <div class="note" data-mark="{note_mark}">
              <p class="nh" data-text="{note_head}"></p>
              <p class="nt" data-text="{note}"></p>
            </div>
          </section>

          <!-- The sheet, and every move on it is a place you can go. It also
               carries the referee's seat, because a reading writes only move
               rows and a mutation wake is a region's own read changing: with
               no seat over `move`, the next question would wait for a beat. -->
          <ol class="moves" data-live="move" data-order="ply.asc"
              data-on-mutation="referee" data-on-click="referee" data-reads="\#(_reads)"
              data-filter="game_id=eq.{id}&amp;retracted=eq.no"
              data-project='{"here":{"eq":["id","{cursor}"]}}'
              data-key='{"ArrowLeft":"nav-back","ArrowRight":"nav-fwd","Home":"nav-first","End":"nav-live"}'
              data-empty="No moves yet.">
            <template data-item>
              <li data-color="{color}" data-here="{here}"><b class="no" data-text="{number}"></b><button type="button" class="san" data-on-click="referee"><span data-text="{san}"></span><b class="mk" data-mark="{mark}" data-text="{mark}"></b></button><span class="ms w" data-text="{white_clock}" data-text-format="clock"></span><span class="ms b" data-text="{black_clock}" data-text-format="clock"></span></li>
            </template>
          </ol>

          <div class="foot">
            <div class="nav">
              <form class="navf" data-form="nav-first" id="nav-first" data-entity="game" data-action="update">
                <input type="hidden" name="step" data-value="first">
                <button type="submit" class="act ghost" aria-label="First move">⏮︎</button>
              </form>
              <form class="navf" data-form="nav-back" id="nav-back" data-entity="game" data-action="update">
                <input type="hidden" name="step" data-value="back">
                <button type="submit" class="act ghost" aria-label="Previous move">◀︎</button>
              </form>
              <form class="navf" data-form="nav-fwd" id="nav-fwd" data-entity="game" data-action="update">
                <input type="hidden" name="step" data-value="fwd">
                <button type="submit" class="act ghost" aria-label="Next move">▶︎</button>
              </form>
              <form class="navf" data-form="nav-live" id="nav-live" data-entity="game" data-action="update">
                <input type="hidden" name="step" data-value="live">
                <button type="submit" class="act ghost" aria-label="Latest move">⏭︎</button>
              </form>
            </div>
            <!-- The game's actions, inside the game so each click names its row;
                 the game region renders its empty row before any game exists,
                 so "New game" is here even then. -->
            <div class="acts">
              <button type="button" class="act" id="btn-new" commandfor="setup-card" command="toggle-popover" aria-haspopup="dialog">New game</button>
              <!-- The next game's terms, on a card New game opens in any state
                   (ir decision-31). Its pickers bind the setup row, never the
                   game, so choosing cannot rewrite the game on the board; Start
                   is inside the game so its click reaches the referee's seat. -->
              <div class="setup" id="setup-card" popover role="dialog" aria-labelledby="setup-head">
                <p class="setup-head" id="setup-head">The next game</p>
                <div class="setup-picks">
\#(_pickerMode.markup)
\#(_pickerBot.markup)
\#(_pickerTc.markup)
\#(_pickerSide.markup)
                </div>
                <button type="button" class="act" id="btn-start" data-on-click="referee" commandfor="setup-card" command="hide-popover">Start</button>
              </div>
              <button type="button" class="act ghost" id="btn-review" data-on-click="referee">Review the game</button>
              <button type="button" class="act ghost" id="btn-resign" data-on-click="referee">Resign</button>
              <button type="button" class="act ghost" id="btn-draw" data-on-click="referee">Offer a draw</button>
              <button type="button" class="act ghost" id="btn-takeback" data-on-click="referee">Take back</button>            </div>
            <div class="pickers">
\#(_pickerSet.markup)
\#(_pickerView.markup)
            </div>
          </div>
        </section>

        <!-- The engine's seat. It renders nothing: the element exists to carry
             the props off this row and the name of the reduce the answer goes
             to. Inside the game region so the binder resolves {ask} against
             the game and wireEvents binds the listener; outside the four
             nested [data-live] beside it, which bind their own. It asks for no
             table the region does not already read — five regions share the
             referee's seat only while their data-reads agree byte for byte. -->
        <div class="engine" hidden
             data-hatch="stockfish" data-on-answer="referee"
             data-prop-game="{id}" data-prop-fen="{ask}"
             data-prop-ply="{ask_ply}" data-prop-nodes="{ask_nodes}"
             data-prop-lines="{ask_lines}"></div>

      </article>
    </template>
  </div>

</section>
"""#
