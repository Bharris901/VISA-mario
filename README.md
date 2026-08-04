# Memphis Mario

A browser-playable recreation of World 1-1 with a hidden custom twist: a
secret green pipe near the end of the level leads to an 8-bit Beale Street
scene and a picture-matching bonus game. Winning it reveals a scavenger-hunt
clue. No app, no install — just a URL.

All art is original pixel art drawn in code (not traced from any
copyrighted source), tuned to feel close to the classic game.

## Before the event: two things to fill in

1. **The clue text** — edit `CLUE_MESSAGE` at the top of `js/main.js`.
2. **The mini-game card images** — see `assets/README.md`. Until you add
   real images, placeholder colored cards are used automatically.

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
  small, or time running out) shows a brief "Try again Memphis Mario!"
  screen with a Start Over button that restarts the level. There's no fail
  state that stops play, just a quick pause and a tap to go again.
- **Assist mode** — after 3 deaths in a session, the player becomes
  invincible to enemy contact for the rest of that session, so nobody can
  get permanently stuck during the event. This is automatic and silent.

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
- Inside, the reels keep spinning; each tap of JUMP stops the next reel.
  Match all three to win. A miss just resets the reels — unlimited
  attempts, no penalty.
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
js/secretRoom.js     Beale Street backdrop rendering
js/minigame.js       the 3-reel picture-matching bonus game
js/ui.js             HUD + message overlay helpers
js/main.js           state machine, camera, render loop, boot
```
