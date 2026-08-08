# Assets

## `beale-street-bg.png`

The Beale Street scene's photo backdrop (Hernando de Soto Bridge, the
Pyramid, downtown skyline at sunset, the BEALE ST neon sign, Overton Park
Shell, a foreground stone balustrade/plaza). Drawn with a "cover" fit in
`drawBealeBackground()` (`js/secretRoom.js`) — it's cropped to fill the
canvas regardless of aspect ratio, never letterboxed/stretched.

## Memory-game card icons

The 20-card matching game's 10 icon pairs (University of Memphis, Grizzlies,
Redbirds, Elvis, the Pyramid, the Peabody duck, a Beale St. guitar, the M
bridge, the Lorraine Motel sign, St. Jude) are drawn procedurally with
canvas primitives in `drawCardIcon()` (`js/minigame.js`) — there are no
image files to drop in. To swap an icon's look, edit its `case` in that
function's switch statement.
