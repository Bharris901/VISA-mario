# Assets

## `beale-street-bg.png`

The Beale Street scene's photo backdrop (Hernando de Soto Bridge, the
Pyramid, downtown skyline at sunset, the BEALE ST neon sign, Overton Park
Shell, a foreground stone balustrade/plaza). Drawn with a "cover" fit in
`drawBealeBackground()` (`js/secretRoom.js`) — it's cropped to fill the
canvas regardless of aspect ratio, never letterboxed/stretched.

## `beale-mario.png` / `chest-closed.png` / `chest-open.png`

Real static art for Mario and the treasure chest in the Beale scene, used
as-is (never re-touched/re-pixelated/edited), only scaled down to fit.
Drawn by `drawBealeMario()`/`drawBealeChest()` (`js/secretRoom.js`) at
`BEALE_MARIO_HEIGHT`/`BEALE_CHEST_HEIGHT` respectively - the chest's two
images share one scale factor (derived from `chest-closed.png`'s own native
size) rather than each being independently fit to the same target height,
so opening the lid correctly makes the chest taller on screen instead of
the two images just swapping within an identical box. Neither Mario nor
the chest ever animates a pose or moves once landed in this scene.

## Memory-game card icons

The 20-card matching game has 10 icon pairs, all real user-provided artwork,
used as-is (never re-touched/re-pixelated/edited) and only scaled down to
fit the card:

- `card-memphis.png` (University of Memphis)
- `card-grizzlies.png`
- `card-redbirds.png`
- `card-elvis.png`
- `card-pyramid.png`
- `card-duck.png` (Peabody Hotel duck)
- `card-guitar.png`
- `card-bridge.png` (Hernando de Soto / M bridge)
- `card-lorraine.png` (Lorraine Motel sign)
- `card-stjude.png`

These are loaded by `loadCardPhotos()` and drawn "contain"-fit (whole image
visible, no cropping) in `drawCardIcon()` (`js/minigame.js`), which maps
each `CARD_PHOTOS` id to its file. `drawCardIcon()` also still has the
original procedural (canvas-primitive) art for all 10 icons, kept solely as
a brief fallback for whichever image hasn't finished loading yet - not
normally visible once all 10 files have loaded. To add art for some future
new icon that doesn't have a source image, give it a `case` in that
function's `switch` statement instead of a `CARD_PHOTOS` entry.

## `music-*.mp3`

Six real, user-provided music tracks (replacing what used to be procedural
loops/stings in `js/audio.js`), loaded/decoded by `Sfx.loadMusicTracks()`:

- `music-ground-theme.mp3` — the main level's loop (`Sfx.startMusic()`).
- `music-underwater-theme.mp3` — the Beale scene's loop
  (`Sfx.startMiniGameMusic()`), starting the instant Mario and the chest
  land, not at the tap-to-begin gesture.
- `music-final-match-theme.mp3` — one-shot sting on the mini-game's 10th
  match (`Sfx.finalMatchTheme()`), playing through the chest's
  shake/pop/message-twirl.
- `music-mario-dies-theme.mp3` — one-shot sting on death
  (`Sfx.deathJingle()`).
- `music-game-over-theme.mp3` / `music-level-complete-theme.mp3` — one-shot
  stings at the flagpole (`Sfx.gameOverTheme()`/`Sfx.levelCompleteTheme()`),
  chosen by whether `game.clueFound` is false/true - fireworks fire either
  way, only the music differs.

Used as-is, not re-mixed/re-edited. See the "Real MP3 music tracks" and
"Two separate music loops" notes in `CLAUDE.md` for the gapless-looping and
autoplay-policy details.
