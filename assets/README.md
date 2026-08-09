# Assets

## `beale-street-bg.png`

The Beale Street scene's photo backdrop (Hernando de Soto Bridge, the
Pyramid, downtown skyline at sunset, the BEALE ST neon sign, Overton Park
Shell, a foreground stone balustrade/plaza). Drawn with a "cover" fit in
`drawBealeBackground()` (`js/secretRoom.js`) — it's cropped to fill the
canvas regardless of aspect ratio, never letterboxed/stretched.

## Memory-game card icons

The 20-card matching game has 10 icon pairs. Five are real user-provided
artwork, used as-is (never re-touched/re-pixelated/edited) and only scaled
down to fit the card:

- `card-elvis.png`
- `card-grizzlies.png`
- `card-guitar.png`
- `card-lorraine.png`
- `card-bridge.png`

These are loaded by `loadCardPhotos()` and drawn "contain"-fit (whole image
visible, no cropping) in `drawCardIcon()` (`js/minigame.js`), which maps
each `CARD_PHOTOS` id to its file. The other five (University of Memphis,
Redbirds, the Pyramid, the Peabody duck, St. Jude) don't have source art and
stay drawn procedurally with canvas primitives — same function, the `switch`
statement's default path. To swap a procedural icon for real artwork later,
add it to `CARD_PHOTOS` the same way as the five above.
