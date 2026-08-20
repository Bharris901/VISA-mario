# Memphis Mario

A browser-playable recreation of World 1-1 with a hidden custom twist: a
secret green pipe near the end of the level leads to a Beale Street scene
(a real Memphis skyline photo backdrop) with a 20-card memory matching
game — 10 pairs of Memphis-themed icons. Winning it pops a treasure chest
open with a scavenger-hunt clue. No app, no install — just a URL.

Most level art (tiles, enemies, Mario's normal walk/jump sprite) is
original pixel art drawn in code; the Beale Street backdrop, Mario and the
treasure chest there, the memory-game card icons, and the end-of-level
Memphis Pyramid are real provided images instead.

The real scavenger-hunt clue is already set in `CLUE_MESSAGE` at the top of
`js/main.js`, shown as "Congrats Memphis Mario!" followed by the clue
inside the treasure chest's message screen — update it there if the clue
ever needs to change.

## Running it locally

No build step — it's a static site.

```
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploying (GitHub Pages)

1. Push this branch (or merge it to `main`).
2. In the repo: **Settings → Pages → Source**, pick the branch and `/ (root)`.
3. GitHub gives you a URL like `https://<user>.github.io/<repo>/` — that's
   the link to share with scavenger-hunt participants.

Any static host works equally well (Netlify, Vercel, Cloudflare Pages) if
you'd rather use one of those instead.

## Controls

- **Desktop (testing):** Arrow keys / WASD to move, Space or Z to jump.
- **Mobile:** drag anywhere in the bottom-left zone to move (a virtual
  stick, not a rigid d-pad — more forgiving with imprecise thumbs), JUMP and
  DESCEND buttons bottom-right. Phone must be in landscape — a rotate prompt
  shows automatically in portrait.

There's a single ground speed (no RUN button/speed tier) - simpler to reason
about for a one-day event with mostly non-gamers. DESCEND is a dedicated
button alternative to dragging the stick down (mainly so entering the secret
pipe doesn't hinge on nailing a precise drag distance) - either input works.
Trying to descend any *other* pipe gives a soft "nope" sound instead of
doing nothing silently.

### Usability choices (why controls feel more forgiving than "true" NES)

- **Coyote time** — you can still jump for a few frames after walking off
  a ledge.
- **Jump buffering** — a jump tapped slightly early still fires the moment
  you land.
- **No game over, ever** — dying (falling in a pit, an enemy hit while
  small, or time running out) cuts the background music and plays a ~5s
  descending "womp womp" sting, then shows a "Try again Memphis Mario!"
  screen (with an 8-bit X-eyes face) and a Start Over button. Music stays
  off until Start Over restarts it fresh. There's no fail state that stops
  play, just a quick pause and a tap to go again. (An earlier version of
  this also made the player briefly invincible to enemies after repeated
  deaths - that's been removed; enemies always damage normally now.)

## Power-ups

Two question blocks (near the start, and roughly halfway through) spawn a
mushroom instead of a coin: a growth mushroom if Mario is still small, or a
green 1-up mushroom instead if he's already big (a "1UP" pops up above his
head, plus bonus points and an extra life on the HUD counter - cosmetic,
since dying never actually ends play).

## How the hidden clue works

- The secret pipe is a normal-looking green pipe in roughly the last
  quarter of the level. Press "down" while standing on top of it to enter
  (no visual hint marks it as special, by design).
- Mario and a closed treasure chest both fall in from the top of the
  screen together and land - Mario on the left, the chest on the right,
  in front of the Beale Street skyline - and neither one moves again for
  the rest of the mini-game. A speech bubble asks for help matching the
  cards and ends with "Tap to begin" — tapping anywhere starts the grid
  (no timer). A peppy ~15s music loop (distinct from the main level's
  theme, which pauses for it) plays for as long as the grid is up.
- The 20-card grid (10 pairs of Memphis icons — University of Memphis,
  Grizzlies, Redbirds, Elvis, the Pyramid, the Peabody duck, a Beale
  Street guitar, the M bridge, the Lorraine Motel sign, St. Jude) fades
  in between Mario and the chest. Tap any two cards to flip them; a
  match sends both cards to a pile that builds up just above Mario's
  head, with a little celebration burst, a mismatch flips both back
  over. Keep going — unlimited attempts, no penalty — until all 10 pairs
  are found.
- Finding the last pair stops the mini-game music and scatters the
  matched cards apart in a burst of confetti, while the chest - still
  sitting exactly where it landed - starts to shake. About 3 seconds
  later it pops open with real fireworks and a message card twirls out
  of it, growing to fill the screen and becoming the clue message. The
  main level's music resumes once the player continues.
- On winning, the clue message is shown, then play resumes right back at
  the pipe so the player can continue to the flagpole.
- Reaching the flagpole **without ever finding/winning the secret game**
  shows "You didn't find the hidden clue, start over to try again," and
  restarts the level.
- Reaching the flagpole **after already finding the clue** shows a
  congratulatory completion message instead.
- Either way, touching the pole (including landing on top of it from a
  jump off the final staircase) grabs on and slides down to the bottom
  first; landing is when fireworks go off, the music stops, and the
  message appears a beat later. Tapping Play Again/Start Over restarts the
  music from the top of the loop.

## Project structure

```
index.html          markup + overlays (start, rotate-prompt, message, HUD)
style.css            layout, HUD, touch controls, responsive/orientation CSS
js/sprites.js        pixel-art sprite definitions (Mario, enemies, tiles...)
js/audio.js          procedural 8-bit-style sound effects + background music (WebAudio)
js/input.js          keyboard + touch input
js/level.js          tile map layout + entity spawn list
js/physics.js        movement tuning + tile collision
js/entities.js       player/enemy/mushroom update logic
js/secretRoom.js     Beale Street photo backdrop + procedural big-Mario/speech-bubble rendering
js/minigame.js       the 20-card memory matching game + treasure chest sequence
js/ui.js             HUD + message overlay helpers
js/main.js           state machine, camera, render loop, boot
```
