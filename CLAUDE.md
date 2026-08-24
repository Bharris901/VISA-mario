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

**Canvas fills the viewport, cropped rather than letterboxed
(`fitCanvas()`/`CANVAS_MAX_CROP_ASPECT` in `main.js`, `#game` in
`style.css`).** `#game` is styled `object-fit: cover; object-position:
center bottom` rather than the more typical `contain` - on any aspect ratio
wider than the canvas's internal 480:288 (every phone in landscape, worse
once the browser's own chrome eats into the available height), `contain`
would show black pillarbox bars on the sides; `cover` instead scales the
canvas up until it fills the element completely and crops whichever
dimension overflows - on a wide viewport that's the *height*, and
`object-position: center bottom` anchors that crop to the top (so it's sky
that gets trimmed away, not the ground/gameplay). This was a real reported
issue: a player's phone left enough Safari chrome on screen that `contain`'s
letterbox bars ate a large chunk of the already-short viewport.

**Gotcha already hit once:** an *uncapped* cover crop is dangerous - on an
extreme enough aspect ratio (a lot of browser chrome, or just a very wide
phone) the crop can remove enough of the canvas's top to push on-canvas UI
positioned there (the Beale scene's card grid sits in the upper-middle of
the screen) off-screen entirely - not just visually cropped but physically
untappable, since no on-screen pixel maps to that canvas-internal position
anymore. `fitCanvas()` caps this: past `CANVAS_MAX_CROP_ASPECT` (2.0), it
narrows the canvas *element* itself (via an inline `style.width`, recomputed
on `resize`/`orientationchange`) so the crop amount never exceeds what the
cap allows, letting `#game-wrap`'s flex-centering show plain (much
thinner-than-`contain`-would-have) pillarbox bars for any excess beyond that
cap instead of cropping further. `canvasCoordsFromClient()` (used for every
canvas-tap interaction, see the Beale/mini-game section below) had to be
rewritten for this cover-fit math - the offsets it computes can come out
*negative* now (the bitmap overflowing the element box), unlike the old
`contain` version where they were always >= 0 (letterbox bars).

**"Add to Home Screen" for a chrome-free view.** No meta tag or JS can force
Safari/Chrome to hide their own tab bar/URL bar during normal in-tab
browsing - that's a hard platform restriction. The `apple-mobile-web-app-*`
meta tags and `manifest.json` (both referenced from `index.html`'s `<head>`)
don't change that; what they do is make it so that *if* a player uses
"Add to Home Screen" first, launching the game from that new home-screen
icon opens it standalone with no browser UI at all, instead of just another
regular tab. See the README's "Tip for a chrome-free full screen" note,
which is the actual instruction to give participants - this is opt-in per
player, not automatic. `assets/icons/` holds the generated icon PNGs (a
version of the growth-mushroom sprite on the game's sky-blue, baked at a
few sizes for `apple-touch-icon`/`manifest.json`/favicon use).

**Music start/stop/restart.** Only call `restartLevel()` (stops+restarts
music, then calls `resetLevel()`) from a button that represents "start
fresh" (death's Start Over, the flagpole's Play Again). The mini-game win
message's continue button doesn't call it either — it resumes play in
place at the secret pipe, not a fresh level, so it must never *restart*
the main theme from the top. It does, however, explicitly `startMusic()`
there, because by that point the main theme was deliberately paused (see
below) for the Beale scene's own music - that's a resume, not a restart.

**Two separate music loops, never both at once.** `Sfx.startMusic()`/
`stopMusic()` is the main level's looping theme (Ground Theme).
`Sfx.startMiniGameMusic()`/`stopMiniGameMusic()` (`js/audio.js`) is a
second, independent loop (Underwater Theme) that exists solely for the
Beale Street card-matching grid. `main.js` pauses one before starting the
other so they never overlap - and unlike the mini-game's *card* logic, this
swap is *not* tied to the tap-to-begin gesture: `updateBealeIntro()`'s
`'fall'` branch calls `stopMusic()` + `startMiniGameMusic()` the instant
Mario and the chest finish landing (both play under the speech bubble,
before the grid ever appears). Finding the 10th pair calls
`stopMiniGameMusic()` + `Sfx.finalMatchTheme()` (a one-shot sting, not a
loop - see below) in `handleBealeCanvasTap()`, alongside
`startCardScatter()`'s short procedural celebration cue; the clue message's
continue button calls `startMusic()` to bring the main theme back once play
resumes. `resetLevel()` also calls `stopMiniGameMusic()` defensively in
case a reset ever happens mid mini-game.

**Real MP3 music tracks, not procedural loops.** Both loops above, plus
three one-shot musical stings (`Sfx.deathJingle()` on death,
`Sfx.gameOverTheme()`/`Sfx.levelCompleteTheme()` at the flagpole depending
on `game.clueFound`, and `Sfx.finalMatchTheme()` on the mini-game's 10th
match), are real user-provided `assets/music-*.mp3` files, not the
oscillator-generated tones the rest of `js/audio.js` still uses for every
other SFX. `Sfx.loadMusicTracks()` (called once from `boot()`, not awaited)
fetches and `decodeAudioData()`s all six into `AudioBuffer`s as early as
possible, well before the start-button tap - decoding doesn't need a
resumed `AudioContext`, only *playback* does, so this doesn't violate
mobile autoplay rules. Loops play via `AudioBufferSourceNode` with
`loop = true` rather than a plain `<audio loop>` element specifically for
gapless looping: MP3 encoders commonly pad a file with a few ms of silence
at the start/end, which is audible as a click at the loop seam with
`<audio loop>` but not with a looped decoded buffer. **Gotcha to watch
for:** a `startMusic()`/`startMiniGameMusic()` call can arrive before its
file has finished decoding (a fast tap on a slow connection) - `desiredGround`/
`desiredUnderwater` track what *should* be playing, and `tryStartPending()`
(called every time a track finishes decoding) starts it then if it's still
wanted, so the request isn't silently dropped.

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

**High/low route choices (`platform()` in `level.js`).** Two spots let the
player choose between an elevated bypass and the plain ground route:
`platform(c0, c1, row, gaps)` lays down a one-tile-thick floating run (not
connected to the ground, unlike `solidGround()`) with specific columns left
open so crossing it takes a real jump rather than just walking straight
across. Choice #1 (cols 75-90, row 6) continues the existing small hill's
own peak height across pit B *and* a 3-goomba cluster just past it, with a
3-tile gap (cols 83-85, matching pit B's own span exactly) right over the
pit's own void and two bonus `'?'` blocks; choice #2 (cols 160-172, row 6)
is a plain-ground equivalent with a 4-tile gap (cols 165-168), bypassing a
4-goomba cluster below. Both gaps now need the same genuine running
jump - empirically tested in-engine (a real running start, full-height
jump, no early release): 3- and 4-tile gaps are both consistently
clearable, a 5-tile gap is not (the player falls in every time), so 4 tiles
is the widest gap anywhere in this level, on a platform or in a pit.
Missing either gap's jump drops the player through to whatever's below (the
pit, in choice #1's case) - a real, if forgiving, cost for going high. The
low route in both cases is just the unmodified original path.

**Enemy clustering (`ENTITY_SPAWNS` in `level.js`).** Three spots
deliberately place goombas close together (cols 87/89/91, right under
high/low choice #1's bypass; cols 133/136/139, right before the widened
pit C; cols 160/163/167/170, right under high/low choice #2's bypass)
instead of the otherwise-even single-goomba spacing used everywhere else,
so there's a genuine "time this jump/approach right" moment at those spots
rather than uniform one-at-a-time encounters throughout the level. All
three sit directly beneath a high-route bypass, so the elevated path is
also how a player avoids the cluster entirely, not just a shortcut.

**Pit widths (`pits` in `level.js`'s `buildLevel()`).** Alternates 4/3/4
tiles wide rather than uniform, so each pit still takes a real running jump
but they don't all feel identical. The middle pit is 3 tiles specifically
so it lines up exactly with high/low choice #1's bridge gap, which spans
this same pit. (Same in-engine jump testing as the platform gaps above
confirmed 4 tiles is the widest jumpable gap, so no pit exceeds that.)

**End-of-level scenery (`drawEndPyramid` in `main.js`).** Past the flagpole
there's no tile structure at all (no more `'C'` castle-block tiles - the
flagpole always captures the player first, so it was always purely
decorative and never actually reachable/collidable). Instead
`drawEndPyramid()` draws a real image, `assets/card-pyramid.png` - the same
file the memory game's Pyramid card already loads via `cardPhotoImages`/
`cardPhotoLoaded` in `minigame.js`, not a second copy of the art - scaled to
`END_PYRAMID_HEIGHT` and left unsmoothed (unlike the Beale scene's real
images) since it's itself pixel art and should render crisp/blocky like the
rest of the level. **Gotcha already hit once:** that file has an *opaque*
white background baked in (it was made to sit on a card's own white face,
not against open sky) - drawing it directly showed a glaring white box
behind the pyramid. `getEndPyramidCanvas()` chroma-keys the near-white
background to transparent once into a cached in-memory canvas; the actual
asset file on disk is never touched. **Gotcha already hit once:** that same
source image also has a few px of that near-white margin *around* the
pyramid itself, on every side - scaling/positioning off the raw image's own
width/height (rather than the chroma-keyed content's own tight bounding
box) leaves that bottom margin between the pyramid's actual visual base and
the ground line, reading as "floating" instead of sitting on the ground.
`getEndPyramidCanvas()` now also computes `endPyramidBBox` (the tight
content bounding box, found while scanning pixels for the chroma-key above)
once alongside the transparent canvas, and `drawEndPyramid()` draws that
sub-rect (via the 9-argument `drawImage()`) instead of the whole canvas, so
its bottom edge is the pyramid's actual base, not wherever the source
image's own canvas happens to end.

**Flagpole (`flagpoleTile`/`flagSprite`/`ballSprite` in `sprites.js`,
flag-related code in `main.js`).** Redesigned to match a reference image: a
brighter green pole/ball (own dedicated `PAL.flagpole`, so it doesn't affect
`PAL.misc`'s green bushes), a black-outlined ball, and an actual triangular
pennant (baked at 24x14, matching its draw size for a clean 1:1 blit) in
place of the old bordered-rectangle flag. The pennant now also *moves*:
`game.flagY` tracks its own descent, entirely independent of wherever Mario
actually grabbed the pole - it always starts at `FLAG_TOP_Y` (reset there in
`resetLevel()`/`checkFlagpole()`) and both it and the player move during the
`'flagSlide'` state at the exact same `FLAG_SLIDE_SPEED` (px/ms, derived
from how long a full-height slide should take). Since the flag's distance
to travel is fixed (always from the top) while Mario's varies with wherever
he actually grabbed, this one shared speed is what makes grabbing near the
top land them together and grabbing lower down land Mario first, with the
flag clamped in place once each of them individually reaches their own
resting `Y` - the state doesn't advance to `finishFlagpole()` until *both*
have arrived, not just Mario.

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

**Mario's sprites (`marioSmallStand`/`marioBigStand`/etc. in `js/sprites.js`).**
Redesigned to match a higher-detail reference image (rounder cap/head
silhouette, a distinct mustache, a more natural walking stride) at a higher
native resolution than the rest of this file's art: small is 18x18 (was
16x14), big is 20x36 (was 16x18/20). They were derived from the reference
image itself - cropped to each of the 8 poses, downsampled with a
majority-vote pool to the target resolution, and quantized to 3 flat colors
(no black outline/shading in the source art) - rather than hand-typed from
scratch, so the shapes stay faithful to the reference. They use their own
palette, `PAL.heroMario` (`'g'`/`'r'`/`'k'` = overalls-or-shirt green /
cap-or-overalls red / skin tan) - a dedicated palette rather than a shared
one, since the growth/1-up mushroom sprites are unrelated art with their
own reference image and their own palette (`PAL.mushroom`, see below).
Each of the 8 poses is its own independent grid rather than sharing a common
head/torso prefix (the old small-file's `bigFrame()` helper) - the new
poses lean and shift enough through the shoulders that no shared prefix fits
all four frames anymore. `MARIO_DRAW_SCALE` (`main.js`) is `1` (was `1.5`
before this redesign, briefly `5/6` right after it to compensate for the
higher native resolution and keep big Mario's on-screen height unchanged,
then bumped back up to `1` on top of that - reference screenshots showed
Mario reading a little small next to the pipes, and since pipes/tiles were
staying the same size, Mario alone needed to grow). Small Mario ends up
proportionally smaller relative to big Mario than he used to be pre-redesign
(closer to the reference art's own size ratio between the two), independent
of this overall scale bump - both sizes grew by the same factor.

**Goomba's sprites (`goombaWalk1`/`goombaWalk2`/`goombaSquish` in
`js/sprites.js`).** Redesigned the same reference-derived way as Mario
(classified to the reference image's own 3 flat colors - dark brown head,
tan face/snout, black eyebrows/eyes/feet - then downsampled with a
majority-vote pool), but baked at exactly 18x16 rather than a larger size:
unlike Mario, `drawEnemies()` (`main.js`) always draws a goomba at a fixed
`e.w + 2` x `e.h` regardless of the sprite's own canvas dimensions, so
baking any bigger would just be downsampled away at draw time for no
visual benefit - 18x16 *is* that fixed draw size, so the bake is an exact
1:1 blit with no scaling at all. `goombaWalk2` is `goombaWalk1` with the
foot row shifted one column for a subtle step; `goombaSquish` reuses the
head/face rows (no feet) compressed into the bottom of the same 18x16
canvas, matching the original squish sprite's approach.

**Mushroom power-ups (`mushroomSprite`/`mushroom1upSprite` in
`js/sprites.js`).** Same reference-derived redesign again (orange/tan cap
with dark red spots, white stem), baked at exactly 16x16 for the same
"matches the fixed draw size, so it's a 1:1 blit" reason as the goomba -
`drawMushrooms()` (`main.js`) always draws at a fixed 16x16 regardless of
the sprite's own canvas size. Both mushrooms now share a dedicated
`PAL.mushroom` palette instead of the old `PAL.mario` (which is gone
entirely - nothing else used it once Mario's own sprites moved to
`PAL.heroMario`). The 1-up variant reuses the exact same silhouette
recolored green, but - unlike a straight color swap - its spot regions map
to a *darker* green (`'d'`) rather than collapsing to flat green, so the
cap keeps a highlight/shadow look instead of going flat; this preserves the
established convention that 1-up has no literal red spots while still
getting the redesign's shape detail.

**Question block (`questionBlock` in `js/sprites.js`).** Same
reference-derived redesign approach again (classify to the reference's own
3 flat colors - yellow fill, orange corner bolts, white "?" mark, no black
anywhere - then downsample with a majority-vote pool), baked at 16x16.
`PAL.qblock` was updated to these 3 tones (dropped the old 4th "cream"/`'k'`
tone and the separate dark-brown bolt-outline `'b'` tone - the reference art
doesn't have either). The tile is now fully opaque edge-to-edge (no
transparent corner pixels like the old hand-typed version had) since the
reference shows a solid square block with no rounding baked into the tile
art itself.

**Brick block (`brickTile` in `js/sprites.js`).** Also redesigned to match
a reference image (bold black outline + black mortar lines on a brown
brick fill, classic running-bond layout - alternating rows of 2 full bricks
/ 3 bricks with half-width ones at each end), but built *geometrically*
rather than downsampled from the photo like the others above: that
reference's mortar lines were soft/blurry (a photographed or rendered
image, not flat cel-shaded art like the goomba/mushroom/question-block
references), and downsampling blur straight into a 16x16 grid produced
muddy, inconsistent line thickness rather than the crisp black lines the
reference is clearly going for. `PAL.brick` dropped its old 2-tone (no
black) look for a `'r'` fill + `'k'` mortar/outline pair. The reference
image also had a thin blue sliver bordering one edge (an artifact of
whatever tool produced it) - per instruction, that's not reproduced; only
black and brown appear in the tile.

**Pipe art (`pipeTop`/`pipeBody` in `js/sprites.js`).** Unlike most other
sprites, these are baked at native SCREEN resolution (`PIPE_W = 48`/`PIPE_H
= 24`, matching `TILE*2`/`TILE` from `level.js` - written as literal
numbers rather than references to `TILE`, since `sprites.js` loads *before*
`level.js` and can't read its top-level `const` yet) rather than being
baked small and scaled up, so the black outline/color bands/crosshatch
texture stay crisp instead of blocky. `PIPE_BANDS` lists the vertical color
bands left-to-right (a thin dark stripe, a highlight, a divider, another
highlight, a flat matte mid-green, then a crosshatch band resolved
per-pixel in `pipeColorAt()`); `pipeRow()` applies the black border/lip on
top of that. The body is baked as ONE double-wide image spanning both tile
columns a pipe occupies (like the cap already was) so the band/crosshatch
pattern reads as one continuous tube rather than a mirrored/repeated pair -
`level.js`'s `pipe()` now writes distinct left/right body tile chars
(`'P'`/`'Q'`, or `'G'`/`'H'` for the secret pipe) the same way the cap
already had distinct `'T'`/`'U'` (`'g'`/`'h'`) chars, and `isPipeBodyLeft()`
(`level.js`) plus the `'Q'`/`'H'` → `null` cases in `tileSprite()`
(`main.js`) mirror the existing `isPipeCap()`/`'U'`/`'h'` pattern exactly.
The cap's bottom rows are black (a 3px lip) while the body has **no**
top/bottom border at all - only left/right edges - so stacking multiple
body tiles for a taller pipe reads as one seamless tube with no repeating
horizontal "rung" line at each tile boundary. The secret pipe reuses the
exact same sprites as a normal pipe (only the tile *characters* differ, not
the art), so the "must look identical, by design" invariant holds
automatically - verified visually side-by-side after this redesign.

The cap also overhangs the body by `PIPE_CAP_OVERHANG` (4) px on each side
- a little lip ledge, matching the reference art - which is why it's baked
at `PIPE_CAP_W` (56, wider than the body's 48) rather than sharing one width
with the body: `PIPE_CAP_BANDS` (`widenOutermostBands()`) reuses the body's
`PIPE_BANDS` widened only at the two outer bands to absorb the extra width,
so the same band pattern lines up in the middle. This is purely a wider
*sprite*, not a wider *tile* - `drawLevel()` (`main.js`) draws the cap
shifted left by the overhang and wider by twice the overhang, while the
underlying tile grid/collision (`isSolid()`, entry detection) still only
ever see the normal 2-tile-wide cap columns, so it doesn't affect gameplay,
just the pixels drawn on top.

**Secret room + memory-matching mini-game.** `secretRoom.js` draws the Beale
Street scene's backdrop as a real photo (`assets/beale-street-bg.png`, "cover"
-fit via `drawBealeBackground()`), plus real static images for Mario
(`assets/beale-mario.png`) and the treasure chest, closed/open
(`assets/chest-{closed,open}.png`) via `drawBealeMario()`/`drawBealeChest()`.
None of the three ever move, animate frame-to-frame, or change pose in this
scene - Mario has no walk/fall/stand poses here at all (unlike his usual
baked pixel sprite elsewhere in the game) since he's a single static image
that just falls in and sits; the chest only ever swaps wholesale between its
closed and open image. `BEALE_MARIO_HEIGHT = 92` and `BEALE_CHEST_HEIGHT =
48` set their on-screen scale (tall enough to read against the photo's
stone-railing/sidewalk proportions); `bealeMarioDrawWidth()`/
`bealeChestDrawWidth()` expose their actual on-screen width at a given
height (from each image's own aspect ratio) for `minigame.js`'s grid layout
to query rather than hardcoding a guess (see below).

**Gotcha already hit once: real (non-pixel-art) images need smoothing
re-enabled, twice.** `main.js` sets `ctx.imageSmoothingEnabled = false`
globally, and `style.css` sets `#game { image-rendering: pixelated }`, both
so the game's pixel-art tiles/sprites stay crisp - but the same two settings
make any *photo or real image* drawn into the canvas look blocky/aliased
when scaled, since nothing ever re-enabled smoothing for it. Every real
image draw (the Beale backdrop, Mario, the chest, and the ten real card-icon
photos below) wraps its `drawImage()` call in `save()`/`imageSmoothingEnabled
= true` + `imageSmoothingQuality = 'high'`/`restore()` so just that call
gets smooth interpolation - smoothing has no effect on path/arc/roundRect
fills, so nothing else needs to change. `render()` in `main.js` also toggles
`canvas.style.imageRendering` between `'pixelated'` (normal gameplay) and
`'auto'` (the whole Beale scene, which never draws any pixel-art tiles) so
the *browser's* upscale of the canvas element to its on-screen size is
smooth too - the per-`drawImage` fix alone isn't enough, since that CSS
property scales the whole already-rendered canvas afterward regardless of
how any individual draw call was done. Apply both halves of this pattern to
any future real-image asset added to the canvas.

`minigame.js` implements the 20-card (10-pair) memory match itself:
`CARD_ICONS` + `drawCardIcon()` (a 10-case switch, one Memphis icon per
case — University of Memphis, Grizzlies, Redbirds, Elvis, the Pyramid, the
Peabody duck, a Beale St. guitar, the M bridge, the Lorraine Motel sign, St.
Jude) is the single place to change icon art. All ten have real
user-provided artwork — `CARD_PHOTOS` maps every id to its
`assets/card-*.png` file, `loadCardPhotos()` (called from `boot()`) preloads
them, and `drawCardIcon()` draws whichever's ready "contain"-fit (whole
image visible, no cropping, unlike the backdrop's "cover" fit) with
smoothing scoped on per the gotcha above; the original procedural
switch-case is kept in full and now only ever renders as a brief fallback
for an icon whose image hasn't finished loading yet.

Mario (left) and the chest (right) both land in fixed spots and never move
again for the rest of the mini-game, so the card grid has to fit in the
strip between them without ever overlapping either - **gotcha already hit
once:** a hardcoded 5-col grid sized/centered independently of where Mario
and the chest actually landed visibly overlapped the chest once the chest
became a fixed real image instead of something that only appeared later.
`createMemoryGame()` now takes Mario's and the chest's actual positions and
*derives* the grid: 4 columns × 5 rows (still 20 cards, just narrower/taller
than the old 5×4), with card size computed from however much width is
actually left between `bealeMarioDrawWidth()`'s/`bealeChestDrawWidth()`'s
clearances - never a hardcoded size that could silently start clipping one
of them if a position or asset size ever changes. The pile of matched cards
still builds up directly above Mario's head (`pileY = marioTopY - cardH -
10`) via `handleCardTap()`'s stacking logic in the same function.

This is orchestrated as a sub-state-machine layered under the existing
top-level `game.state` values, so the top-level switch in `main.js` didn't
need new cases: `game.beale.phase` walks `'fall' → 'bubble' → 'grid' →
'burst' → 'open'` while `game.state` stays `'secretRoom'` for the
fall-in/speech-bubble intro, then `'minigame'` for everything from the card
grid through the chest opening (`updateBealeIntro()`/`updateBealeGame()` in
`main.js` drive those two phases-of-phases respectively). `'fall'` animates
*both* Mario and the chest dropping in from the top together (independent
fall physics per object, rather than assuming they always land in lockstep,
even though they currently share identical start height/speed and so do
land at the same instant) - `Sfx.thud()` fires once both have touched down.
The `'bubble'` phase has no timer — it waits indefinitely; a tap anywhere on
screen (not just on Mario) dismisses the speech bubble and starts the grid,
so `updateBealeIntro()`'s `'bubble'` branch is a no-op and the actual
transition lives in `handleBealeCanvasTap()`. Card taps (and that
bubble-dismissing tap) are handled directly off a `canvas`
`click`/`touchstart` listener (`handleBealeCanvasTap()`, wired in `boot()`
via `initBealeCardInput()`) rather than through the `Input` object, since
tapping is a fundamentally different interaction than "hold a
direction/button" — coordinates are rescaled from client-space to the
canvas's internal 480×288 space via `canvasCoordsFromClient()`, which any
future canvas-tap interaction should reuse. **Gotcha already hit once:**
naively scaling by `rect.width`/`rect.height` from `getBoundingClientRect()`
is *not* enough, because `#game` is styled `object-fit: cover;
object-position: center bottom` (see `style.css` and the "Canvas fills the
viewport" section below) — whenever the on-screen aspect ratio doesn't
exactly match 480×288, the canvas's element box and its actual visible/
scaled bitmap differ (the bitmap is *larger* than the box and gets cropped,
the reverse of the `object-fit: contain` letterboxing this used to be), and
every tap is off by however much is cropped (worst right at the top/edges —
this is exactly why the top-row/leftmost/rightmost card cells were the least
reliable to tap before this was fixed). `canvasCoordsFromClient()` computes
that cover-fit offset itself (which comes out *negative*, since the bitmap
overflows the box) before rescaling.

Finding the 10th pair moves to `'burst'`: the matched cards fly apart from
the pile (`startCardScatter()`/`updateCardScatter()` in `minigame.js` - pure
card physics now, no chest involved) while the chest - untouched, still
sitting exactly where it landed - shakes with rising intensity
(`bealeChestShakeAngle()`, a sine wiggle whose frequency/amplitude both ramp
up) starting at `BEALE_CHEST_SHAKE_START_MS` and "pops" open (image swap +
a brief scale-punch via `bealeChestPunchScale()`/`b.chestPopT`, plus real
fireworks via the same `world.spawnFireworks()`/staggered-`setTimeout`
pattern `finishFlagpole()` uses) at `BEALE_CHEST_POP_MS` - about 3s total
from the last match, tuned to that pacing rather than tied to any physical
event finishing (there's no more "wait for the chest to land/arrive"
condition now that it's fixed in place the whole time). **Gotcha already hit
once:** `renderSecretScene()` never called `drawParticles()` at all, so
*no* particle effect - not the per-match confetti bursts, not these
fireworks - was ever actually visible in this scene despite the code
spawning them correctly; every phase branch that can have live particles now
calls `drawParticles(0, dt)` (camX=0 since this scene has no camera
scroll) itself.

The final "chest opens, message pops out" beat
(`drawBealeMessageCardOpen()`, `'open'` phase, `b.openT` 0→1) is two
canvas-drawn sub-stages, not an attempt to keep the whole thing on canvas
forever: first a small white card twirls (spins + grows) from the chest to
screen center (`openT` 0→`BEALE_CARD_TWIRL_END`), then it grows the rest of
the way to fill the screen while its fill color crossfades from card-white
to the DOM `#message-overlay`'s own near-black background — so the handoff
to the real `UI.showMessage()` overlay (fired the instant `openT` reaches 1)
reads as one continuous motion with no color flash, while the actual clue
text still gets to live in the DOM overlay where it stays readable/
reflowable. Because Mario and the chest are both fixed the whole game now,
there's no player-controlled "walk to the chest" sub-phase anymore (there
used to be one) and so no D-pad re-enabling inside this scene at all - the
D-pad/JUMP/DESCEND stay hidden for the *entire* secret scene, no exceptions.

**Audio (`js/audio.js`).** A single `Sfx` IIFE wraps WebAudio: one-shot SFX
via `tone()`/`slide()` (`toneAt()` is only still used by nothing now that
the two music loops are real audio - kept for any future procedural
scheduling need), plus the real MP3 music tracks described above. The
`AudioContext` is only *resumed*, and any sound actually *played*, on
`unlock()`, called from the start-button tap handler in `main.js` — mobile
browsers block audio before a user gesture, so don't move real playback
earlier than that tap (constructing the context and decoding MP3s ahead of
it, as `loadMusicTracks()` does, is fine - see above).

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

**Message overlay renders HTML, not plain text (`UI.showMessage` in
`ui.js`).** It sets `messageText.innerHTML`, not `.textContent`, so a
message string can bold a phrase or mark part of itself as a smaller
secondary note - see `CLUE_MESSAGE`'s `<b>`/`<span class="clue-hint">` (the
`.clue-hint` rule is in `style.css`; `white-space: pre-line` still honors
plain `\n` line breaks the same as before, even mixed with inline tags).
Every other message in the game is a plain string with no HTML-significant
characters, so this was a safe superset of the old behavior for them - but
any future message text that needs a literal `<`, `>`, or `&` would need to
escape it first, since it's no longer auto-escaped the way `.textContent`
used to guarantee.

**Overlay cards (`.start-card`/`.message-card` in `style.css`).** `.overlay`
centers its card via flex, but that only centers the *card* as a whole -
inside it, a narrower block-level child (the hint box, the button) needs
its own `margin: 0 auto` to actually center, since `.overlay`'s
`text-align: center` only affects inline content, not a block's own box.
**Gotcha already hit once:** this was invisible while the start button's
label was short ("TAP TO START"), since every child happened to be close
enough in width that the missing `margin: auto` didn't read as obviously
off-center - it became a visible bug the moment the label grew into a full
sentence and widened the button (and therefore the card) well past the
hint box's fixed `max-width`. Font sizes here are also `clamp()`ed with a
`vw + vh` expression, not just `vw` - a pure-`vw` clamp doesn't shrink at
all on a viewport that's short but wide (a phone landscape with a lot of
browser chrome eating the height), which is exactly the case that let this
card's content overflow off the bottom of a real short screen with no way
to reach the button (the global `touch-action: none` blocks scrolling
everywhere else in the game). `.overlay` now also carries `overflow-y:
auto` + `touch-action: pan-y` as a fallback of last resort, in case some
future content is too tall to fit even after the above.

**Key config knobs a task will usually touch:**
- `CLUE_MESSAGE`, `BEALE_SPEECH_TEXT`, `NOT_FOUND_MESSAGE`,
  `FOUND_BUT_FINISHED_MESSAGE` — top of `main.js`.
- `CARD_ICONS`/`drawCardIcon()` — `minigame.js` (mini-game card art).
- `PHYS.*` — `physics.js` (movement/jump tuning; remember the dtScale note
  above when changing anything here). There's a single ground speed
  (`WALK_MAX`/`WALK_ACCEL`) - no run/speed-tier button.
- `MUSIC_FILES`/`LOOP_VOL`/`STING_VOL` — `audio.js` (which `assets/music-*.mp3`
  plays where, and how loud - real audio, so these volumes may need
  ear-tuning rather than the low-effort guesses currently in place).

**Design invariant to preserve:** there is no game-over state. Every death
path funnels through `world.onPlayerDeath(reason)`, which shows a "Try again
Memphis Mario!" message (via `UI.showMessage`, with the grimace-face icon)
whose button calls `resetLevel()` — it always restarts the level rather than
ending play. There is no invincibility/assist mode (removed) - enemies
always damage the player normally regardless of death count. Keep this
behavior in mind before adding any new failure state.
