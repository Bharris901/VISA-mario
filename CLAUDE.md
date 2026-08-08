# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser-playable recreation of Super Mario Bros. World 1-1, built for a
one-day IRL scavenger hunt. A secret pipe in the last quarter of the level
leads to a hidden 8-bit "Beale Street" room with a 3-reel picture-matching
bonus game; winning it reveals a scavenger-hunt clue. All art (sprites,
landmarks) and music are original — not traced/sampled from Nintendo's game.

Full gameplay/design rationale (controls, the hidden-clue flow, deployment
steps) is in `README.md` — read that for "how it plays"; this file is about
how the code is put together.

## Commands

There is no build step, package manager, linter, or test suite — this is a
plain static site (HTML/CSS/vanilla JS, no npm dependencies, no framework).

Run it locally:
```
python3 -m http.server 8000
# open http://localhost:8000
```

There's no committed automated test suite. The practical way to verify a
change is to load it in a real (or headless) browser and drive it:
- Manually: open the page, use arrow keys/Space/Shift (desktop) to play.
- Headless smoke-testing: launch Chromium via Playwright
  (`executablePath: '/opt/pw-browsers/chromium'` in this environment),
  click `#start-btn`, then drive `Input`/`game` state directly via
  `page.evaluate()` (e.g. teleport `game.player.x/y`, force
  `game.minigame.reels[i].symbol`) rather than waiting out real gameplay —
  the whole state machine is reachable from `window.game` in dev tools.

Deployment is GitHub Pages serving the branch directly (no CI/build). One
sharp edge worth knowing: **GitHub Pages project-site URLs are
case-sensitive** in the repo-name path segment, unlike github.com's own repo
pages which are not — `https://<user>.github.io/<Exact-Repo-Case>/`.

**Cache-busting.** `index.html` loads `style.css` and every `js/*.js` file
with a shared `?v=N` query string. Bump `N` on *every* commit that touches
`style.css` or any `js/*.js` file (a simple find-and-replace across
`index.html`), even for small tweaks. This was a real issue: a CSS-only
change once failed to show up on a real phone even after reloading, because
GitHub Pages/the browser served the previously-cached `style.css` while the
freshly-fetched `index.html` showed the new markup — an unbumped version
query is invisible in testing (a fresh session/incognito load has no old
cache to hit) and only bites real users with a prior visit.

## Architecture

**No modules, no bundler.** Every file in `js/` is loaded as a plain
`<script>` tag from `index.html` (in the order listed there) and all of them
share one global scope — there's no `import`/`export`. Adding a new file
means adding a `<script>` tag for it. Because nothing but function/const
*definitions* happen at top level (aside from `level.js` baking the level
once via `buildLevel()` and `sprites.js` baking sprite canvases once), load
order mostly doesn't matter for correctness — cross-file globals are only
read inside function bodies, which run after every script has loaded.
**Gotcha already hit once:** top-level `const`/`let` (e.g. `const SPRITES =
{...}` in sprites.js) are NOT properties of `window`, unlike `var` or
function declarations — `window.SPRITES` is `undefined` even though bare
`SPRITES` works fine anywhere after sprites.js has loaded. Check for a
global's existence with `typeof X !== 'undefined'`, never `window.X`.

**Rendering & the state machine (`js/main.js`).** A single 480×288 `<canvas>`
is tile-based (`TILE = 24`px, `ROWS`/`COLS`/`GROUND_ROW` from `level.js`).
`game.state` drives both `update()` and `render()` as a simple switch:
`start → playing → pipeEnter → secretRoom → minigame → flagSlide → frozen`,
looping back to `playing` (via `resetLevel()`) on death or after the
secret-pipe payoff. `frozen` is used any time a message overlay needs the
game paused underneath it (win/lose/flagpole messages) — check that state
before wiring up new transitions so gameplay doesn't keep running behind an
overlay. `flagSlide` interpolates the player from wherever they touched the
pole down to standing height over `SLIDE_MS`; `finishFlagpole()` (called
once the slide completes, not the instant the pole is touched) is where
music stops, fireworks spawn, and the win/lose message is scheduled.

**Music start/stop/restart.** Only call `restartLevel()` (stops+restarts
music, then calls `resetLevel()`) from a button that represents "start
fresh" (death's Start Over, the flagpole's Play Again). The mini-game win
message's continue button calls neither — it resumes play in place at the
secret pipe, so it must never stop or restart the music.

**Frame-rate independence (`dtScale`).** Physics constants in `physics.js`
(`PHYS.*`) are tuned as "per 1/60s frame" deltas. Every place that applies
them (`updatePlayer`/`updateEnemy`/`updateMushroom` in `entities.js`)
multiplies by `dtScale = dt / FRAME_MS` first. This was a real, previously
broken invariant (physics used to advance one frame's-worth of motion per
*rendered* frame, so the game silently ran faster on 90/120Hz phones) — any
new movement/timer code must scale by `dtScale` (or use real `dt` in ms) to
stay correct across devices, not add raw per-frame constants.

**Level data (`js/level.js`).** `buildLevel()` procedurally constructs an
*original* tile layout designed to feel like classic World 1-1 (not copied
level data) and returns `{ grid, SECRET_PIPE_COL, FLAG_COL, FLAG_TOP_ROW }`.
Tile characters are documented at the top of the file (`'#'` ground, `'?'`
question block, `'B'` brick, `'T'/'U'` pipe caps, `'g'/'h'` the *secret*
pipe's caps, `'F'` flagpole, etc.). `main.js` deep-copies the initial grid
into `ORIGINAL_GRID` at load and calls `resetLevelTiles()` on every level
reset, so broken bricks/used blocks correctly restore each playthrough.
`MUSHROOM_COL_1`/`MUSHROOM_COL_2` mark the two `'?'` columns that spawn a
mushroom instead of a coin (growth if Mario is small, 1-up if already big -
decided in `entities.js`'s `onHeadBump` at hit-time, not baked into the
level).

**Enemy spawn placement (`groundSurfaceRowAt`).** Spawn columns in
`ENTITY_SPAWNS` aren't all flat ground (some sit on stair terrain, and some
columns also have unrelated floating blocks above them, e.g. col 63 has
both a floating brick and a ground-level goomba spawn). `groundSurfaceRowAt`
finds the correct resting row by scanning **up from the floor** through the
contiguous solid stack, not top-down from row 0 — a top-down scan would stop
at the first solid tile in the column, which can be a floating block well
above the real ground, and misplace the entity up there (this was a real
bug: a goomba spawned embedded in/against a stair step and read as floating
next to a wall).

**Enemy patrol movement (`updateEnemy` in `entities.js`).** A goomba's
authoritative direction/speed live in `e.dir` (±1) and `e.moveSpeed` (always
positive) - `e.vx` is *derived* fresh from `dir * moveSpeed` every frame,
never read back as state. This was a real bug fixed the hard way: the
original code inferred a wall hit by comparing intended vs. actual
displacement after calling `moveAndCollide`, which had already zeroed
`e.vx` as a side effect of resolving that same collision. Reversing an
already-zeroed value (`0 * -1 = 0`) silently did nothing, so if the
displacement-heuristic ever missed by one frame, that enemy was stuck at
`vx = 0` forever with no way to recover. `isWallAhead(e, dir)` now checks
the tile grid directly *before* moving and flips `e.dir`, so movement never
depends on reading back a value `moveAndCollide` can clobber. Apply the same
pattern (check-before-move, never re-derive direction from post-collision
velocity) to any new patrolling entity.

**Sprites (`js/sprites.js`).** Every sprite is hand-authored as an array of
strings (one char per pixel, mapped through a palette in `PAL`) and baked
once into an offscreen canvas via `bakeSprite`/`M()` at native resolution
(`PX = 1`). Render code scales up at draw time (see `MARIO_DRAW_SCALE` in
`main.js`) rather than baking at a larger size. **Gotcha already hit once:**
all frames of the same character (stand/walk1/walk2/jump) must share the
same row/column count with no dead padding rows — a mismatch reads as the
character floating or resizing between frames, since draw size/offset is
derived from each sprite's actual canvas dimensions.

**Secret room + memory-matching mini-game.** `secretRoom.js` draws the Beale
Street scene's backdrop as a real photo (`assets/beale-street-bg.png`, "cover"
-fit via `drawBealeBackground()`) plus a *procedurally* drawn (not baked
pixel-sprite) big Mario and word-wrapped speech bubble — `drawBealeMario()`
and `drawSpeechBubble()`. Mario is drawn much larger here (`BEALE_MARIO_HEIGHT
= 92`, vs. `MARIO_DRAW_SCALE` elsewhere) and with smooth arc/roundRect
primitives rather than a blown-up tiny sprite, specifically so he reads
clearly against the photo's realistic proportions (the stone
railing/sidewalk in the image is the scale reference). `minigame.js`
implements the 20-card (10-pair) memory match itself: `CARD_ICONS` +
`drawCardIcon()` (a 10-case switch, one procedurally-drawn Memphis icon per
case — University of Memphis, Grizzlies, Redbirds, Elvis, the Pyramid, the
Peabody duck, a Beale St. guitar, the M bridge, the Lorraine Motel sign, St.
Jude) is the single place to change icon art; `createMemoryGame()`/
`handleCardTap()`/`updateMemoryGame()` run the flip/match/mismatch logic. A
matched pair doesn't stay put or stack on itself — both cards slide to a
shared `mg.pileX`/`mg.pileY` spot in the leftover margin to the left of the
grid (a small deterministic per-pair jitter keeps it looking like a messy
stack rather than one aligned block), so every match grows the same pile.
`startTreasureBurst()`/`updateTreasureBurst()` run the physical
scatter-the-cards-and-arc-the-chest-to-the-ground simulation once the 10th
pair is found — the chest's start position is that same pile spot, so it
visibly bursts out from behind the pile rather than from empty space.

This is orchestrated as a sub-state-machine layered under the existing
top-level `game.state` values, so the top-level switch in `main.js` didn't
need new cases: `game.beale.phase` walks `'fall' → 'bubble' → 'grid' →
'burst' → 'walk' → 'open'` while `game.state` stays `'secretRoom'` for the
fall-in/speech-bubble intro, then `'minigame'` for everything from the card
grid through the chest opening (`updateBealeIntro()`/`updateBealeGame()` in
`main.js` drive those two phases-of-phases respectively). Card taps are
handled directly off a `canvas` `click`/`touchstart` listener
(`handleBealeCanvasTap()`, wired in `boot()` via `initBealeCardInput()`)
rather than through the `Input` object, since flipping a card is "tap that
card" not "hold a direction/button" — coordinates are rescaled from
client-space to the canvas's internal 480×288 space via
`canvasCoordsFromClient()`, which any future canvas-tap interaction should
reuse. **Gotcha already hit once:** naively scaling by
`rect.width`/`rect.height` from `getBoundingClientRect()` is *not* enough,
because `#game` is styled `object-fit: contain` (see `style.css`) — whenever
the on-screen aspect ratio doesn't exactly match 480×288 the canvas is
letterboxed, so its element box is bigger than the actual visible/scaled
bitmap inside it, and every tap is off by however wide the bars are (worst
right at the edges — this is exactly why the leftmost/rightmost card columns
were the least reliable to tap). `canvasCoordsFromClient()` computes the
letterbox offset itself before rescaling.

The 'walk' phase is the one moment the on-screen D-pad
reappears inside the secret scene (`body.beale-walk` in `style.css` overrides
the otherwise-blanket `body.secret-scene` D-pad/JUMP/DESCEND hide) so the
player can steer Mario to the landed chest with ordinary
left/right — `updateBealeGame()`'s `'walk'` branch is deliberately a tiny
bespoke horizontal-only mover, not a call into `updatePlayer()`, since nothing
about jumping/gravity/collision applies in this scene. The final "chest
opens, message pops out" beat (`drawBealeMessageCardOpen()`, `'open'` phase,
`b.openT` 0→1) is two canvas-drawn sub-stages, not an attempt to keep the
whole thing on canvas forever: first a small white card twirls (spins +
grows) from the chest to screen center (`openT` 0→`BEALE_CARD_TWIRL_END`),
then it grows the rest of the way to fill the screen while its fill color
crossfades from card-white to the DOM `#message-overlay`'s own near-black
background — so the handoff to the real `UI.showMessage()` overlay (fired
the instant `openT` reaches 1) reads as one continuous motion with no color
flash, while the actual clue text still gets to live in the DOM overlay
where it stays readable/reflowable.

**Audio (`js/audio.js`).** A single `Sfx` IIFE wraps WebAudio: one-shot SFX
via `tone()`/`slide()`, plus a lookahead-scheduled background music loop
(`startMusic()`/`stopMusic()`, `toneAt()` scheduling at absolute
`AudioContext` times to avoid `setTimeout` drift). The `AudioContext` is only
created/resumed on `unlock()`, called from the start-button tap handler in
`main.js` — mobile browsers block audio before a user gesture, so don't move
audio init earlier than that tap.

**Stomp detection (`checkEnemyCollisions` in `main.js`).** A stomp is
"falling, and `p.prevBottom <= e.y`" — `prevBottom` is the player's
feet-position captured at the *start* of `updatePlayer`, before that frame's
move, so it reflects where Mario was a moment ago rather than how deep this
frame's overlap happens to be. Two earlier versions of this check compared
overlap depth after the fact instead (first a flat `< 10px`, then
`<= half the enemy's height`) and both were flow-rate-dependent bugs: at
high fall speed (terminal velocity is 11px/frame) it's possible to step
clean over a several-pixel detection window in a single frame depending on
sub-pixel alignment - roughly 1 in 8 fast falls tunneled through in testing,
landing squarely on a goomba but resolving as a side hit (enemy survives,
Mario takes damage). Comparing against the previous frame's position side-
steps that entirely, since it doesn't matter how far Mario moved this frame.
Apply the same "compare against last frame's state" pattern rather than an
instantaneous-distance heuristic for any future contact-direction check.

**Key config knobs a task will usually touch:**
- `CLUE_MESSAGE`, `BEALE_SPEECH_TEXT`, `NOT_FOUND_MESSAGE`,
  `FOUND_BUT_FINISHED_MESSAGE` — top of `main.js`.
- `CARD_ICONS`/`drawCardIcon()` — `minigame.js` (mini-game card art).
- `PHYS.*` — `physics.js` (movement/jump tuning; remember the dtScale note
  above when changing anything here). There's a single ground speed
  (`WALK_MAX`/`WALK_ACCEL`) - no run/speed-tier button.

**Design invariant to preserve:** there is no game-over state. Every death
path funnels through `world.onPlayerDeath(reason)`, which shows a "Try again
Memphis Mario!" message (via `UI.showMessage`, with the grimace-face icon)
whose button calls `resetLevel()` — it always restarts the level rather than
ending play. There is no invincibility/assist mode (removed) - enemies
always damage the player normally regardless of death count. Keep this
behavior in mind before adding any new failure state.
